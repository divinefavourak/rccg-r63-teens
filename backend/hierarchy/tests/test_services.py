"""Tree invariants, membership, and RBAC evaluation."""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from hierarchy import services
from hierarchy.models import Membership, NodeType, RoleAssignment
from hierarchy.services import Capability

User = get_user_model()


def make_user(username):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x',
        first_name=username.title(), last_name='T',
    )


class TreeInvariantTests(TestCase):
    def test_root_must_be_national(self):
        with self.assertRaises(ValidationError):
            services.create_root('Bad Root', NodeType.REGION)

    def test_child_must_be_exactly_one_level_below(self):
        national = services.create_root('RCCG National')
        # region under national: ok
        region = services.add_child(national, NodeType.REGION, 'Region 63')
        # parish directly under national: rejected
        with self.assertRaises(ValidationError):
            services.add_child(national, NodeType.PARISH, 'Skip Levels')
        # province under region: ok; department under province: rejected
        province = services.add_child(region, NodeType.PROVINCE, 'Lagos Province 9')
        with self.assertRaises(ValidationError):
            services.add_child(province, NodeType.DEPARTMENT, 'Wrong')

    def test_department_sits_under_parish(self):
        national = services.create_root('RCCG National')
        region = services.add_child(national, NodeType.REGION, 'Region 63')
        prov = services.add_child(region, NodeType.PROVINCE, 'P')
        zone = services.add_child(prov, NodeType.ZONE, 'Z')
        area = services.add_child(zone, NodeType.AREA, 'A')
        parish = services.add_child(area, NodeType.PARISH, 'Ikorodu')
        dept = services.add_child(parish, NodeType.DEPARTMENT, 'Choir')
        self.assertTrue(dept.is_descendant_of(parish))

    def test_get_or_create_child_is_idempotent(self):
        national = services.create_root('RCCG National')
        region = services.add_child(national, NodeType.REGION, 'Region 63')
        a, created_a = services.get_or_create_child(region, NodeType.PROVINCE, 'Province 9')
        b, created_b = services.get_or_create_child(region, NodeType.PROVINCE, ' province 9 ')
        self.assertTrue(created_a)
        self.assertFalse(created_b)  # case/space-insensitive match
        self.assertEqual(a.pk, b.pk)


class TreeBuilder:
    """A small two-region tree shared by RBAC tests."""

    def __init__(self):
        self.national = services.create_root('RCCG National')
        self.r1 = services.add_child(self.national, NodeType.REGION, 'Region 63')
        self.r2 = services.add_child(self.national, NodeType.REGION, 'Region 30')
        p1 = services.add_child(self.r1, NodeType.PROVINCE, 'Prov 9')
        z1 = services.add_child(p1, NodeType.ZONE, 'Zone 1')
        self.area_a = services.add_child(z1, NodeType.AREA, 'Area A')
        self.area_b = services.add_child(z1, NodeType.AREA, 'Area B')
        self.parish_a = services.add_child(self.area_a, NodeType.PARISH, 'Parish A')
        p2 = services.add_child(self.r2, NodeType.PROVINCE, 'Prov X')
        z2 = services.add_child(p2, NodeType.ZONE, 'Zone X')
        self.area_x = services.add_child(z2, NodeType.AREA, 'Area X')


class CapabilityTests(TestCase):
    def setUp(self):
        self.t = TreeBuilder()

    def test_coordinator_scoped_to_own_subtree(self):
        coord = make_user('coord')
        services.assign_role(coord, RoleAssignment.Role.COORDINATOR, self.t.area_a)
        # within subtree
        self.assertTrue(services.user_has_capability(coord, Capability.EVENT_MANAGE, self.t.parish_a))
        self.assertTrue(services.user_has_capability(coord, Capability.CONTENT_PUBLISH, self.t.area_a))
        # sibling area — out of scope
        self.assertFalse(services.user_has_capability(coord, Capability.EVENT_MANAGE, self.t.area_b))
        # capability a coordinator never has
        self.assertFalse(services.user_has_capability(coord, Capability.ROLES_ASSIGN, self.t.parish_a))

    def test_multi_region_isolation(self):
        """The docs' tenancy guarantee: no leaking across regions."""
        coord = make_user('coord63')
        services.assign_role(coord, RoleAssignment.Role.COORDINATOR, self.t.area_a)
        self.assertFalse(services.user_has_capability(coord, Capability.EVENT_MANAGE, self.t.area_x))
        self.assertFalse(services.user_has_capability(coord, Capability.EVENT_MANAGE, self.t.r2))

    def test_admin_covers_whole_region_not_the_other(self):
        admin = make_user('admin63')
        services.assign_role(admin, RoleAssignment.Role.ADMIN, self.t.r1)
        self.assertTrue(services.user_has_capability(admin, Capability.ROLES_ASSIGN, self.t.parish_a))
        self.assertFalse(services.user_has_capability(admin, Capability.ROLES_ASSIGN, self.t.area_x))

    def test_teacher_capabilities_are_limited(self):
        teacher = make_user('teacher')
        services.assign_role(teacher, RoleAssignment.Role.TEACHER, self.t.parish_a)
        self.assertTrue(services.user_has_capability(teacher, Capability.EVENT_CHECKIN, self.t.parish_a))
        self.assertFalse(services.user_has_capability(teacher, Capability.EVENT_MANAGE, self.t.parish_a))

    def test_superuser_bypasses(self):
        su = User.objects.create_superuser('root', 'root@example.com', 'x')
        self.assertTrue(services.user_has_capability(su, Capability.ROLES_ASSIGN, self.t.area_x))

    def test_scoped_node_ids(self):
        coord = make_user('coord2')
        services.assign_role(coord, RoleAssignment.Role.COORDINATOR, self.t.area_a)
        ids = services.scoped_node_ids_for(coord)
        self.assertIn(self.t.area_a.pk, ids)
        self.assertIn(self.t.parish_a.pk, ids)
        self.assertNotIn(self.t.area_b.pk, ids)


