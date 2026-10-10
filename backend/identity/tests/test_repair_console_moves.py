"""Undoing what the deploy-time backfill did to people changed in the Console."""
from django.core.management import call_command
from django.test import TestCase

from identity import authorization as authz
from identity.models import Membership, Role, RoleAssignment
from .base import build_tree, make_user, seed_rbac


def repair(*args):
    call_command('repair_console_moves', *args, verbosity=0)


class RepairMembershipTests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        self.user = make_user('daniel')
        first = authz.set_membership(self.user, self.tree['area_a'], is_primary=True)
        # Moved in the Console: recorded, the new place is home, the old ended.
        authz.transfer_primary_membership(self.user, self.tree['area_b'])
        Membership.objects.filter(pk=first.pk).update(is_active=False, is_primary=False)

    def put_back_by_the_old_backfill(self):
        return authz.set_membership(self.user, self.tree['area_a'], is_primary=True)

    def active(self):
        return Membership.objects.filter(user=self.user, is_active=True)

    def test_the_place_they_were_moved_to_is_their_only_home_again(self):
        self.put_back_by_the_old_backfill()
        self.assertEqual(self.active().count(), 2)

        repair()

        home = self.active().get()
        self.assertEqual(home.organization_node, self.tree['area_b'])
        self.assertTrue(home.is_primary)

    def test_a_second_run_finds_nothing(self):
        self.put_back_by_the_old_backfill()
        repair()
        before = list(Membership.objects.order_by('pk').values_list('pk', 'is_active', 'is_primary'))

        repair()

        self.assertEqual(
            list(Membership.objects.order_by('pk').values_list('pk', 'is_active', 'is_primary')),
            before)

    def test_a_dry_run_changes_nothing(self):
        self.put_back_by_the_old_backfill()

        repair('--dry-run')

        self.assertEqual(self.active().count(), 2)

    def test_someone_who_was_only_moved_is_left_alone(self):
        repair()

        home = self.active().get()
        self.assertEqual(home.organization_node, self.tree['area_b'])

    def test_a_second_membership_added_on_purpose_is_kept(self):
        # Not a home, so not something the backfill made.
        authz.set_membership(self.user, self.tree['parish_a'])

        repair()

        self.assertEqual(self.active().count(), 2)


class RepairRoleTests(TestCase):

    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        self.user = make_user('chinedu')
        self.role = Role.objects.get(code='province_coordinator')

    def grant(self, **kwargs):
        return RoleAssignment.objects.create(
            user=self.user, role=self.role, node=self.tree['prov'], **kwargs)

    def test_a_revoked_role_granted_again_by_the_backfill_is_revoked(self):
        authz.revoke_role(self.grant())
        self.grant()

        repair()

        self.assertFalse(RoleAssignment.objects.filter(user=self.user, is_active=True).exists())

    def test_a_role_a_person_granted_again_is_kept(self):
        authz.revoke_role(self.grant())
        self.grant(appointed_by=make_user('admin'))

        repair()

        self.assertTrue(RoleAssignment.objects.filter(user=self.user, is_active=True).exists())

    def test_a_role_never_revoked_is_kept(self):
        self.grant()

        repair()

        self.assertTrue(RoleAssignment.objects.filter(user=self.user, is_active=True).exists())
