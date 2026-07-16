"""Tests for the `grant_role` bootstrap command."""
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from identity.models import Role, RoleAssignment
from identity.tests.base import build_tree, make_user, seed_rbac


class GrantRoleCommandTests(TestCase):

    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        self.user = make_user('coordinator')

    def _run(self, *args):
        out = StringIO()
        call_command('grant_role', *args, stdout=out, stderr=out)
        return out.getvalue()

    def test_grants_a_role_at_a_node(self):
        output = self._run('coordinator', 'regional_coordinator', 'Region 63')

        self.assertIn('now holds regional_coordinator', output)
        self.assertTrue(
            RoleAssignment.objects.filter(
                user=self.user,
                role=Role.objects.get(code='regional_coordinator'),
                node=self.tree['r1'],
                is_active=True,
            ).exists()
        )

    def test_regranting_reports_already_held_and_does_not_duplicate(self):
        """
        The branch the dead `assignment.pk` check never reached. assign_role is
        idempotent; the command must say so, and must not create a second row.
        """
        self._run('coordinator', 'regional_coordinator', 'Region 63')
        output = self._run('coordinator', 'regional_coordinator', 'Region 63')

        self.assertIn('already held', output)
        self.assertEqual(
            RoleAssignment.objects.filter(
                user=self.user, node=self.tree['r1'], is_active=True).count(),
            1,
        )

    def test_a_first_grant_does_not_say_already_held(self):
        output = self._run('coordinator', 'regional_coordinator', 'Region 63')

        self.assertNotIn('already held', output)

    def test_resolves_a_user_by_email(self):
        output = self._run('coordinator@example.com', 'regional_coordinator', 'Region 63')

        self.assertIn('now holds', output)

    def test_a_role_at_the_wrong_node_level_is_refused(self):
        """A parish-level role cannot be granted at a region."""
        with self.assertRaisesMessage(CommandError, 'cannot be held at a region'):
            self._run('coordinator', 'teacher', 'Region 63')

    def test_an_unknown_user_is_an_error(self):
        with self.assertRaisesMessage(CommandError, 'No user'):
            self._run('nobody', 'regional_coordinator', 'Region 63')

    def test_an_unknown_role_is_an_error(self):
        with self.assertRaisesMessage(CommandError, 'No role'):
            self._run('coordinator', 'not_a_role', 'Region 63')

    def test_an_unknown_node_is_an_error(self):
        with self.assertRaisesMessage(CommandError, 'No node'):
            self._run('coordinator', 'regional_coordinator', 'Atlantis')

    def test_dry_run_writes_nothing(self):
        self._run('coordinator', 'regional_coordinator', 'Region 63', '--dry-run')

        self.assertFalse(RoleAssignment.objects.filter(user=self.user).exists())
