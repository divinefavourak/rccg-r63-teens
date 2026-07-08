"""
Church hierarchy — organizational structure only.

Models the org tree (National -> Region -> Province -> Zone -> Area -> Parish ->
Department). Identity, membership and authorization live in the `identity` app,
which sits on top of this one (identity depends on hierarchy, never the reverse).
All tree mutation/traversal goes through `hierarchy.services`.
"""
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from treebeard.mp_tree import MP_Node


class NodeType(models.TextChoices):
    """Levels of the RCCG organizational hierarchy, top-down."""
    NATIONAL = 'national', 'National'
    REGION = 'region', 'Region'
    PROVINCE = 'province', 'Province'
    ZONE = 'zone', 'Zone'
    AREA = 'area', 'Area'
    PARISH = 'parish', 'Parish'
    DEPARTMENT = 'department', 'Department'


# Ordered top-down. A node's type must be exactly one level below its parent's.
NODE_LEVEL_ORDER = [
    NodeType.NATIONAL,
    NodeType.REGION,
    NodeType.PROVINCE,
    NodeType.ZONE,
    NodeType.AREA,
    NodeType.PARISH,
    NodeType.DEPARTMENT,
]


def child_type_of(parent_type):
    """The single node_type permitted directly beneath ``parent_type`` (or None)."""
    idx = NODE_LEVEL_ORDER.index(NodeType(parent_type))
    if idx + 1 >= len(NODE_LEVEL_ORDER):
        return None
    return NODE_LEVEL_ORDER[idx + 1]


def validate_parent_child(parent_type, child_type):
    """Raise ValidationError unless ``child_type`` may sit directly under ``parent_type``.

    Lives on the model (not the service layer) so it is enforced everywhere a
    node is created or moved — including the Django admin's treebeard move form,
    which bypasses ``hierarchy.services`` entirely.
    """
    expected = child_type_of(parent_type)
    if expected is None:
        raise ValidationError(f'{NodeType(parent_type).label} nodes cannot have children.')
    if NodeType(child_type) != expected:
        raise ValidationError(
            f'A {NodeType(child_type).label} cannot be a child of a '
            f'{NodeType(parent_type).label}; expected a {expected.label}.'
        )


class HierarchyNode(MP_Node):
    """
    A single organizational unit in the church tree.

    Backed by treebeard's materialized-path implementation for cheap subtree
    queries and correct re-pathing when a node moves. Do not call treebeard
    methods (`add_child`, `move`, ...) directly from application code — use
    `hierarchy.services` so the level invariant is always enforced.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    node_type = models.CharField(max_length=20, choices=NodeType.choices, db_index=True)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, blank=True, db_index=True)
    # Optional external/church code, used to match rows during CSV reconciliation.
    code = models.CharField(max_length=100, blank=True, db_index=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Siblings are kept ordered by name (treebeard "sorted tree").
    node_order_by = ['name']

    class Meta:
        verbose_name = 'Hierarchy Node'
        verbose_name_plural = 'Hierarchy Nodes'
        indexes = [
            models.Index(fields=['node_type']),
            models.Index(fields=['code']),
        ]

    def __str__(self):
        return f'{self.get_node_type_display()}: {self.name}'

    def clean(self):
        """Enforce the level invariant for any node already placed in the tree."""
        super().clean()
        if not self.pk:
            return
        try:
            is_root = self.is_root()
        except Exception:
            return
        if is_root:
            if NodeType(self.node_type) != NodeType.NATIONAL:
                raise ValidationError('The root node must be of type National.')
            return
        parent = self.get_parent()
        if parent is not None:
            validate_parent_child(parent.node_type, self.node_type)
