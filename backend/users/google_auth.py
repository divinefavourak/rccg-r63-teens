"""
Sign in with Google.

The browser flow is run by this API, not by the app:

1. the app opens ``/auth/google/start/`` in an in-app browser, naming the app
   address to come back to;
2. Google returns to ``/auth/google/callback/`` on this API;
3. the API sends the app a short-lived, single-use ticket over its own deep
   link;
4. the app exchanges that ticket at ``/auth/google/exchange/`` for the same JWT
   pair every other sign-in returns.

Keeping the flow on the server means the OAuth client secret never goes near a
phone, and one **Web application** OAuth client in Google Cloud serves Android,
iOS and the web. No native client IDs, SHA-1 fingerprints, or per-platform
rebuilds are involved.

Only a verified Google email is trusted. An email with no account is held in a
short-lived sign-up ticket, and the app finishes the sign-up form (phone, date
of birth, parish) before the account is created. Google never bypasses the
questions the rest of the product relies on.
"""

import logging
import secrets
from datetime import date
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import jwt
import requests
from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseRedirect
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .email_service import UserEmailService
from .models import User
from .signup import _create_teen, normalize_phone

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

_STATE_SALT = "faithtribe.google-oauth"
_TICKET_PREFIX = "google:ticket:"
_SIGNUP_TICKET_PREFIX = "google:signup:"
_JWKS_CACHE_KEY = "google:jwks"
_TICKET_TTL = 90  # seconds
_SIGNUP_TICKET_TTL = 30 * 60  # the sign-up form can take a while


class GoogleAuthError(Exception):
    """Google could not be reached, or answered something unusable."""


# ─── Configuration ─────────────────────────────────────────────────────────


def _client_config():
    """``(client_id, client_secret)``, or None when the feature is not set up."""
    client_id = (getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or "").strip()
    client_secret = (getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "") or "").strip()
    if not client_id or not client_secret:
        return None
    return client_id, client_secret


def _api_base(request):
    """This API's address as someone outside opens it, with no trailing slash."""
    return settings.PUBLIC_API_URL or request.build_absolute_uri("/").rstrip("/")


def _callback_url(request):
    """The exact address Google must return to. It has to match the console."""
    configured = (getattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", "") or "").strip()
    return configured or _api_base(request) + "/api/v1/auth/google/callback/"


def safe_return_url(value):
    """Where the app asked to be sent back to, if it is somewhere of ours.

    The phone app's own scheme, an Expo Go / local address in development, or
    one of our websites. Anything else is dropped, so this endpoint can never
    be used as an open redirect.
    """
    if not isinstance(value, str) or not value or len(value) > 1000:
        return ""
    parts = urlsplit(value)
    if parts.scheme == getattr(settings, "MOBILE_APP_SCHEME", "faithtribe"):
        return value
    # Expo Go and a local web build, which have no fixed address.
    if settings.DEBUG and parts.scheme in ("exp", "http", "https"):
        return value
    origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    ours = (
        {origin.rstrip("/") for origin in origins}
        if isinstance(origins, (list, tuple))
        else set()
    )
    if settings.FRONTEND_URL:
        ours.add(settings.FRONTEND_URL.rstrip("/"))
    if parts.scheme == "https" and f"https://{parts.netloc}" in ours:
        return value
    return ""


# ─── URLs ──────────────────────────────────────────────────────────────────


def _with_params(url, **params):
    """Add or replace query parameters on an app or web address."""
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update({key: value for key, value in params.items() if value is not None})
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )


def _sign_state(return_url, redirect_uri):
    return signing.dumps(
        {"return": return_url, "redirect_uri": redirect_uri},
        salt=_STATE_SALT,
        compress=True,
    )


def _read_state(value):
    return signing.loads(value, salt=_STATE_SALT, max_age=600)


# ─── Google ────────────────────────────────────────────────────────────────


