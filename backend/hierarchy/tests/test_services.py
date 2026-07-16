"""Tree invariants and structural operations (authz tests live in identity)."""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from hierarchy import services
from hierarchy.models import NodeType

User = get_user_model()


class TreeInvariantTests(TestCase):
    def test_root_must_be_national(self):
        with self.assertRaises(ValidationError):
            services.create_root('Bad Root', NodeType.REGION)

    def test_child_must_be_exactly_one_level_below(self):
        national = services.create_root('RCCG National')
        region = services.add_child(national, NodeType.REGION, 'Region 63')
        with self.assertRaises(ValidationError):
            services.add_child(national, NodeType.PARISH, 'Skip Levels')
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
    """A small tree used by the structural tests below (and by identity tests)."""

    def __init__(self):
        self.national = services.create_root('RCCG National')
        self.r1 = services.add_child(self.national, NodeType.REGION, 'Region 63')
        p1 = services.add_child(self.r1, NodeType.PROVINCE, 'Prov 9')
        z1 = services.add_child(p1, NodeType.ZONE, 'Zone 1')
        self.area_a = services.add_child(z1, NodeType.AREA, 'Area A')
        self.area_b = services.add_child(z1, NodeType.AREA, 'Area B')
        self.parish_a = services.add_child(self.area_a, NodeType.PARISH, 'Parish A')


class MoveValidationTests(TestCase):
    def test_move_to_wrong_parent_type_is_rejected(self):
        t = TreeBuilder()
        with self.assertRaises(ValidationError):
            services.move_node(t.parish_a, t.r1)

    def test_move_reparents_subtree(self):
        t = TreeBuilder()
        moved = services.move_node(t.parish_a, t.area_b)
        self.assertTrue(moved.is_descendant_of(t.area_b))


class ModelInvariantTests(TestCase):
    def test_clean_rejects_wrong_type_for_placed_node(self):
        t = TreeBuilder()
        t.parish_a.node_type = NodeType.REGION
        with self.assertRaises(ValidationError):
            t.parish_a.clean()

    def test_clean_passes_for_valid_node(self):
        t = TreeBuilder()
        t.parish_a.clean()  # should not raise
