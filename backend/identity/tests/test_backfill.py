from django.core.management import call_command
from django.test import TestCase

from hierarchy.models import NodeType
from identity.models import Membership, RoleAssignment
from .base import make_user, seed_rbac


class DeriveHierarchyTests(TestCase):
    def setUp(self):
        seed_rbac()
        make_user('funmi', role='admin', province='lagos_province_9')
        make_user('chinedu', role='coordinator', province='lagos_province_9',
                  zone='Zone 1', area='Area A')
        make_user('teacher_ok', role='teacher', province='lagos_province_9',
                  zone='Zone 1', area='Area A', parish='Ikorodu')
        make_user('teacher_noparish', role='teacher', province='lagos_province_9',
                  zone='Zone 1', area='Area A')
        make_user('tolu', role='teen', province='lagos_province_9',
                  zone='Zone 1', area='Area A', parish='Ikorodu')
        make_user('nomap', role='teen')

    def test_memberships_and_roles(self):
        call_command('derive_hierarchy', '--region-name', 'Region 63', verbosity=0)

        # Everyone gets exactly one primary membership.
        self.assertEqual(Membership.objects.filter(is_primary=True).count(), 6)
        # Unmatched user in the Unassigned bucket.
        nomap = Membership.objects.get(user__username='nomap')
        self.assertEqual(nomap.organization_node.name, 'Unassigned')

        # Leaders mapped to the right role at the right level.
        self.assertTrue(RoleAssignment.objects.filter(
            user__username='funmi', role__code='regional_coordinator',
            node__node_type=NodeType.REGION).exists())
        self.assertTrue(RoleAssignment.objects.filter(
            user__username='chinedu', role__code='province_coordinator',
            node__node_type=NodeType.PROVINCE).exists())
        self.assertTrue(RoleAssignment.objects.filter(
            user__username='teacher_ok', role__code='teacher',
            node__node_type=NodeType.PARISH).exists())

        # Fail-closed: teacher with no parish gets NO role assignment.
        self.assertFalse(RoleAssignment.objects.filter(user__username='teacher_noparish').exists())
        # Teens get a membership but no leadership role.
        self.assertFalse(RoleAssignment.objects.filter(user__username='tolu').exists())

    def test_is_idempotent(self):
        call_command('derive_hierarchy', verbosity=0)
        memberships = Membership.objects.count()
        assignments = RoleAssignment.objects.count()
        call_command('derive_hierarchy', verbosity=0)
        self.assertEqual(Membership.objects.count(), memberships)
        self.assertEqual(RoleAssignment.objects.count(), assignments)
