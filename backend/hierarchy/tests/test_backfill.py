"""The derive_hierarchy provisional backfill command."""
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from hierarchy.models import HierarchyNode, Membership, NodeType, RoleAssignment

User = get_user_model()


def make_user(username, role='teen', province='', zone='', area='', parish=''):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x',
        first_name=username.title(), last_name='T',
        role=role, province=province, zone=zone, area=area, parish=parish,
    )


class DeriveHierarchyTests(TestCase):
    def setUp(self):
        make_user('tolu', role='teen', province='lagos_province_9',
                  zone='Zone 1', area='Area A', parish='Ikorodu')
        make_user('chinedu', role='coordinator', province='lagos_province_9',
                  zone='Zone 1', area='Area A', parish='Ikorodu')
        make_user('funmi', role='admin', province='lagos_province_9')
        make_user('nomap', role='teen')  # no province -> Unassigned bucket
        # A teacher whose parish is missing: fail-closed -> NO role assignment.
        make_user('teacher_noparish', role='teacher', province='lagos_province_9',
                  zone='Zone 1', area='Area A')

    def test_builds_tree_memberships_and_assignments(self):
        call_command('derive_hierarchy', '--region-name', 'Region 63', verbosity=0)

        # Tree exists with a region and a matched province.
        self.assertTrue(HierarchyNode.objects.filter(node_type=NodeType.NATIONAL).exists())
        self.assertTrue(HierarchyNode.objects.filter(node_type=NodeType.REGION, name='Region 63').exists())
        self.assertTrue(HierarchyNode.objects.filter(
            node_type=NodeType.PROVINCE, name='Lagos Province 9').exists())

        # Every user has a (provisional) membership.
        self.assertEqual(Membership.objects.count(), 5)
        self.assertTrue(all(m.is_provisional for m in Membership.objects.all()))

        # Unmatched user landed in the Unassigned bucket.
        nomap = User.objects.get(username='nomap')
        self.assertEqual(Membership.objects.get(user=nomap).node.name, 'Unassigned')

        # Coordinator is scoped to their AREA (not the whole province).
        self.assertTrue(RoleAssignment.objects.filter(
            user__username='chinedu', role=RoleAssignment.Role.COORDINATOR,
            node__node_type=NodeType.AREA).exists())
        self.assertTrue(RoleAssignment.objects.filter(
            user__username='funmi', role=RoleAssignment.Role.ADMIN,
            node__node_type=NodeType.REGION).exists())
        # Teens get no leadership assignment.
        self.assertFalse(RoleAssignment.objects.filter(user__username='tolu').exists())

    def test_fail_closed_when_data_lacks_required_level(self):
        """A teacher with no parish must NOT be granted a broader-scoped role."""
        call_command('derive_hierarchy', verbosity=0)
        self.assertFalse(
            RoleAssignment.objects.filter(user__username='teacher_noparish').exists())

    def test_is_idempotent(self):
        call_command('derive_hierarchy', verbosity=0)
        nodes_after_first = HierarchyNode.objects.count()
        memberships_after_first = Membership.objects.count()
        assignments_after_first = RoleAssignment.objects.count()

        call_command('derive_hierarchy', verbosity=0)
        self.assertEqual(HierarchyNode.objects.count(), nodes_after_first)
        self.assertEqual(Membership.objects.count(), memberships_after_first)
        self.assertEqual(RoleAssignment.objects.count(), assignments_after_first)

    def test_dry_run_writes_nothing(self):
        call_command('derive_hierarchy', '--dry-run', verbosity=0)
        self.assertEqual(HierarchyNode.objects.count(), 0)
        self.assertEqual(Membership.objects.count(), 0)
