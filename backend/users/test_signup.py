from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from hierarchy import services
from hierarchy.models import NodeType
from identity.models import Membership

from .models import OTPCode
from .otp_providers import OTPProvider
from .signup import normalize_phone

User = get_user_model()

_SENT = []  # capturing provider sink


class CapturingProvider(OTPProvider):
    def send(self, destination, channel, code, purpose):
        _SENT.append({'destination': destination, 'channel': channel, 'code': code, 'purpose': purpose})


_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

START = '/api/v1/auth/signup/start/'
COMPLETE = '/api/v1/auth/signup/complete/'

EMAIL = 'tolu@example.com'
PHONE = '+2348031234567'


class NormalizePhoneTests(SimpleTestCase):
    def test_nigerian_forms_collapse_to_one_number(self):
        for raw in ('08031234567', '8031234567', '2348031234567', '+2348031234567',
                    '0803 123 4567', '0803-123-4567'):
            self.assertEqual(normalize_phone(raw), PHONE, raw)

    def test_international_number_is_kept(self):
        self.assertEqual(normalize_phone('+447911123456'), '+447911123456')

    def test_rubbish_is_rejected(self):
        for raw in ('', 'abc', '12345', '0803123456789012345'):
            self.assertEqual(normalize_phone(raw), '', raw)


@override_settings(OTP_PROVIDER='users.test_signup.CapturingProvider', CACHES=_LOCMEM)
class SignupTests(APITestCase):
    def setUp(self):
        cache.clear()  # reset throttle and per-destination counters between tests
        _SENT.clear()

    def _start(self, email=EMAIL, phone='08031234567'):
        return self.client.post(START, {'email': email, 'phone': phone}, format='json')

    def _complete(self, code, **extra):
        body = {'email': EMAIL, 'phone': '08031234567', 'code': code,
                'first_name': 'Tolu', 'last_name': 'Ade', **extra}
        return self.client.post(COMPLETE, body, format='json')

    # ── start ────────────────────────────────────────────────────────────

    def test_start_sends_one_code_to_both_destinations(self):
        res = self._start()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(_SENT), 2)
        self.assertEqual({m['destination'] for m in _SENT}, {EMAIL, PHONE})
        self.assertEqual({m['channel'] for m in _SENT}, {'email', 'sms'})
        self.assertEqual(_SENT[0]['code'], _SENT[1]['code'])
        self.assertEqual({m['purpose'] for m in _SENT}, {'verify'})

    def test_start_rejects_a_bad_phone(self):
        res = self._start(phone='12345')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(_SENT, [])

    def test_start_for_existing_account_sends_login_code_and_looks_the_same(self):
        User.objects.create_user(username='tolu', email=EMAIL, password='x',
                                 first_name='Tolu', last_name='Ade')
        fresh = self._start(email='new@example.com', phone='08039999999')
        existing = self._start()
        self.assertEqual(existing.status_code, fresh.status_code)
        self.assertEqual(existing.data, fresh.data)  # no enumeration
        login = [m for m in _SENT if m['purpose'] == 'login']
        self.assertEqual(len(login), 1)
        self.assertEqual(login[0]['destination'], EMAIL)

    @override_settings(SIGNUP_CODES_PER_DESTINATION=2)
    def test_start_stops_sending_past_the_per_destination_cap(self):
        for _ in range(4):
            self.assertEqual(self._start().status_code, status.HTTP_200_OK)
        # 2 allowed sends x 2 destinations; the rest are swallowed silently.
        self.assertEqual(len(_SENT), 4)

    # ── complete ─────────────────────────────────────────────────────────

    def test_complete_creates_a_passwordless_verified_teen_and_returns_tokens(self):
        self._start()
        res = self._complete(_SENT[0]['code'], gender='female', date_of_birth='2010-05-01')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)

        user = User.objects.get(email=EMAIL)
        self.assertEqual(user.phone, PHONE)
        self.assertEqual(user.role, User.Role.TEEN)
        self.assertTrue(user.is_verified)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(str(user.teen_profile.date_of_birth), '2010-05-01')

    def test_complete_rejects_a_wrong_code_and_creates_nothing(self):
        self._start()
        res = self._complete('000000')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email=EMAIL).exists())

    def test_code_cannot_be_used_twice_through_the_other_destination(self):
        self._start()
        code = _SENT[0]['code']
        self.assertEqual(self._complete(code).status_code, status.HTTP_201_CREATED)
        # Both copies are spent: no live verify code is left for either address.
        self.assertFalse(OTPCode.objects.filter(
            purpose='verify', consumed_at__isnull=True).exists())

    def test_complete_without_start_fails(self):
        res = self._complete('123456')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_complete_signs_in_an_existing_account_instead_of_duplicating(self):
        User.objects.create_user(username='tolu', email=EMAIL, password='x',
                                 first_name='Tolu', last_name='Ade')
        self._start()
        res = self._complete(_SENT[-1]['code'])
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertEqual(User.objects.filter(email=EMAIL).count(), 1)

    def test_existing_phone_in_local_format_is_recognised(self):
        User.objects.create_user(username='old', email='old@example.com', password='x',
                                 first_name='Old', last_name='User', phone='08031234567')
        self._start(email='different@example.com')
        self.assertEqual([m['purpose'] for m in _SENT], ['login'])

    def test_complete_records_the_church(self):
        national = services.create_root('RCCG National')
        region = services.add_child(national, NodeType.REGION, 'Region 63')
        province = services.add_child(region, NodeType.PROVINCE, 'Lagos Province 69')
        zone = services.add_child(province, NodeType.ZONE, 'Zone 4')
        area = services.add_child(zone, NodeType.AREA, 'Area 2')
        parish = services.add_child(area, NodeType.PARISH, 'Victory House')

        self._start()
        res = self._complete(_SENT[0]['code'], church_node=str(parish.id))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email=EMAIL)
        membership = Membership.objects.get(user=user)
        self.assertEqual(membership.organization_node_id, parish.id)
        self.assertTrue(membership.is_primary)
        self.assertEqual(user.parish, 'Victory House')
        self.assertEqual(user.zone, 'Zone 4')
        self.assertEqual(user.area, 'Area 2')
        self.assertEqual(user.province, User.Province.LAGOS_PROVINCE_69)

    def test_complete_rejects_an_unknown_church(self):
        self._start()
        res = self._complete(_SENT[0]['code'],
                             church_node='00000000-0000-0000-0000-000000000000')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email=EMAIL).exists())


