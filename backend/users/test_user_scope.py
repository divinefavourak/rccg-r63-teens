"""
User management reaches only the part of the tree where it is held, and only a
superuser can make a superuser.

Before November 2026 anyone holding users.manage anywhere could list, edit and
delete every account, and could make anyone a superuser by setting the legacy
role to `admin`.
"""
from rest_framework.test import APITestCase

from hierarchy import services
from hierarchy.models import NodeType
from identity.authorization import set_membership
from identity.models import Role, RoleAssignment
from identity.tests.base import build_tree, make_user, seed_rbac
from users.models import LoginHistory, User


class UserScopeTests(APITestCase):

    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        # A province coordinator for Prov 9, with the role as seeded.
        self.coordinator = make_user('coord')
        set_membership(self.coordinator, self.tree['prov'], is_primary=True)
        RoleAssignment.objects.create(
            user=self.coordinator, node=self.tree['prov'],
            role=Role.objects.get(code='province_coordinator'))
        # One teen in their province, one in another region.
        self.mine = make_user('mine')
        set_membership(self.mine, self.tree['parish_a'], is_primary=True)
        self.elsewhere = make_user('elsewhere')
        set_membership(self.elsewhere, self.tree['r2'], is_primary=True)
        self.client.force_authenticate(self.coordinator)

    def url(self, user):
        return f'/api/v1/auth/users/{user.pk}/'

    def listed_ids(self):
        response = self.client.get('/api/v1/auth/users/', {'page_size': 500})
        self.assertEqual(response.status_code, 200)
        rows = response.data['results'] if isinstance(response.data, dict) else response.data
        return {str(row['id']) for row in rows}

    # --- scope ---------------------------------------------------------------

    def test_the_list_holds_their_province_and_themselves_only(self):
        ids = self.listed_ids()
        self.assertIn(str(self.mine.pk), ids)
        self.assertIn(str(self.coordinator.pk), ids)
        self.assertNotIn(str(self.elsewhere.pk), ids)

    def test_someone_in_their_province_can_be_edited(self):
        response = self.client.patch(self.url(self.mine), {'phone': '08030000000'})
        self.assertEqual(response.status_code, 200, response.data)
        self.mine.refresh_from_db()
        self.assertEqual(self.mine.phone, '08030000000')

    def test_someone_elsewhere_cannot_be_read_edited_or_deleted(self):
        self.assertEqual(self.client.get(self.url(self.elsewhere)).status_code, 404)
        self.assertEqual(
            self.client.patch(self.url(self.elsewhere), {'phone': '08030000000'}).status_code, 404)
        self.assertEqual(self.client.delete(self.url(self.elsewhere)).status_code, 404)
        self.assertTrue(User.objects.filter(pk=self.elsewhere.pk).exists())

    def test_login_history_is_their_province_only(self):
        LoginHistory.objects.create(user=self.mine, ip_address='10.0.0.1')
        LoginHistory.objects.create(user=self.elsewhere, ip_address='10.0.0.2')
        response = self.client.get('/api/v1/auth/login-history/')
        self.assertEqual(response.status_code, 200)
        rows = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual({row['ip_address'] for row in rows}, {'10.0.0.1'})

    # --- superuser ---------------------------------------------------------------

    def test_a_coordinator_cannot_make_anyone_an_administrator(self):
        response = self.client.patch(self.url(self.mine), {'role': 'admin'})
        self.assertEqual(response.status_code, 400)
        self.mine.refresh_from_db()
        self.assertFalse(self.mine.is_superuser)
        self.assertNotEqual(self.mine.role, 'admin')

    def test_nor_themselves(self):
        response = self.client.patch(self.url(self.coordinator), {'role': 'admin'})
        self.assertIn(response.status_code, (400, 403))
        self.coordinator.refresh_from_db()
        self.assertFalse(self.coordinator.is_superuser)

    def test_a_superuser_in_their_province_cannot_be_edited_by_them(self):
        boss = User.objects.create_superuser(username='boss', email='boss@example.com', password='x')
        set_membership(boss, self.tree['parish_a'], is_primary=True)
        response = self.client.patch(self.url(boss), {'is_active': False})
        self.assertEqual(response.status_code, 403)
        boss.refresh_from_db()
        self.assertTrue(boss.is_active)

    def test_editing_a_superuser_s_phone_leaves_them_a_superuser(self):
        boss = User.objects.create_superuser(username='boss', email='boss@example.com', password='x')
        boss.role = User.Role.COORDINATOR  # legacy role that is not `admin`
        boss.save(update_fields=['role'])
        other = User.objects.create_superuser(username='other', email='other@example.com', password='x')
        self.client.force_authenticate(other)
        response = self.client.patch(self.url(boss), {'phone': '08030000001'})
        self.assertEqual(response.status_code, 200, response.data)
        boss.refresh_from_db()
        self.assertTrue(boss.is_superuser)

    # --- appointing a teacher ----------------------------------------------------

    def test_a_province_coordinator_can_appoint_a_teacher_at_their_province(self):
        teacher = Role.objects.get(code='teacher')
        response = self.client.post('/api/v1/identity/role-assignments/', {
            'user': str(self.mine.pk), 'role': str(teacher.pk), 'node': str(self.tree['prov'].pk),
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(RoleAssignment.objects.filter(
            user=self.mine, role=teacher, node=self.tree['prov'], is_active=True).exists())

    def test_but_not_in_another_region(self):
        teacher = Role.objects.get(code='teacher')
        other_province = services.add_child(self.tree['r2'], NodeType.PROVINCE, 'Prov 30')
        response = self.client.post('/api/v1/identity/role-assignments/', {
            'user': str(self.mine.pk), 'role': str(teacher.pk), 'node': str(other_province.pk),
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_nor_a_role_with_more_than_they_hold(self):
        regional = Role.objects.get(code='regional_coordinator')
        response = self.client.post('/api/v1/identity/role-assignments/', {
            'user': str(self.mine.pk), 'role': str(regional.pk), 'node': str(self.tree['r1'].pk),
        }, format='json')
        self.assertEqual(response.status_code, 403)
