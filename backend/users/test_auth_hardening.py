from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


def make_user(username, verified=False, password='pass-12345'):
    u = User.objects.create_user(
        username=username, email=f'{username}@example.com', password=password,
        first_name=username.title(), last_name='T',
    )
    u.is_verified = verified
    u.save(update_fields=['is_verified'])
    return u


@override_settings(CACHES=_LOCMEM)
class EmailVerificationTests(APITestCase):
    def test_verify_email_endpoint(self):
        user = make_user('tolu', verified=False)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        res = self.client.post('/api/v1/auth/verify-email/',
                               {'uid': uid, 'token': token}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_verified)

    def test_verify_email_rejects_bad_token(self):
        user = make_user('bad', verified=False)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        res = self.client.post('/api/v1/auth/verify-email/',
                               {'uid': uid, 'token': 'not-a-token'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertFalse(user.is_verified)

    @override_settings(ENFORCE_EMAIL_VERIFICATION=True)
    def test_login_blocked_when_unverified_and_enforced(self):
        make_user('unverified', verified=False, password='secret-123')
        res = self.client.post('/api/v1/auth/login/',
                               {'username': 'unverified', 'password': 'secret-123'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(ENFORCE_EMAIL_VERIFICATION=True)
    def test_login_allowed_when_verified(self):
        make_user('verified', verified=True, password='secret-123')
        res = self.client.post('/api/v1/auth/login/',
                               {'username': 'verified', 'password': 'secret-123'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    @override_settings(ENFORCE_EMAIL_VERIFICATION=False)
    def test_login_not_blocked_when_enforcement_off(self):
        make_user('anyone', verified=False, password='secret-123')
        res = self.client.post('/api/v1/auth/login/',
                               {'username': 'anyone', 'password': 'secret-123'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_user_cannot_delete_own_account(self):
        """DELETE requires users.manage; ownership must not grant self-deletion."""
        u = make_user('selfdel', verified=True)
        self.client.force_authenticate(u)
        res = self.client.delete(f'/api/v1/auth/users/{u.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