class MoveRescopesTests(TestCase):
    def test_moving_parish_rescopes_it_under_new_area(self):
        t = TreeBuilder()
        # Coordinator of Area B initially has no authority over Parish A (under Area A).
        coord_b = make_user('coordB')
        services.assign_role(coord_b, RoleAssignment.Role.COORDINATOR, t.area_b)
        self.assertFalse(services.user_has_capability(coord_b, Capability.EVENT_MANAGE, t.parish_a))
        # Move Parish A under Area B.
        moved = services.move_node(t.parish_a, t.area_b)
        self.assertTrue(moved.is_descendant_of(t.area_b))
        # Now the Area B coordinator's authority covers it — members re-scoped automatically.
        self.assertTrue(services.user_has_capability(coord_b, Capability.EVENT_MANAGE, moved))


class MoveValidationTests(TestCase):
    def test_move_to_wrong_parent_type_is_rejected(self):
        t = TreeBuilder()
        # A Parish cannot become a child of a Region.
        with self.assertRaises(ValidationError):
            services.move_node(t.parish_a, t.r1)


class ModelInvariantTests(TestCase):
    def test_clean_rejects_wrong_type_for_placed_node(self):
        t = TreeBuilder()
        # parish_a is correctly under area_a; corrupting its type must fail clean().
        t.parish_a.node_type = NodeType.REGION
        with self.assertRaises(ValidationError):
            t.parish_a.clean()

    def test_clean_passes_for_valid_node(self):
        t = TreeBuilder()
        t.parish_a.clean()  # should not raise


class ScopingTests(TestCase):
    def setUp(self):
        self.t = TreeBuilder()
        self.coord = make_user('coord_scope')
        services.assign_role(self.coord, RoleAssignment.Role.COORDINATOR, self.t.area_a)

    def test_nodes_visible_to_is_subtree_only(self):
        names = set(services.nodes_visible_to(self.coord).values_list('name', flat=True))
        self.assertEqual(names, {'Area A', 'Parish A'})

    def test_scope_queryset_filters_by_path_prefix(self):
        # Members inside vs outside the coordinator's subtree.
        u_in = make_user('inside')
        u_out = make_user('outside')
        services.set_membership(u_in, self.t.parish_a)
        services.set_membership(u_out, self.t.area_b)
        from hierarchy.models import Membership
        visible = services.scope_queryset(
            Membership.objects.all(), self.coord, node_field='node',
            capability=Capability.EVENT_MANAGE)
        usernames = set(visible.values_list('user__username', flat=True))
        self.assertEqual(usernames, {'inside'})

    def test_any_capability_coarse_gate(self):
        self.assertTrue(services.user_has_any_capability(self.coord, Capability.EVENT_MANAGE))
        self.assertFalse(services.user_has_any_capability(self.coord, Capability.ROLES_ASSIGN))
        nobody = make_user('nobody')
        self.assertFalse(services.user_has_any_capability(nobody, Capability.EVENT_MANAGE))


class MembershipTests(TestCase):
    def test_single_home_node_updates_in_place(self):
        t = TreeBuilder()
        u = make_user('teen1')
        services.set_membership(u, t.parish_a, is_provisional=True)
        services.set_membership(u, t.area_a)  # move
        # Read authoritatively from the DB (avoid the reverse-OneToOne cache).
        self.assertEqual(Membership.objects.filter(user=u).count(), 1)
        membership = Membership.objects.get(user=u)
        self.assertEqual(membership.node_id, t.area_a.pk)
        self.assertFalse(membership.is_provisional)
