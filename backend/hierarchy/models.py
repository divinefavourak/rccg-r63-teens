"""
Church hierarchy models.

The tree models *organizational units only* (National -> Region -> Province ->
Zone -> Area -> Parish -> Department). Users are NOT nodes; they attach to the
tree through `Membership` (where they belong) and `RoleAssignment` (what
authority they hold, and over which subtree). All tree mutation and traversal is
performed through `hierarchy.services` so business logic never depends directly
on treebeard internals.
"""
import uuid

from django.conf import settings
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
# Department is a leaf that hangs off a Parish (index kept adjacent to parish).
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
        """Enforce the level invariant for any node already placed in the tree.

        Covers direct saves and admin edits. New nodes created through the admin
        move form are validated by ``HierarchyNodeAdminForm`` (which knows the
        chosen parent before the node is placed); the service layer validates its
        own creates. Only runs when the node has a resolvable position.
        """
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


class RoleAssignment(models.Model):
    """
    A scoped leadership grant: (user, role, node). "Coordinator of Area X."

    Capabilities are derived from the role and evaluated within the node's
    subtree (see `hierarchy.permissions` and `hierarchy.services`). A user may
    hold several assignments (e.g. Coordinator of an Area and Teacher of a
    Parish). Teen / Super Teen are identity/level on the profile, not scoped
    leadership roles, so they do not live here.
    """

    class Role(models.TextChoices):
        TEACHER = 'teacher', 'Teacher'
        COORDINATOR = 'coordinator', 'Coordinator'
        ADMIN = 'admin', 'Administrator'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='role_assignments',
    )
    role = models.CharField(max_length=20, choices=Role.choices, db_index=True)
    # PROTECT (matching Membership): deleting a node must not silently erase the
    # leadership grants — and their audit trail — attached to it.
    node = models.ForeignKey(
        HierarchyNode,
        on_delete=models.PROTECT,
        related_name='role_assignments',
    )
    is_active = models.BooleanField(default=True, db_index=True)

    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='role_assignments_made',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Role Assignment'
        verbose_name_plural = 'Role Assignments'
        unique_together = [['user', 'role', 'node']]
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['node', 'role']),
        ]

    def __str__(self):
        return f'{self.user} — {self.get_role_display()} @ {self.node}'


class Membership(models.Model):
    """
    Where a user belongs in the tree: exactly one home node (typically a Parish,
    or the region-level 'Unassigned' bucket). Kept as a dedicated model rather
    than a field on User so the entire hierarchy bounded context lives in one
    app and the User model is not coupled to it.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='membership',
    )
    node = models.ForeignKey(
        HierarchyNode,
        on_delete=models.PROTECT,
        related_name='memberships',
    )
    # True while the node was auto-derived and not yet confirmed against an
    # authoritative admin CSV (see docs/design/phase1-hierarchy-rbac.md).
    is_provisional = models.BooleanField(default=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Membership'
        verbose_name_plural = 'Memberships'
        indexes = [
            models.Index(fields=['node']),
        ]

    def __str__(self):
        return f'{self.user} @ {self.node}'
