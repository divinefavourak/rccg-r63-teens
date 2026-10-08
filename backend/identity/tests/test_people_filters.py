from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from identity.models import Membership, Role, RoleAssignment
from .base import build_tree, make_user, seed_rbac

BASE = '/api/v1/identity'

_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


@override_settings(CACHES=_LOCMEM)
class PeopleListFilterTests(APITestCase):
    """The filters the Console's People screen pages, searches and scopes with."""

    def setUp(self):
        seed_rbac()
        self.t = build_tree()
        self.coord = make_user('chinedu')
        RoleAssignment.objects.create(
            user=self.coord, role=Role.objects.get(code='regional_coordinator'),
            node=self.t['r1'])
        self.ngozi = make_user('ngozi')
        self.amaka = make_user('amaka')
        self.outsider = make_user('outsider')
        Membership.objects.create(user=self.ngozi, organization_node=self.t['parish_a'])
        Membership.objects.create(user=self.amaka, organization_node=self.t['area_b'])
        Membership.objects.create(user=self.outsider, organization_node=self.t['r2'])
        self.client.force_authenticate(self.coord)

    def _users(self, res):
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return {str(row['user']) for row in res.data['results']}

    def test_membership_count_is_the_scope_total_not_the_page(self):
        res = self.client.get(f'{BASE}/memberships/', {'page_size': 1})
        self.assertEqual(len(res.data['results']), 1)
        self.assertEqual(res.data['count'], 2)

    def test_membership_search_matches_a_name(self):
        users = self._users(self.client.get(f'{BASE}/memberships/', {'search': 'ngozi'}))
        self.assertEqual(users, {str(self.ngozi.id)})

    def test_membership_node_narrows_to_the_subtree(self):
        users = self._users(
            self.client.get(f'{BASE}/memberships/', {'node': str(self.t['area_a'].id)}))
        self.assertEqual(users, {str(self.ngozi.id)})

    def test_membership_node_cannot_widen_past_the_callers_scope(self):
        users = self._users(
            self.client.get(f'{BASE}/memberships/', {'node': str(self.t['r2'].id)}))
        self.assertEqual(users, set())

    def test_membership_node_that_is_not_an_id_returns_nothing(self):
        users = self._users(self.client.get(f'{BASE}/memberships/', {'node': 'region-63'}))
        self.assertEqual(users, set())

    def test_membership_is_active_filter(self):
        Membership.objects.filter(user=self.amaka).update(is_active=False)
        users = self._users(self.client.get(f'{BASE}/memberships/', {'is_active': 'true'}))
        self.assertEqual(users, {str(self.ngozi.id)})

    def test_role_assignments_for_named_users(self):
        RoleAssignment.objects.create(
            user=self.ngozi, role=Role.objects.get(code='teacher'), node=self.t['parish_a'])
        users = self._users(self.client.get(
            f'{BASE}/role-assignments/', {'users': f'{self.ngozi.id},not-an-id'}))
        self.assertEqual(users, {str(self.ngozi.id)})

    def test_role_assignments_with_no_named_users_returns_nothing(self):
        users = self._users(self.client.get(f'{BASE}/role-assignments/', {'users': ''}))
        self.assertEqual(users, set())
