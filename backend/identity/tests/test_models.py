from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from identity.models import Membership, Profile, Role, RoleAssignment
from .base import build_tree, make_user, seed_rbac


class ProfileTests(TestCase):
    def test_profile_is_one_per_user(self):
        u = make_user('tolu')
        Profile.objects.create(user=u, display_name='Tolu')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Profile.objects.create(user=u)


class MembershipConstraintTests(TestCase):
    def setUp(self):
        self.t = build_tree()
        self.u = make_user('tolu')

    def test_only_one_active_primary_per_user(self):
        Membership.objects.create(user=self.u, organization_node=self.t['parish_a'], is_primary=True)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Membership.objects.create(user=self.u, organization_node=self.t['area_a'], is_primary=True)

    def test_no_duplicate_active_membership_per_node(self):
        Membership.objects.create(user=self.u, organization_node=self.t['parish_a'])
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Membership.objects.create(user=self.u, organization_node=self.t['parish_a'])


class RoleValidationTests(TestCase):
    def test_clean_rejects_unknown_node_type(self):
        r = Role(code='weird', label='Weird', allowed_node_types=['galaxy'])
        with self.assertRaises(ValidationError):
            r.clean()

    def test_clean_accepts_valid_node_types(self):
        Role(code='ok', label='OK', allowed_node_types=['region', 'parish']).clean()


class RoleAssignmentValidationTests(TestCase):
    def setUp(self):
        seed_rbac()
        self.t = build_tree()
        self.u = make_user('emeka')

    def test_role_rejected_at_wrong_node_level(self):
        regional = Role.objects.get(code='regional_coordinator')
        ra = RoleAssignment(user=self.u, role=regional, node=self.t['parish_a'])
        with self.assertRaises(ValidationError):
            ra.clean()

    def test_role_allowed_at_correct_level(self):
        regional = Role.objects.get(code='regional_coordinator')
        RoleAssignment(user=self.u, role=regional, node=self.t['r1']).clean()  # no raise

    def test_end_before_start_rejected(self):
        role = Role.objects.get(code='teacher')
        today = timezone.localdate()
        ra = RoleAssignment(user=self.u, role=role, node=self.t['parish_a'],
                            start_date=today, end_date=today - timedelta(days=1))
        with self.assertRaises(ValidationError):
            ra.clean()

    def test_is_current_respects_window(self):
        role = Role.objects.get(code='teacher')
        today = timezone.localdate()
        past = RoleAssignment.objects.create(
            user=self.u, role=role, node=self.t['parish_a'],
            start_date=today - timedelta(days=10), end_date=today - timedelta(days=1))
        self.assertFalse(past.is_current)
