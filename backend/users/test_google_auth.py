from datetime import date, timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .google_auth import GoogleAuthError, safe_return_url

User = get_user_model()

_LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

_GOOGLE_SETTINGS = dict(
    CACHES=_LOCMEM,
    DEBUG=True,
    PUBLIC_API_URL="https://api.example.com",
    GOOGLE_OAUTH_CLIENT_ID="client-id.apps.googleusercontent.com",
    GOOGLE_OAUTH_CLIENT_SECRET="client-secret",
    GOOGLE_OAUTH_REDIRECT_URI="",
    MOBILE_APP_SCHEME="faithtribe",
    FRONTEND_URL="https://www.example.com",
    CORS_ALLOWED_ORIGINS=["https://www.example.com"],
)


def make_user(username, **kw):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="x",
        first_name=username.title(),
        last_name="T",
        **kw,
    )


def _query(location):
    return parse_qs(urlsplit(location).query)


def _google_says(email):
    """Both calls the callback makes to Google, without going to Google."""
    return (
        patch("users.google_auth.exchange_code", return_value="id-token"),
        patch(
            "users.google_auth.verify_google_id_token",
            return_value={
                "email": email,
                "email_verified": True,
                "given_name": "Tolu",
                "family_name": "Adeyemi",
            },
        ),
    )


