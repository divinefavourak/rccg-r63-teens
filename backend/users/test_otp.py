from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import OTPCode
from .otp import hash_code, request_otp, verify_otp
from .otp_providers import OTPProvider

User = get_user_model()

_SENT = []  # capturing provider sink


class CapturingProvider(OTPProvider):
    def send(self, destination, channel, code, purpose):
        _SENT.append({'destination': destination, 'channel': channel, 'code': code, 'purpose': purpose})


_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


def make_user(username, **kw):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x',
        first_name=username.title(), last_name='T', **kw,
    )


@override_settings(OTP_PROVIDER='users.test_otp.CapturingProvider')
class OTPServiceTests(TestCase):
    def setUp(self):
        _SENT.clear()

    def _last_code(self):
        return _SENT[-1]['code']

    def test_request_stores_hash_not_plaintext(self):
        otp = request_otp('tolu@example.com', OTPCode.Channel.EMAIL, OTPCode.Purpose.LOGIN)
        code = self._last_code()
        self.assertNotEqual(otp.code_hash, code)          # never store plaintext
        self.assertEqual(otp.code_hash, hash_code(code))  # stored as HMAC

    def test_verify_success_consumes_single_use(self):
        request_otp('a@example.com', OTPCode.Channel.EMAIL, OTPCode.Purpose.VERIFY)
        code = self._last_code()
        self.assertIsNotNone(verify_otp('a@example.com', OTPCode.Purpose.VERIFY, code))
        # second use fails (consumed)
        self.assertIsNone(verify_otp('a@example.com', OTPCode.Purpose.VERIFY, code))

    def test_wrong_code_increments_attempts_then_locks(self):
        request_otp('b@example.com', OTPCode.Channel.EMAIL, OTPCode.Purpose.LOGIN)
        for _ in range(5):
            self.assertIsNone(verify_otp('b@example.com', OTPCode.Purpose.LOGIN, '000000'))
        otp = OTPCode.objects.get(destination='b@example.com')
        self.assertEqual(otp.attempts, 5)
        # even the correct code now fails (attempts exhausted)
        self.assertIsNone(verify_otp('b@example.com', OTPCode.Purpose.LOGIN, self._last_code()))

    def test_expired_code_fails(self):
        otp = request_otp('c@example.com', OTPCode.Channel.EMAIL, OTPCode.Purpose.LOGIN)
        code = self._last_code()
        OTPCode.objects.filter(pk=otp.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertIsNone(verify_otp('c@example.com', OTPCode.Purpose.LOGIN, code))

    def test_request_invalidates_previous(self):
        request_otp('d@example.com', OTPCode.Channel.EMAIL, OTPCode.Purpose.LOGIN)
        first = self._last_code()
        request_otp('d@example.com', OTPCode.Channel.EMAIL, OTPCode.Purpose.LOGIN)
        # the first code is now consumed/invalid
        self.assertIsNone(verify_otp('d@example.com', OTPCode.Purpose.LOGIN, first))


@override_settings(OTP_PROVIDER='users.test_otp.CapturingProvider', CACHES=_LOCMEM)
class OTPApiTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # reset throttle counters between tests
        _SENT.clear()
        self.user = make_user('login')  # email == login@example.com

    def test_request_is_generic_and_no_enumeration(self):
        # Unknown login destination -> 200, nothing sent.
        res = self.client.post('/api/v1/auth/otp/request/',
                               {'destination': 'ghost@example.com', 'channel': 'email', 'purpose': 'login'},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(_SENT, [])

    def test_login_via_otp_returns_tokens(self):
        self.client.post('/api/v1/auth/otp/request/',
                         {'destination': 'login@example.com', 'channel': 'email', 'purpose': 'login'},
                         format='json')
        code = _SENT[-1]['code']
        res = self.client.post('/api/v1/auth/otp/verify/',
                               {'destination': 'login@example.com', 'purpose': 'login', 'code': code},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_verify_to_unknown_destination_sends_nothing(self):
        """M1: OTP is never dispatched to a destination with no account (no relay)."""
        res = self.client.post('/api/v1/auth/otp/request/',
                               {'destination': 'stranger@example.com', 'channel': 'email', 'purpose': 'verify'},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(_SENT, [])

    def test_otp_login_respects_account_lockout(self):
        """M4: OTP login must honour account lockout like password login."""
        from datetime import timedelta
        self.user.account_locked_until = timezone.now() + timedelta(minutes=15)
        self.user.save(update_fields=['account_locked_until'])
        request_otp('login@example.com', OTPCode.Channel.EMAIL, OTPCode.Purpose.LOGIN, user=self.user)
        code = _SENT[-1]['code']
        res = self.client.post('/api/v1/auth/otp/verify/',
                               {'destination': 'login@example.com', 'purpose': 'login', 'code': code},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_423_LOCKED)

    def test_verify_purpose_marks_user_verified(self):
        request_otp('login@example.com', OTPCode.Channel.EMAIL, OTPCode.Purpose.VERIFY, user=self.user)
        code = _SENT[-1]['code']
        res = self.client.post('/api/v1/auth/otp/verify/',
                               {'destination': 'login@example.com', 'purpose': 'verify', 'code': code},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)
