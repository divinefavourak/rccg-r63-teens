from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from identity.models import Membership, Profile, Role, RoleAssignment
from .base import build_tree, make_user, seed_rbac

BASE = '/api/v1/identity'

# Use an in-process cache so API tests (which exercise DRF throttling) don't
# depend on a running Redis.
_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


@override_settings(CACHES=_LOCMEM)
class IdentityApiTests(APITestCase):
    def setUp(self):
        seed_rbac()
        self.t = build_tree()
        self.teen = make_user('tolu')
        self.coord = make_user('chinedu')
        RoleAssignment.objects.create(
            user=self.coord, role=Role.objects.get(code='regional_coordinator'), node=self.t['r1'])

    def test_me_returns_identity_bundle(self):
        self.client.force_authenticate(self.coord)
        res = self.client.get(f'{BASE}/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('permissions', res.data)
        self.assertIn('memberships', res.data)
        self.assertTrue(len(res.data['role_assignments']) >= 1)

    def test_profile_get_and_patch(self):
        self.client.force_authenticate(self.teen)
        res = self.client.patch(f'{BASE}/profile/', {'bio': 'Hello'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Profile.objects.get(user=self.teen).bio, 'Hello')

    def test_roles_list_requires_permission(self):
        self.client.force_authenticate(self.teen)
        self.assertEqual(self.client.get(f'{BASE}/roles/').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.coord)
        self.assertEqual(self.client.get(f'{BASE}/roles/').status_code, status.HTTP_200_OK)

    def test_role_assignment_create_authorized(self):
        self.client.force_authenticate(self.coord)  # regional_coordinator, has roles.assign
        target = make_user('newleader')
        province_role = Role.objects.get(code='province_coordinator')
        res = self.client.post(f'{BASE}/role-assignments/', {
            'user': str(target.id), 'role': str(province_role.id), 'node': str(self.t['prov'].id),
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(RoleAssignment.objects.filter(user=target, role=province_role).exists())

    def test_role_assignment_create_denied_for_non_leader(self):
        self.client.force_authenticate(self.teen)
        province_role = Role.objects.get(code='province_coordinator')
        res = self.client.post(f'{BASE}/role-assignments/', {
            'user': str(make_user('x').id), 'role': str(province_role.id),
            'node': str(self.t['prov'].id),
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_membership_list_is_scoped(self):
        inside = make_user('inside')
        outside = make_user('outside')
        Membership.objects.create(user=inside, organization_node=self.t['parish_a'])
        Membership.objects.create(user=outside, organization_node=self.t['r2'])
        self.client.force_authenticate(self.coord)
        res = self.client.get(f'{BASE}/memberships/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data.get('results', res.data)
        # inside is within region 63; outside (region 30) must not appear.
        node_ids = {str(m['organization_node']) for m in rows}
        self.assertIn(str(self.t['parish_a'].id), node_ids)
        self.assertNotIn(str(self.t['r2'].id), node_ids)
