"""
Domain services for the church hierarchy.

This module is the *only* place application code should reach for tree mutation,
tree traversal, and RBAC evaluation. It wraps treebeard so business rules (the
level invariant, capability grants) are enforced in one place and callers never
depend on treebeard's API directly.
"""
from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify

from .models import (
    HierarchyNode,
    Membership,
    NodeType,
    RoleAssignment,
    child_type_of,
    validate_parent_child,
)

# Re-exported for callers that historically imported these from services.
__all__ = [
    'child_type_of', 'validate_parent_child', 'create_root', 'add_child',
    'get_or_create_child', 'move_node', 'is_ancestor_or_self', 'nodes_visible_to',
    'scope_queryset', 'scoped_node_ids_for', 'set_membership', 'Capability',
    'ROLE_CAPABILITIES', 'capabilities_for_role', 'assign_role', 'active_assignments',
    'assignment_grants', 'user_has_capability', 'user_has_any_capability',
]


# ---------------------------------------------------------------------------
# Tree mutation (wraps treebeard)
# ---------------------------------------------------------------------------

@transaction.atomic
def create_root(name, node_type=NodeType.NATIONAL, code='', slug=''):
    """Create the tree root. Only a NATIONAL node may be a root."""
    from django.core.exceptions import ValidationError
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
    Returns (node, created). Note: dedup is case/space-insensitive but there is
    no DB-level uniqueness on siblings (a treebeard limitation), so concurrent
    creators can still race — callers doing bulk work should serialize or cache.
    """
    validate_parent_child(parent.node_type, node_type)
    normalized = name.strip().casefold()
    for child in parent.get_children():
        if child.node_type == node_type and child.name.strip().casefold() == normalized:
            return child, False
    node = add_child(parent, node_type, name.strip(), code=code)
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
# Traversal & scoping (materialized-path prefix, evaluated in the DB)
# ---------------------------------------------------------------------------

def is_ancestor_or_self(ancestor, target):
    """True if ``ancestor`` is ``target`` or an ancestor of it (path-prefix test)."""
    if ancestor.pk == target.pk:
        return True
    return target.is_descendant_of(ancestor)


def nodes_visible_to(user, capability=None):
    """
    Queryset of nodes ``user`` may act on: the union of their role-node subtrees,
    optionally restricted to roles granting ``capability``. Implemented as a
    path-prefix filter (``path__startswith``) so the whole thing is evaluated in
    the database — no materializing thousands of PKs into Python.
    """
    if not user or not user.is_authenticated:
        return HierarchyNode.objects.none()
    if getattr(user, 'is_superuser', False):
        return HierarchyNode.objects.all()
    query = Q()
    matched = False
    for assignment in active_assignments(user):
        if capability is not None and capability not in capabilities_for_role(assignment.role):
            continue
        query |= Q(path__startswith=assignment.node.path)
        matched = True
    if not matched:
        return HierarchyNode.objects.none()
    return HierarchyNode.objects.filter(query)


def scope_queryset(queryset, user, node_field='visibility_node', capability=None):
    """
    Restrict ``queryset`` to rows whose ``node_field`` falls within the user's
    scope, via path-prefix (DB-side). ``node_field`` is the name of the FK to a
    HierarchyNode on the queryset's model.
    """
    if getattr(user, 'is_superuser', False):
        return queryset
    if not user or not user.is_authenticated:
        return queryset.none()
    prefixes = [
        a.node.path for a in active_assignments(user)
        if capability is None or capability in capabilities_for_role(a.role)
    ]
    if not prefixes:
        return queryset.none()
    query = Q()
    for prefix in prefixes:
        query |= Q(**{f'{node_field}__path__startswith': prefix})
    return queryset.filter(query)


def scoped_node_ids_for(user, capability=None):
    """IDs of the nodes in the user's scope. Prefer ``scope_queryset`` for
    filtering — this exists for callers that genuinely need the id set."""
    return set(nodes_visible_to(user, capability).values_list('pk', flat=True))


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


def assignment_grants(assignment, capability, target_node):
    """Pure predicate: does this single assignment grant ``capability`` at
    ``target_node``? Lets callers evaluate against a pre-fetched assignment list
    (e.g. cached on the request) without re-querying."""
    return (
        capability in capabilities_for_role(assignment.role)
        and is_ancestor_or_self(assignment.node, target_node)
    )


def user_has_capability(user, capability, target_node):
    """True iff the user holds an active role granting ``capability`` at an
    ancestor-or-self of ``target_node``. Superusers always pass."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False):
        return True
    return any(
        assignment_grants(a, capability, target_node) for a in active_assignments(user)
    )


def user_has_any_capability(user, capability):
    """Coarse gate: does the user hold ``capability`` at *any* node? Used to
    guard collection endpoints (create/list) where there is no object yet;
    precise node scoping still happens on the object or via ``scope_queryset``."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False):
        return True
    return any(
        capability in capabilities_for_role(a.role) for a in active_assignments(user)
    )