@override_settings(**_GOOGLE_SETTINGS)
class GoogleAuthTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user("tolu")

    def _start(self, return_url="faithtribe://auth/google"):
        return self.client.get("/api/v1/auth/google/start/", {"return": return_url})

    def _state(self):
        response = self._start()
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        return _query(response["Location"])["state"][0]

    def _callback(self, state, code="auth-code"):
        return self.client.get(
            "/api/v1/auth/google/callback/",
            {"state": state, "code": code},
        )

    def _ticket(self, email=None):
        state = self._state()
        exchange, verify = _google_says(email or self.user.email)
        with exchange, verify:
            response = self._callback(state)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        return _query(response["Location"]).get("code", [None])[0]

    def test_start_redirects_to_google_with_our_callback(self):
        response = self._start()
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        location = urlsplit(response["Location"])
        self.assertEqual(location.netloc, "accounts.google.com")
        query = _query(response["Location"])
        self.assertEqual(query["client_id"][0], "client-id.apps.googleusercontent.com")
        self.assertEqual(
            query["redirect_uri"][0],
            "https://api.example.com/api/v1/auth/google/callback/",
        )
        self.assertEqual(query["scope"][0], "openid email profile")
        self.assertTrue(query["state"][0])

    def test_start_without_config_returns_to_app(self):
        with override_settings(
            GOOGLE_OAUTH_CLIENT_ID="", GOOGLE_OAUTH_CLIENT_SECRET=""
        ):
            response = self._start()
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(_query(response["Location"])["error"][0], "not_configured")

    @override_settings(DEBUG=False)
    def test_start_rejects_an_address_that_is_not_ours(self):
        response = self._start("https://evil.example.net/steal")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_callback_puts_a_ticket_on_the_app_link(self):
        state = self._state()
        exchange, verify = _google_says(self.user.email)
        with exchange, verify:
            response = self._callback(state)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        location = urlsplit(response["Location"])
        self.assertEqual(location.scheme, "faithtribe")
        self.assertTrue(_query(response["Location"])["code"][0])

    def test_exchange_returns_a_session_once(self):
        ticket = self._ticket()
        response = self.client.post(
            "/api/v1/auth/google/exchange/",
            {"code": ticket},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], self.user.email)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)

        # The same ticket cannot mint a second session.
        again = self.client.post(
            "/api/v1/auth/google/exchange/",
            {"code": ticket},
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def _signup_ticket(self, email="newteen@example.com"):
        state = self._state()
        exchange, verify = _google_says(email)
        with exchange, verify:
            response = self._callback(state)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        return _query(response["Location"])["signup"][0]

    def _completion(self, ticket, **overrides):
        payload = {
            "ticket": ticket,
            "first_name": "Tolu",
            "last_name": "Adeyemi",
            "phone": "0803 555 0142",
            "date_of_birth": f"{date.today().year - 15}-01-15",
            "gender": "male",
        }
        payload.update(overrides)
        return payload

    def test_unknown_google_email_starts_sign_up(self):
        state = self._state()
        exchange, verify = _google_says("newteen@example.com")
        with exchange, verify:
            response = self._callback(state)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertTrue(_query(response["Location"])["signup"][0])

    def test_sign_up_details_comes_from_google(self):
        ticket = self._signup_ticket()
        response = self.client.post(
            "/api/v1/auth/google/signup/", {"ticket": ticket}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "newteen@example.com")
        self.assertEqual(response.data["first_name"], "Tolu")
        self.assertEqual(response.data["last_name"], "Adeyemi")

    def test_sign_up_details_refuses_an_unknown_ticket(self):
        response = self.client.post(
            "/api/v1/auth/google/signup/", {"ticket": "not-a-ticket"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_completion_creates_the_account_and_signs_them_in(self):
        ticket = self._signup_ticket()
        payload = self._completion(ticket)
        with patch("users.google_auth.UserEmailService.send_welcome_email"):
            response = self.client.post(
                "/api/v1/auth/google/complete/", payload, format="json"
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "newteen@example.com")

        user = User.objects.get(email="newteen@example.com")
        self.assertTrue(user.is_verified)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(str(user.phone), "+2348035550142")
        self.assertEqual(
            user.teen_profile.date_of_birth.isoformat(), payload["date_of_birth"]
        )

    def test_completion_is_single_use(self):
        ticket = self._signup_ticket()
        with patch("users.google_auth.UserEmailService.send_welcome_email"):
            first = self.client.post(
                "/api/v1/auth/google/complete/", self._completion(ticket), format="json"
            )
            second = self.client.post(
                "/api/v1/auth/google/complete/", self._completion(ticket), format="json"
            )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_completion_refuses_an_email_that_now_has_an_account(self):
        ticket = self._signup_ticket("newteen@example.com")
        make_user("newteen")
        with patch("users.google_auth.UserEmailService.send_welcome_email"):
            response = self.client.post(
                "/api/v1/auth/google/complete/", self._completion(ticket), format="json"
            )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_completion_refuses_an_under_six_birthday(self):
        ticket = self._signup_ticket("little@example.com")
        with patch("users.google_auth.UserEmailService.send_welcome_email"):
            response = self.client.post(
                "/api/v1/auth/google/complete/",
                self._completion(
                    ticket, date_of_birth=f"{date.today().year - 5}-01-01"
                ),
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="little@example.com").exists())

    def test_google_failure_comes_back_as_google_error(self):
        state = self._state()
        with patch(
            "users.google_auth.exchange_code",
            side_effect=GoogleAuthError("nope"),
        ):
            response = self._callback(state)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(_query(response["Location"])["error"][0], "google_error")

    def test_callback_with_a_forged_state_is_refused(self):
        response = self.client.get(
            "/api/v1/auth/google/callback/",
            {"state": "not-a-real-state", "code": "anything"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_locked_account_cannot_exchange(self):
        self.user.account_locked_until = timezone.now() + timedelta(minutes=10)
        self.user.save(update_fields=["account_locked_until"])
        ticket = self._ticket()
        response = self.client.post(
            "/api/v1/auth/google/exchange/",
            {"code": ticket},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)


class SafeReturnUrlTests(APITestCase):
    def test_accepts_the_app_scheme(self):
        self.assertEqual(
            safe_return_url("faithtribe://auth/google"), "faithtribe://auth/google"
        )

    @override_settings(
        DEBUG=False, FRONTEND_URL="https://www.example.com", CORS_ALLOWED_ORIGINS=[]
    )
    def test_accepts_a_known_web_origin(self):
        self.assertEqual(
            safe_return_url("https://www.example.com/auth/google"),
            "https://www.example.com/auth/google",
        )

    @override_settings(
        DEBUG=False, FRONTEND_URL="https://www.example.com", CORS_ALLOWED_ORIGINS=[]
    )
    def test_refuses_another_site(self):
        self.assertEqual(safe_return_url("https://evil.example.net/steal"), "")

    @override_settings(
        DEBUG=False, FRONTEND_URL="https://www.example.com", CORS_ALLOWED_ORIGINS=[]
    )
    def test_refuses_a_lookalike_host(self):
        self.assertEqual(safe_return_url("https://www.example.com.evil.net/steal"), "")
