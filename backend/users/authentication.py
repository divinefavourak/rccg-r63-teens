"""
Additive HttpOnly-cookie JWT authentication.

The header (Bearer) path is checked first and is unchanged, so existing clients
keep working; when there is no Authorization header we fall back to the access
token in an HttpOnly cookie. Cookie usage is logged so adoption can be measured
before Bearer is eventually deprecated.
"""
import logging

from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger('auth.usage')


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            request.auth_source = 'header'
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if not raw_token:
            return None
        # A cookie is sent automatically on every request. If it is stale/invalid,
        # fall back to anonymous (return None) rather than raising — otherwise a
        # browser with an expired cookie would get 401 even on public endpoints.
        try:
            validated = self.get_validated_token(raw_token)
        except (InvalidToken, TokenError):
            return None
        request.auth_source = 'cookie'
        # Sanitize the path before logging (avoid CR/LF log injection).
        safe_path = request.path.replace('\r', '').replace('\n', '')
        logger.debug('auth via cookie: %s', safe_path)
        return self.get_user(validated), validated


def _cookie_kwargs():
    secure = settings.AUTH_COOKIE_SECURE
    samesite = settings.AUTH_COOKIE_SAMESITE
    # Browsers reject SameSite=None cookies unless Secure — force it (belt-and-braces
    # with the settings-load guard) so cookies never silently fail to deliver.
    if samesite == 'None' and not secure:
        secure = True
    return dict(
        httponly=True,
        secure=secure,
        samesite=samesite,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path='/',
    )


def set_auth_cookies(response, access=None, refresh=None):
    """Attach access/refresh tokens as HttpOnly cookies alongside the JSON body."""
    if access is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_ACCESS, access,
            max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            **_cookie_kwargs(),
        )
    if refresh is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH, refresh,
            max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            **_cookie_kwargs(),
        )
    return response


def clear_auth_cookies(response):
    for name in (settings.AUTH_COOKIE_ACCESS, settings.AUTH_COOKIE_REFRESH):
        response.delete_cookie(name, path='/', domain=settings.AUTH_COOKIE_DOMAIN)
    return response
