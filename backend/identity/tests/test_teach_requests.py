"""
"Do you teach at church?" at sign-up, and how a coordinator answers it.

Saying yes grants nothing; it reaches the nearest coordinator, who gives the
role or says no in People. Also: coordinators can correct a username.
"""
from datetime import date

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from identity.authorization import set_membership
from identity.models import Role, RoleAssignment
from identity.tests.base import build_tree, make_user, seed_rbac
from notifications.models import Notification
from users.models import User
from users.test_signup import _LOCMEM, _SENT

START = '/api/v1/auth/signup/start/'
COMPLETE = '/api/v1/auth/signup/complete/'
PEOPLE = '/api/v1/identity/memberships/'


def born_years_ago(years):
    today = date.today()
    return date(today.year - years, 1, 1).isoformat()


@override_settings(OTP_PROVIDER='users.test_signup.CapturingProvider', CACHES=_LOCMEM)
class AskToTeachTests(APITestCase):

    def setUp(self):
        cache.clear()
        _SENT.clear()
        seed_rbac()
        self.tree = build_tree()
        self.province = make_user('province')
        set_membership(self.province, self.tree['prov'], is_primary=True)
        RoleAssignment.objects.create(
            user=self.province, node=self.tree['prov'],
            role=Role.objects.get(code='province_coordinator'))
        self.regional = make_user('regional')
        set_membership(self.regional, self.tree['r1'], is_primary=True)
        RoleAssignment.objects.create(
            user=self.regional, node=self.tree['r1'],
            role=Role.objects.get(code='regional_coordinator'))

    def sign_up(self, age, asks=True):
        self.client.post(START, {'email': 'ada@example.com', 'phone': '08031234567'}, format='json')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(COMPLETE, {
                'email': 'ada@example.com', 'phone': '08031234567', 'code': _SENT[0]['code'],
                'first_name': 'Ada', 'last_name': 'Obi',
                'date_of_birth': born_years_ago(age),
                'church_node': str(self.tree['parish_a'].pk),
                'asks_to_teach': asks,
            }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.client.force_authenticate(None)
        return User.objects.get(email='ada@example.com')

    def test_an_adult_who_teaches_is_recorded_and_the_nearest_coordinator_told(self):
        ada = self.sign_up(48)
        self.assertIsNotNone(ada.asked_to_teach_at)
        # Nothing granted: a request, not a role.
        self.assertFalse(RoleAssignment.objects.filter(user=ada).exists())
        told = set(Notification.objects.filter(title__contains='says they teach')
                   .values_list('user__username', flat=True))
        self.assertEqual(told, {'province'})

    def test_a_teen_s_answer_is_ignored(self):
        ada = self.sign_up(15)
        self.assertIsNone(ada.asked_to_teach_at)
        self.assertFalse(Notification.objects.filter(title__contains='says they teach').exists())

    def test_no_answers_no(self):
        self.assertIsNone(self.sign_up(48, asks=False).asked_to_teach_at)

    def test_people_lists_them_and_giving_a_role_answers_it(self):
        ada = self.sign_up(30)
        self.client.force_authenticate(self.province)
        rows = self.client.get(PEOPLE, {'asked_to_teach': 'true'}).data['results']
        self.assertEqual([row['user'] for row in rows], [ada.pk])
        self.assertIsNotNone(rows[0]['asked_to_teach_at'])

        response = self.client.post('/api/v1/identity/role-assignments/', {
            'user': str(ada.pk), 'role': str(Role.objects.get(code='teacher').pk),
            'node': str(self.tree['prov'].pk),
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        ada.refresh_from_db()
        self.assertIsNone(ada.asked_to_teach_at)
        self.assertEqual(self.client.get(PEOPLE, {'asked_to_teach': 'true'}).data['results'], [])

    def test_not_a_teacher_answers_it_without_a_role(self):
        ada = self.sign_up(30)
        membership = ada.memberships.get(is_primary=True)
        self.client.force_authenticate(self.province)
        response = self.client.post(f'{PEOPLE}{membership.pk}/decline-teaching/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data['asked_to_teach_at'])
        ada.refresh_from_db()
        self.assertIsNone(ada.asked_to_teach_at)
        self.assertFalse(RoleAssignment.objects.filter(user=ada).exists())

    def test_a_coordinator_elsewhere_cannot_answer_it(self):
        ada = self.sign_up(30)
        membership = ada.memberships.get(is_primary=True)
        stranger = make_user('stranger')
        set_membership(stranger, self.tree['r2'], is_primary=True)
        RoleAssignment.objects.create(
            user=stranger, node=self.tree['r2'],
            role=Role.objects.get(code='regional_coordinator'))
        self.client.force_authenticate(stranger)
        response = self.client.post(f'{PEOPLE}{membership.pk}/decline-teaching/')
        self.assertEqual(response.status_code, 404)
        ada.refresh_from_db()
        self.assertIsNotNone(ada.asked_to_teach_at)


class UsernameEditTests(APITestCase):

    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        self.coordinator = make_user('coord')
        set_membership(self.coordinator, self.tree['prov'], is_primary=True)
        RoleAssignment.objects.create(
            user=self.coordinator, node=self.tree['prov'],
            role=Role.objects.get(code='province_coordinator'))
        self.teen = make_user('ada482913')
        set_membership(self.teen, self.tree['parish_a'], is_primary=True)
        self.client.force_authenticate(self.coordinator)

    def patch(self, username):
        return self.client.patch(f'/api/v1/auth/users/{self.teen.pk}/', {'username': username})

    def test_a_coordinator_can_change_a_username(self):
        response = self.patch('ada.obi')
        self.assertEqual(response.status_code, 200, response.data)
        self.teen.refresh_from_db()
        self.assertEqual(self.teen.username, 'ada.obi')

    def test_a_taken_username_is_refused_whatever_the_capitals(self):
        make_user('tolu')
        response = self.patch('Tolu')
        self.assertEqual(response.status_code, 400)
        self.assertIn('username', response.data)

    def test_spaces_and_short_names_are_refused(self):
        self.assertEqual(self.patch('ada obi').status_code, 400)
        self.assertEqual(self.patch('ad').status_code, 400)
