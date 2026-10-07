from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


def make_user(username='cookieuser', password='secret-12345'):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password=password,
        first_name='Cookie', last_name='User',
    )


@override_settings(CACHES=_LOCMEM, AUTH_COOKIE_SECURE=False)
class CookieAuthTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # reset throttle counters between tests
        self.password = 'secret-12345'
        self.user = make_user(password=self.password)

    def _login(self):
        return self.client.post('/api/v1/auth/login/',
                                {'username': self.user.username, 'password': self.password},
                                format='json')

    def test_login_sets_httponly_cookies(self):
        res = self._login()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', res.cookies)
        self.assertIn('refresh_token', res.cookies)
        self.assertTrue(res.cookies['access_token']['httponly'])
        # Body still carries tokens (Bearer clients unaffected).
        self.assertIn('access', res.data)

    def test_cookie_authenticates_without_header(self):
        self._login()  # APIClient now holds the cookies
        res = self.client.get('/api/v1/auth/me/')  # no Authorization header
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], self.user.username)

    def test_bearer_header_still_works(self):
        access = self._login().data['access']
        self.client.cookies.clear()  # remove cookies to prove the header path
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        res = self.client.get('/api/v1/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_refresh_via_cookie(self):
        self._login()
        res = self.client.post('/api/v1/auth/refresh/', {}, format='json')  # refresh from cookie
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_stale_cookie_is_anonymous_not_401(self):
        """M2: an invalid/expired access cookie must not 401 public endpoints."""
        from rest_framework.test import APIRequestFactory
        from users.authentication import CookieJWTAuthentication
        req = APIRequestFactory().get('/')
        req.COOKIES['access_token'] = 'not-a-valid-jwt'
        self.assertIsNone(CookieJWTAuthentication().authenticate(req))

    @override_settings(AUTH_COOKIE_SAMESITE='None', AUTH_COOKIE_SECURE=False)
    def test_samesite_none_forces_secure_cookie(self):
        """SameSite=None must not silently break delivery: Secure is forced on."""
        res = self._login()
        self.assertTrue(res.cookies['access_token']['secure'])

    def test_logout_clears_cookies(self):
        self._login()
        res = self.client.post('/api/v1/auth/logout/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.cookies['access_token'].value, '')
        self.assertEqual(res.cookies['refresh_token'].value, '')


@override_settings(CACHES=_LOCMEM, AUTH_COOKIE_SECURE=False)
class RefreshTokenTests(APITestCase):
    """The phone's side of the session: tokens in the body, no cookies."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # reset throttle counters between tests
        self.user = make_user(username='phoneuser')
        login = self.client.post(
            '/api/v1/auth/login/',
            {'username': self.user.username, 'password': 'secret-12345'}, format='json')
        self.refresh = login.data['refresh']
        self.client.cookies.clear()  # a phone holds no cookies

    def refresh_with(self, token):
        response = self.client.post('/api/v1/auth/refresh/', {'refresh': token}, format='json')
        self.client.cookies.clear()
        return response

    def test_a_refresh_whose_answer_was_lost_can_be_tried_again(self):
        """The phone never saw the first answer, so it still holds the old token."""
        lost = self.refresh_with(self.refresh)
        again = self.refresh_with(self.refresh)

        self.assertEqual(lost.status_code, status.HTTP_200_OK)
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertIn('access', again.data)

    def test_signing_out_ends_the_token_it_was_given(self):
        self.client.post('/api/v1/auth/logout/', {'refresh': self.refresh}, format='json')
        self.client.cookies.clear()

        response = self.refresh_with(self.refresh)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