@override_settings(OTP_PROVIDER='users.test_signup.CapturingProvider', CACHES=_LOCMEM)
class SignInIdentifierTests(APITestCase):
    """The app's sign-in field takes an email or a phone as well as a username."""

    def setUp(self):
        cache.clear()
        _SENT.clear()
        self.user = User.objects.create_user(
            username='tolu', email=EMAIL, password='correct-horse-9',
            first_name='Tolu', last_name='Ade', phone='08031234567',
        )

    def _login(self, identifier):
        return self.client.post('/api/v1/auth/login/',
                                {'username': identifier, 'password': 'correct-horse-9'},
                                format='json')

    def test_password_login_by_username_email_or_phone(self):
        for identifier in ('tolu', EMAIL, 'TOLU@example.com', '08031234567', PHONE):
            self.assertEqual(self._login(identifier).status_code, status.HTTP_200_OK, identifier)

    def test_unknown_identifier_still_fails_the_same_way(self):
        res = self._login('nobody@example.com')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_code_login_finds_a_phone_stored_in_local_format(self):
        res = self.client.post('/api/v1/auth/otp/request/',
                               {'destination': PHONE, 'channel': 'sms', 'purpose': 'login'},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(_SENT), 1)
        res = self.client.post('/api/v1/auth/otp/verify/',
                               {'destination': PHONE, 'purpose': 'login', 'code': _SENT[0]['code']},
                               format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
