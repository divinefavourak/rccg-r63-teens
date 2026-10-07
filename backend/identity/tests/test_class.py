"""Tests for My Class: the roster a leader sees, and one teen's read-only page."""
from datetime import date, timedelta

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from common.dates import app_today
from identity.authorization import set_membership
from identity.models import Permission, Role, RoleAssignment, RolePermission
from identity.permissions_registry import Perm
from identity.tests.base import build_tree, make_user
from profiles.models import TeenProfile
from progress.models import ActionType, SpiritualAction


def grant(user, node, *codes, role_code=None):
    role, _ = Role.objects.get_or_create(
        code=role_code or f'test-{user.username}', defaults={'label': 'Test role'})
    for code in codes:
        permission, _ = Permission.objects.get_or_create(
            code=code, defaults={'label': code})
        RolePermission.objects.get_or_create(role=role, permission=permission)
    RoleAssignment.objects.get_or_create(user=user, role=role, node=node)


def make_teen(username, node, **profile):
    user = make_user(username)
    TeenProfile.objects.update_or_create(
        user=user, defaults={'gender': 'female', **profile})
    set_membership(user, node, is_primary=True)
    return user


def read_on(user, day, action_type=ActionType.DEVOTIONAL_COMPLETED):
    """Log reading straight into the stream; streak bookkeeping is not under test."""
    SpiritualAction.objects.create(user=user, action_type=action_type, occurred_on=day)


class ClassRosterTests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        self.client = APIClient()

        self.teacher = make_teen('ngozi', self.tree['parish_a'])
        grant(self.teacher, self.tree['parish_a'], Perm.PROFILES_VIEW, Perm.USERS_VIEW)
        self.client.force_authenticate(self.teacher)

        self.tolu = make_teen(
            'tolu', self.tree['parish_a'], date_of_birth=date(2011, 1, 1),
            guardian_name='Mrs Adeyemi', guardian_phone='0805 555 0166',
            guardian_relationship='Mother')
        self.amaka = make_teen('amaka', self.tree['parish_a'])
        # Same zone, different area: not this teacher's class.
        self.outsider = make_teen('zainab', self.tree['area_b'])

        self.today = app_today()
        self.monday = self.today - timedelta(days=self.today.weekday())

    def roster(self):
        response = self.client.get(reverse('identity-class'))
        self.assertEqual(response.status_code, 200)
        return response.data

    def names(self):
        return [member['name'] for member in self.roster()['members']]

    def test_lists_the_teens_in_my_parish_and_nobody_else(self):
        self.assertEqual(self.names(), ['Amaka T', 'Tolu T'])
        self.assertEqual(self.roster()['total'], 2)

    def test_a_fellow_leader_is_not_in_the_class(self):
        colleague = make_teen('chidi', self.tree['parish_a'])
        grant(colleague, self.tree['parish_a'], Perm.CONTENT_VIEW)

        self.assertNotIn('Chidi T', self.names())

    def test_holding_only_the_teen_role_keeps_someone_in_the_class(self):
        grant(self.tolu, self.tree['parish_a'], role_code='teen')

        self.assertIn('Tolu T', self.names())

    def test_a_second_parish_does_not_list_a_teen_twice(self):
        """Home membership only."""
        visitor = make_teen('dayo', self.tree['area_b'])
        set_membership(visitor, self.tree['parish_a'], is_primary=False)

        self.assertNotIn('Dayo T', self.names())

    def test_the_week_is_seven_days_from_monday(self):
        read_on(self.tolu, self.monday)
        read_on(self.tolu, self.monday, ActionType.CHAPTER_READ)  # same day, once
        read_on(self.tolu, self.monday - timedelta(days=1))       # last week

        tolu = next(m for m in self.roster()['members'] if m['name'] == 'Tolu T')

        self.assertEqual(tolu['week'], [True] + [False] * 6)
        self.assertEqual(tolu['days_this_week'], 1)
        self.assertEqual(tolu['last_read_on'], self.monday)

    def test_read_today_is_counted_for_the_card(self):
        read_on(self.tolu, self.today)

        data = self.roster()

        self.assertEqual(data['read_today'], 1)
        tolu = next(m for m in data['members'] if m['name'] == 'Tolu T')
        amaka = next(m for m in data['members'] if m['name'] == 'Amaka T')
        self.assertTrue(tolu['read_today'])
        self.assertFalse(amaka['read_today'])

    def test_a_memory_verse_review_is_not_reading(self):
        read_on(self.tolu, self.today, ActionType.VERSE_REVIEWED)

        self.assertEqual(self.roster()['read_today'], 0)

    def test_a_profile_without_a_birthday_has_no_age_rather_than_a_crash(self):
        amaka = next(m for m in self.roster()['members'] if m['name'] == 'Amaka T')

        self.assertIsNone(amaka['age'])

    def test_a_teen_cannot_see_a_class(self):
        self.client.force_authenticate(self.tolu)

        response = self.client.get(reverse('identity-class'))

        self.assertEqual(response.status_code, 403)

    def test_a_coordinator_sees_the_whole_subtree(self):
        coordinator = make_teen('ada', self.tree['prov'])
        grant(coordinator, self.tree['prov'], Perm.PROFILES_VIEW)
        self.client.force_authenticate(coordinator)

        self.assertEqual(self.names(), ['Amaka T', 'Tolu T', 'Zainab T'])


class ClassMemberTests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        self.client = APIClient()
        self.teacher = make_teen('ngozi', self.tree['parish_a'])
        grant(self.teacher, self.tree['parish_a'], Perm.PROFILES_VIEW)
        self.client.force_authenticate(self.teacher)

        self.tolu = make_teen(
            'tolu', self.tree['parish_a'], guardian_name='Mrs Adeyemi',
            guardian_phone='0805 555 0166', guardian_relationship='Mother')
        self.outsider = make_teen('zainab', self.tree['area_b'], guardian_phone='0800')

    def test_shows_a_guardian_to_call(self):
        response = self.client.get(reverse('identity-class-member', args=[self.tolu.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Tolu T')
        self.assertEqual(response.data['guardian_name'], 'Mrs Adeyemi')
        self.assertEqual(response.data['guardian_phone'], '0805 555 0166')
        self.assertEqual(response.data['parish'], 'Parish A')

    def test_never_exposes_medical_details(self):
        TeenProfile.objects.filter(user=self.tolu).update(allergies='Peanuts')

        response = self.client.get(reverse('identity-class-member', args=[self.tolu.pk]))

        self.assertNotIn('allergies', response.data)
        self.assertNotIn('medical_conditions', response.data)

    def test_a_teen_in_another_parish_404s(self):
        response = self.client.get(
            reverse('identity-class-member', args=[self.outsider.pk]))

        self.assertEqual(response.status_code, 404)

    def test_a_teen_cannot_look_up_a_classmate(self):
        self.client.force_authenticate(self.tolu)

        response = self.client.get(reverse('identity-class-member', args=[self.tolu.pk]))

        self.assertEqual(response.status_code, 403)
