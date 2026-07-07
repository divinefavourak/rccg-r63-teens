"""
Domain services for the church hierarchy.

This module is the *only* place application code should reach for tree mutation,
tree traversal, and RBAC evaluation. It wraps treebeard so business rules (the
level invariant, capability grants) are enforced in one place and callers never
depend on treebeard's API directly.
"""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.text import slugify

from .models import HierarchyNode, Membership, NODE_LEVEL_ORDER, NodeType, RoleAssignment


# ---------------------------------------------------------------------------
# Level invariant
# ---------------------------------------------------------------------------

def _level_index(node_type):
    return NODE_LEVEL_ORDER.index(NodeType(node_type))


def child_type_of(parent_type):
    """The single node_type permitted directly beneath ``parent_type``."""
    idx = _level_index(parent_type)
    if idx + 1 >= len(NODE_LEVEL_ORDER):
        return None
    return NODE_LEVEL_ORDER[idx + 1]


def validate_parent_child(parent_type, child_type):
    """Raise ValidationError unless ``child_type`` may sit directly under ``parent_type``."""
    expected = child_type_of(parent_type)
    if expected is None:
        raise ValidationError(f'{NodeType(parent_type).label} nodes cannot have children.')
    if NodeType(child_type) != expected:
        raise ValidationError(
            f'A {NodeType(child_type).label} cannot be a child of a '
            f'{NodeType(parent_type).label}; expected a {expected.label}.'
        )


# ---------------------------------------------------------------------------
# Tree mutation (wraps treebeard)
# ---------------------------------------------------------------------------

@transaction.atomic
def create_root(name, node_type=NodeType.NATIONAL, code='', slug=''):
    """Create the tree root. Only a NATIONAL node may be a root."""
    if NodeType(node_type) != NodeType.NATIONAL:
        raise ValidationError('The root node must be of type National.')
    return HierarchyNode.add_root(
        node_type=NodeType.NATIONAL,
        name=name,
        code=code,
        slug=slug or slugify(name)[:300],
    )


@transaction.atomic
def add_child(parent, node_type, name, code='', slug=''):
    """Add a child node under ``parent`` after enforcing the level invariant."""
    validate_parent_child(parent.node_type, node_type)
    return parent.add_child(
        node_type=node_type,
        name=name,
        code=code,
        slug=slug or slugify(name)[:300],
    )


@transaction.atomic
def get_or_create_child(parent, node_type, name, code=''):
    """
    Idempotent child creation keyed by (parent, node_type, normalized name).
    Used by the provisional backfill so re-running is safe. Returns (node, created).
    """
    validate_parent_child(parent.node_type, node_type)
    normalized = name.strip()
    for child in parent.get_children():
        if child.node_type == node_type and child.name.strip().casefold() == normalized.casefold():
            return child, False
    node = add_child(parent, node_type, normalized, code=code)
    return node, True


@transaction.atomic
def move_node(node, new_parent):
    """
    Re-parent ``node`` (and, via treebeard, its whole subtree) under
    ``new_parent``. Members keep their membership rows, so they are re-scoped
    automatically — the docs' "moving a parish re-scopes its members."
    """
    validate_parent_child(new_parent.node_type, node.node_type)
    node.move(new_parent, pos='sorted-child')
    return HierarchyNode.objects.get(pk=node.pk)


# ---------------------------------------------------------------------------
# Traversal helpers
# ---------------------------------------------------------------------------

def is_ancestor_or_self(ancestor, target):
    """True if ``ancestor`` is ``target`` or an ancestor of it (path-prefix test)."""
    if ancestor.pk == target.pk:
        return True
    return target.is_descendant_of(ancestor)


def subtree_node_ids(node):
    """IDs of ``node`` plus all its descendants — for scoping querysets."""
    ids = [node.pk]
    ids.extend(node.get_descendants().values_list('pk', flat=True))
    return ids


# ---------------------------------------------------------------------------
# Membership
# ---------------------------------------------------------------------------

@transaction.atomic
def set_membership(user, node, is_provisional=False):
    """Set (or move) a user's single home node."""
    membership, _ = Membership.objects.update_or_create(
        user=user,
        defaults={'node': node, 'is_provisional': is_provisional},
    )
    return membership


# ---------------------------------------------------------------------------
# RBAC — capabilities
# ---------------------------------------------------------------------------

class Capability:
    """Capability slugs (docs/15-technical-architecture.md)."""
    CONTENT_PUBLISH = 'content.publish'
    EVENT_MANAGE = 'event.manage'
    EVENT_CHECKIN = 'event.checkin'
    ANALYTICS_VIEW = 'analytics.view'
    ROLES_ASSIGN = 'roles.assign'
    MODERATION_ACT = 'moderation.act'  # V2


ROLE_CAPABILITIES = {
    RoleAssignment.Role.ADMIN: {
        Capability.CONTENT_PUBLISH,
        Capability.EVENT_MANAGE,
        Capability.EVENT_CHECKIN,
        Capability.ANALYTICS_VIEW,
        Capability.ROLES_ASSIGN,
        Capability.MODERATION_ACT,
    },
    RoleAssignment.Role.COORDINATOR: {
        Capability.CONTENT_PUBLISH,
        Capability.EVENT_MANAGE,
        Capability.EVENT_CHECKIN,
        Capability.ANALYTICS_VIEW,
    },
    RoleAssignment.Role.TEACHER: {
        Capability.EVENT_CHECKIN,
        Capability.ANALYTICS_VIEW,
    },
}


def capabilities_for_role(role):
    return set(ROLE_CAPABILITIES.get(role, set()))


@transaction.atomic
def assign_role(user, role, node, assigned_by=None):
    """Grant a scoped leadership role, idempotently."""
    assignment, _ = RoleAssignment.objects.update_or_create(
        user=user, role=role, node=node,
        defaults={'is_active': True, 'assigned_by': assigned_by},
    )
    return assignment


def active_assignments(user):
    return (
        RoleAssignment.objects
        .filter(user=user, is_active=True)
        .select_related('node')
    )


def user_has_capability(user, capability, target_node):
    """
    True iff ``user`` holds an active role that grants ``capability`` at a node
    that is an ancestor-or-self of ``target_node``. Superusers always pass.
    """
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False):
        return True
    for assignment in active_assignments(user):
        if capability in capabilities_for_role(assignment.role):
            if is_ancestor_or_self(assignment.node, target_node):
                return True
    return False


def scoped_node_ids_for(user, capability=None):
    """
    All node IDs a user can act on (subtrees of their role nodes). Optionally
    restricted to nodes where they hold ``capability``. Used to scope list
    querysets by ``visibility_node``.
    """
    node_ids = set()
    for assignment in active_assignments(user):
        if capability is not None and capability not in capabilities_for_role(assignment.role):
            continue
        node_ids.update(subtree_node_ids(assignment.node))
    return node_ids