def exchange_code(code, redirect_uri, client_id, client_secret):
    """Trade the one-time authorization code for Google's ID token."""
    try:
        response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        raise GoogleAuthError("Could not reach Google.") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise GoogleAuthError("Google sent an unreadable answer.") from exc

    if response.status_code >= 400 or not payload.get("id_token"):
        logger.warning(
            "[GoogleAuth] token exchange refused status=%s error=%s",
            response.status_code,
            payload.get("error", "(none)"),
        )
        raise GoogleAuthError("Google refused the sign-in.")
    return payload["id_token"]


def _google_jwks(force=False):
    """Google's current signing keys, by key id, kept in the cache for an hour."""
    if not force:
        try:
            cached = cache.get(_JWKS_CACHE_KEY)
        except Exception:  # Redis down: fetch directly, as the rest of the API does.
            cached = None
        if cached:
            return cached

    try:
        response = requests.get(GOOGLE_JWKS_URL, timeout=5)
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise GoogleAuthError("Could not fetch Google signing keys.") from exc

    keys = {
        key["kid"]: key
        for key in payload.get("keys", [])
        if key.get("kid") and key.get("kty") == "RSA"
    }
    if not keys:
        raise GoogleAuthError("Google sent no signing keys.")
    try:
        cache.set(_JWKS_CACHE_KEY, keys, 3600)
    except Exception:
        # Caching is an optimisation here; verification still works without it.
        pass
    return keys


def verify_google_id_token(id_token):
    """Check Google's signature and claims, and return them.

    ``aud`` must be our own client ID, the issuer must be Google, and the email
    must be one Google has verified. Without that last check a Google account
    could claim somebody else's address.
    """
    client_id, _ = _client_config() or ("", "")
    if not client_id:
        raise GoogleAuthError("Google sign-in is not configured.")

    try:
        header = jwt.get_unverified_header(id_token)
    except jwt.PyJWTError as exc:
        raise GoogleAuthError("That Google token is malformed.") from exc

    kid = header.get("kid")
    key_data = _google_jwks().get(kid) if kid else None
    if key_data is None:
        # Google rotates its keys. An id we do not know may be a new one.
        key_data = _google_jwks(force=True).get(kid) if kid else None
    if key_data is None:
        raise GoogleAuthError("That Google token was signed with an unknown key.")

    try:
        claims = jwt.decode(
            id_token,
            jwt.algorithms.RSAAlgorithm.from_jwk(key_data),
            algorithms=["RS256"],
            audience=client_id,
            issuer=list(GOOGLE_ISSUERS),
            options={"verify_at_hash": False},
        )
    except jwt.PyJWTError as exc:
        raise GoogleAuthError("That Google token did not check out.") from exc

    if claims.get("email_verified") not in (True, "true"):
        raise GoogleAuthError("Google has not verified that email address.")
    if not claims.get("email"):
        raise GoogleAuthError("Google did not share an email address.")

    return claims


# ─── Short-lived tickets ───────────────────────────────────────────────────


def _issue_ticket(user):
    """A single-use handle the app exchanges for a session, or '' if it cannot be kept."""
    ticket = secrets.token_urlsafe(32)
    try:
        cache.set(_TICKET_PREFIX + ticket, str(user.pk), _TICKET_TTL)
    except Exception:
        logger.exception("[GoogleAuth] could not store the sign-in ticket")
        return ""
    return ticket


def _consume_ticket(ticket):
    """The user a ticket belongs to, once. None if it is unknown or already used."""
    if not isinstance(ticket, str) or len(ticket) < 20:
        return None
    key = _TICKET_PREFIX + ticket
    try:
        user_id = cache.get(key)
    except Exception:
        return None
    if not user_id:
        return None
    try:
        # add() only succeeds for the first caller, so two exchanges racing for
        # the same ticket cannot both mint a session.
        if not cache.add(key + ":used", 1, _TICKET_TTL):
            return None
    except Exception:
        return None
    try:
        cache.delete(key)
    except Exception:
        # The marker above already makes it single-use.
        pass
    return User.objects.filter(pk=user_id, is_active=True).first()


