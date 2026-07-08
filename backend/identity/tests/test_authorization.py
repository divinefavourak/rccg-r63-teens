from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from identity import authorization as authz
from identity.authorization import HasPermission
from identity.models import Membership, Role, RoleAssignment
from identity.permissions_registry import Perm
from .base import build_tree, make_user, seed_rbac


class AuthorizationTests(TestCase):
    def setUp(self):
        seed_rbac()
        self.t = build_tree()
        self.regional = Role.objects.get(code='regional_coordinator')
        self.province = Role.objects.get(code='province_coordinator')
        self.superadmin = Role.objects.get(code='super_admin')

    def _assign(self, user, role, node):
        return RoleAssignment.objects.create(user=user, role=role, node=node)

    def test_permission_scoped_to_subtree(self):
        u = make_user('coord')
        self._assign(u, self.regional, self.t['r1'])
        self.assertTrue(authz.has_permission(u, Perm.USERS_MANAGE, self.t['parish_a']))  # in region
        self.assertTrue(authz.has_permission(u, Perm.USERS_MANAGE, self.t['area_b']))
        self.assertFalse(authz.has_permission(u, Perm.USERS_MANAGE, self.t['r2']))       # other region
        self.assertFalse(authz.has_permission(u, Perm.ROLES_MANAGE, self.t['parish_a'])) # not granted

    def test_has_any_permission_coarse(self):
        u = make_user('coord2')
        self._assign(u, self.regional, self.t['r1'])
        self.assertTrue(authz.has_any_permission(u, Perm.USERS_MANAGE))
        self.assertFalse(authz.has_any_permission(u, Perm.ROLES_MANAGE))
        self.assertFalse(authz.has_any_permission(make_user('nobody'), Perm.USERS_VIEW))

    def test_inactive_assignment_confers_nothing(self):
        u = make_user('expired')
        ra = self._assign(u, self.regional, self.t['r1'])
        ra.is_active = False
        ra.save(update_fields=['is_active'])
        self.assertFalse(authz.has_permission(u, Perm.USERS_MANAGE, self.t['parish_a']))

    def test_scope_queryset_filters_memberships(self):
        coord = make_user('coord3')
        self._assign(coord, self.regional, self.t['r1'])
        inside = make_user('inside')
        outside = make_user('outside')
        Membership.objects.create(user=inside, organization_node=self.t['parish_a'])
        Membership.objects.create(user=outside, organization_node=self.t['r2'])
        visible = authz.scope_queryset(
            Membership.objects.all(), coord, Perm.MEMBERSHIPS_VIEW, node_field='organization_node')
        self.assertEqual(set(visible.values_list('user__username', flat=True)), {'inside'})

    def test_effective_permissions_union(self):
        u = make_user('coord4')
        self._assign(u, self.province, self.t['prov'])
        perms = set(authz.effective_permissions(u))
        self.assertIn(Perm.MEMBERSHIPS_MANAGE, perms)
        self.assertNotIn(Perm.ROLES_MANAGE, perms)

    def test_assign_role_validates_node_level(self):
        u = make_user('target')
        with self.assertRaises(ValidationError):
            authz.assign_role(u, self.regional, self.t['parish_a'])  # regional at parish

    def test_escalation_blocked(self):
        actor = make_user('actor')
        self._assign(actor, self.regional, self.t['r1'])  # has roles.assign in region
        target = make_user('target2')
        # regional can grant province_coordinator (subset of its perms)...
        authz.assign_role(target, self.province, self.t['prov'], appointed_by=actor)
        self.assertTrue(RoleAssignment.objects.filter(user=target, role=self.province).exists())
        # ...but NOT super_admin (perms it does not itself hold).
        with self.assertRaises(ValidationError):
            authz.assign_role(target, self.superadmin, self.t['national'], appointed_by=actor)

    def test_assign_role_preserves_start_date_on_regrant(self):
        from datetime import timedelta
        from django.utils import timezone
        u = make_user('regrant')
        earlier = timezone.localdate() - timedelta(days=30)
        authz.assign_role(u, self.province, self.t['prov'], start_date=earlier)
        authz.assign_role(u, self.province, self.t['prov'])  # idempotent re-grant
        ra = RoleAssignment.objects.get(user=u, role=self.province, node=self.t['prov'], is_active=True)
        self.assertEqual(ra.start_date, earlier)

    def test_revoke_preserves_history(self):
        u = make_user('rev')
        ra = self._assign(u, self.regional, self.t['r1'])
        authz.revoke_role(ra)
        ra.refresh_from_db()
        self.assertFalse(ra.is_active)
        self.assertIsNotNone(ra.end_date)


class TransferTests(TestCase):
    def setUp(self):
        self.t = build_tree()

    def test_transfer_moves_primary_and_logs(self):
        from identity.models import MembershipTransfer
        u = make_user('mover')
        authz.set_membership(u, self.t['parish_a'], is_primary=True)
        authz.transfer_primary_membership(u, self.t['area_b'], reason='moved parish')
        m = Membership.objects.get(user=u, is_primary=True, is_active=True)
        self.assertEqual(m.organization_node_id, self.t['area_b'].pk)
        self.assertEqual(MembershipTransfer.objects.filter(user=u).count(), 1)

    def test_transfer_to_node_with_existing_membership(self):
        """Transferring to a node the user already belongs to must not violate the
        unique (user, organization_node) constraint."""
        u = make_user('mover2')
        authz.set_membership(u, self.t['parish_a'], is_primary=True)
        authz.set_membership(u, self.t['area_b'])  # pre-existing non-primary at destination
        authz.transfer_primary_membership(u, self.t['area_b'])  # must not raise
        active_at_dest = Membership.objects.filter(
            user=u, organization_node=self.t['area_b'], is_active=True)
        self.assertEqual(active_at_dest.count(), 1)
        self.assertTrue(active_at_dest.first().is_primary)


class HasPermissionDRFTests(TestCase):
    def setUp(self):
        seed_rbac()
        self.t = build_tree()
        self.factory = APIRequestFactory()
        self.coord = make_user('coord')
        RoleAssignment.objects.create(
            user=self.coord, role=Role.objects.get(code='regional_coordinator'), node=self.t['r1'])

    def _req(self, user):
        r = self.factory.get('/')
        r.user = user
        return r

    def test_coarse_gate_denies_non_leader(self):
        perm = HasPermission(Perm.USERS_MANAGE)()
        self.assertFalse(perm.has_permission(self._req(make_user('teen')), object()))

    def test_coarse_gate_allows_leader(self):
        perm = HasPermission(Perm.USERS_MANAGE)()
        self.assertTrue(perm.has_permission(self._req(self.coord), object()))

    def test_object_permission_scoped(self):
        perm = HasPermission(Perm.MEMBERSHIPS_VIEW)()
        m_in = Membership.objects.create(user=make_user('a'), organization_node=self.t['parish_a'])
        m_out = Membership.objects.create(user=make_user('b'), organization_node=self.t['r2'])
        self.assertTrue(perm.has_object_permission(self._req(self.coord), None, m_in))
        self.assertFalse(perm.has_object_permission(self._req(self.coord), None, m_out))
