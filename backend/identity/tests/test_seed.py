from django.test import TestCase

from identity.models import Permission, Role, RolePermission
from identity.permissions_registry import ALL_PERMISSION_CODES, REGISTRY, ROLE_SEED
from .base import seed_rbac


class SeedRbacTests(TestCase):
    def test_seeds_permissions_and_roles(self):
        seed_rbac()
        self.assertEqual(Permission.objects.count(), len(REGISTRY))
        self.assertEqual(Role.objects.count(), len(ROLE_SEED))
        super_admin = Role.objects.get(code='super_admin')
        self.assertEqual(super_admin.permission_codes(), set(ALL_PERMISSION_CODES))
        teen = Role.objects.get(code='teen')
        self.assertEqual(teen.permission_codes(), set())

    def test_is_idempotent(self):
        seed_rbac()
        seed_rbac()
        self.assertEqual(Permission.objects.count(), len(REGISTRY))
        self.assertEqual(Role.objects.count(), len(ROLE_SEED))
        # No duplicate grants.
        sa = Role.objects.get(code='super_admin')
        self.assertEqual(RolePermission.objects.filter(role=sa).count(), len(ALL_PERMISSION_CODES))