# ─── Short-lived sign-up tickets ───────────────────────────────────────────


def _issue_signup_ticket(claims):
    """Hold a verified Google identity until the sign-up form is finished."""
    email = (claims.get("email") or "").strip().lower()
    first_name = (claims.get("given_name") or "").strip()[:100]
    last_name = (claims.get("family_name") or "").strip()[:100]

    if not first_name:
        name = (claims.get("name") or "").strip()
        parts = name.split(" ", 1)
        first_name = parts[0][:100] if parts else ""
        if not last_name and len(parts) > 1:
            last_name = parts[1][:100]

    ticket = secrets.token_urlsafe(32)
    try:
        cache.set(
            _SIGNUP_TICKET_PREFIX + ticket,
            {"email": email, "first_name": first_name, "last_name": last_name},
            _SIGNUP_TICKET_TTL,
        )
    except Exception:
        logger.exception("[GoogleAuth] could not store the sign-up ticket")
        return ""
    return ticket


def _read_signup_ticket(ticket):
    if not isinstance(ticket, str) or len(ticket) < 20:
        return None
    try:
        payload = cache.get(_SIGNUP_TICKET_PREFIX + ticket)
    except Exception:
        return None
    if not isinstance(payload, dict) or not payload.get("email"):
        return None
    return payload


def _consume_signup_ticket(ticket):
    try:
        cache.delete(_SIGNUP_TICKET_PREFIX + ticket)
    except Exception:
        # The account is already created; a stale key expires on its own.
        pass


class GoogleSignupCompleteSerializer(serializers.Serializer):
    """The answers the app adds to a verified Google identity."""

    ticket = serializers.CharField(max_length=200)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=32)
    date_of_birth = serializers.DateField()
    gender = serializers.ChoiceField(
        choices=User.Gender.choices, required=False, allow_blank=True
    )
    church_node = serializers.UUIDField(required=False, allow_null=True)

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not phone:
            raise serializers.ValidationError("Enter a valid phone number.")
        return phone

    def validate_date_of_birth(self, value):
        today = date.today()
        if value > today:
            raise serializers.ValidationError("That date is in the future.")
        age = (
            today.year
            - value.year
            - ((today.month, today.day) < (value.month, value.day))
        )
        if age < 6:
            raise serializers.ValidationError(
                "Faith Tribe accounts start at 6. Ask a parent or your teacher to help you join in."
            )
        return value

    def validate_church_node(self, value):
        if value is None:
            return None
        from hierarchy.models import HierarchyNode

        node = HierarchyNode.objects.filter(pk=value, is_active=True).first()
        if node is None:
            raise serializers.ValidationError("That church could not be found.")
        return node


# ─── Views ─────────────────────────────────────────────────────────────────


def _redirect(url, **params):
    """302 to an app address, which Django's redirect class would refuse.

    `HttpResponseRedirect` only allows http(s) and ftp, and an app link uses
    its own scheme (`faithtribe://`). The address has already been through
    `safe_return_url`, so setting the header directly is the narrow way round
    that guard without opening a general redirect.
    """
    response = HttpResponse(status=302)
    response["Location"] = _with_params(url, **params)
    # The Location may carry a one-time ticket; never let a browser keep it.
    response["Cache-Control"] = "no-store"
    return response


class GoogleStartView(APIView):
    """``GET /auth/google/start/?return=<app address>`` — begin the browser flow."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return_url = safe_return_url(request.query_params.get("return"))
        if not return_url:
            return Response(
                {"detail": "A valid return address is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config = _client_config()
        if config is None:
            # Back to the app rather than a JSON page in a browser tab.
            return _redirect(return_url, error="not_configured")
        client_id, _ = config

        redirect_uri = _callback_url(request)
        state = _sign_state(return_url, redirect_uri)
        query = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "access_type": "online",
                "prompt": "select_account",
            }
        )
        return HttpResponseRedirect(f"{GOOGLE_AUTH_URL}?{query}")


class GoogleCallbackView(APIView):
    """The address Google returns to. Sends the app a one-time ticket."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        state = request.query_params.get("state", "")
        try:
            saved = _read_state(state)
        except (signing.BadSignature, signing.SignatureExpired):
            return HttpResponseBadRequest("This sign-in link has expired. Try again.")

        return_url = safe_return_url(saved.get("return"))
        if not return_url:
            return HttpResponseBadRequest("This sign-in link is not valid.")

        if request.query_params.get("error"):
            # The teen closed the consent screen, or refused access.
            return _redirect(return_url, error="google_denied")

        code = request.query_params.get("code", "")
        if not code:
            return _redirect(return_url, error="google_error")

        config = _client_config()
        if config is None:
            return _redirect(return_url, error="not_configured")
        client_id, client_secret = config

        try:
            id_token = exchange_code(
                code,
                saved.get("redirect_uri") or _callback_url(request),
                client_id,
                client_secret,
            )
            claims = verify_google_id_token(id_token)
        except GoogleAuthError as exc:
            logger.warning("[GoogleAuth] sign-in failed to verify: %s", exc)
            return _redirect(return_url, error="google_error")

        user = User.objects.filter(
            email__iexact=claims["email"].strip(), is_active=True
        ).first()
        if user is None:
            # A new teen: keep the verified Google identity for the sign-up
            # form, which still has to ask for the date of birth and parish.
            signup = _issue_signup_ticket(claims)
            if not signup:
                return _redirect(return_url, error="server_error")
            return _redirect(return_url, signup=signup)

        ticket = _issue_ticket(user)
        if not ticket:
            return _redirect(return_url, error="server_error")
        return _redirect(return_url, code=ticket)


class GoogleExchangeView(APIView):
    """``POST /auth/google/exchange/`` — swap the ticket for a session."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from .views import google_login_response  # avoids a circular import

        user = _consume_ticket(request.data.get("code", ""))
        if user is None:
            return Response(
                {"detail": "That sign-in link has expired. Try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return google_login_response(user)


class GoogleSignupDetailsView(APIView):
    """``POST /auth/google/signup/`` — the name and email Google verified."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        pending = _read_signup_ticket(request.data.get("ticket", ""))
        if pending is None:
            return Response(
                {"detail": "That Google sign-up link has expired. Start again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "email": pending["email"],
                "first_name": pending.get("first_name", ""),
                "last_name": pending.get("last_name", ""),
            }
        )


class GoogleSignupCompleteView(APIView):
    """``POST /auth/google/complete/`` — create the account and sign them in."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from .views import session_response  # avoids a circular import

        serializer = GoogleSignupCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        ticket = data.pop("ticket")

        pending = _read_signup_ticket(ticket)
        if pending is None:
            return Response(
                {"detail": "That Google sign-up link has expired. Start again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = pending["email"]
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {
                    "detail": "An account with this email already exists. Try signing in."
                },
                status=status.HTTP_409_CONFLICT,
            )

        details = {
            "email": email,
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "phone": data["phone"],
            "date_of_birth": data["date_of_birth"],
            "gender": data.get("gender") or "",
            "church_node": data.get("church_node"),
        }
        try:
            with transaction.atomic():
                user = _create_teen(details)
        except IntegrityError:
            # Two requests raced for the same email; the other one won.
            return Response(
                {
                    "detail": "An account with this email already exists. Try signing in."
                },
                status=status.HTTP_409_CONFLICT,
            )

        _consume_signup_ticket(ticket)
        UserEmailService.send_welcome_email(user)
        response = session_response(user, verify_email=True)
        response.status_code = status.HTTP_201_CREATED
        return response
