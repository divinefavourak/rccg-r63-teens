"""
Centralized authorization — the single home for "what may this user do".

Views and serializers call these helpers; they never re-implement permission
logic. Authority is derived from *current* RoleAssignments (active + within their
date window) whose Role carries the permission, evaluated within the assignment
node's subtree (materialized-path scoping, reused from hierarchy).
"""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import BasePermission

from hierarchy.services import is_ancestor_or_self
from .models import Membership, MembershipTransfer, RoleAssignment, RolePermission
from .permissions_registry import Perm


# ---------------------------------------------------------------------------
# Reading current authority
# ---------------------------------------------------------------------------

def active_role_assignments(user):
    """Current (active + in-window) role assignments for a user."""
    today = timezone.localdate()
    return (
        RoleAssignment.objects
        .filter(user=user, is_active=True, start_date__lte=today)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .select_related('role', 'node')
    )


def _role_permission_map(assignments):
    """{role_id -> set(permission_code)} in a single query for the given roles."""
    role_ids = {a.role_id for a in assignments}
    mapping = {rid: set() for rid in role_ids}
    if role_ids:
        for rp in (RolePermission.objects
                   .filter(role_id__in=role_ids)
                   .select_related('permission')):
            mapping[rp.role_id].add(rp.permission.code)
    return mapping


def permission_codes_at(user, node):
    """All permission codes the user holds at ``node`` (via ancestor-or-self
    assignments). Superusers implicitly hold everything (returns None sentinel)."""
    if getattr(user, 'is_superuser', False):
        return None  # sentinel: all permissions
    assignments = [a for a in active_role_assignments(user) if is_ancestor_or_self(a.node, node)]
    perms = _role_permission_map(assignments)
    codes = set()
    for a in assignments:
        codes |= perms.get(a.role_id, set())
    return codes


def has_permission(user, permission_code, node):
    """True iff the user holds ``permission_code`` at an ancestor-or-self of ``node``."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    assignments = list(active_role_assignments(user))
    perms = _role_permission_map(assignments)
    return any(
        permission_code in perms.get(a.role_id, ()) and is_ancestor_or_self(a.node, node)
        for a in assignments
    )


def has_any_permission(user, permission_code):
    """Coarse gate: does the user hold ``permission_code`` at *any* node?"""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    assignments = list(active_role_assignments(user))
    perms = _role_permission_map(assignments)
    return any(permission_code in perms.get(a.role_id, ()) for a in assignments)


def effective_permissions(user):
    """The union of permission codes the user currently holds anywhere — for
    surfacing capabilities to the client (UI gating). Superuser => all codes."""
    if getattr(user, 'is_superuser', False):
        from .permissions_registry import ALL_PERMISSION_CODES
        return sorted(ALL_PERMISSION_CODES)
    if not user or not user.is_authenticated:
        return []
    assignments = list(active_role_assignments(user))
    perms = _role_permission_map(assignments)
    codes = set()
    for a in assignments:
        codes |= perms.get(a.role_id, set())
    return sorted(codes)


def scope_queryset(queryset, user, permission_code, node_field='node'):
    """Restrict ``queryset`` to rows whose ``node_field`` is within a subtree
    where the user holds ``permission_code`` (path-prefix, evaluated in the DB)."""
    if getattr(user, 'is_superuser', False):
        return queryset
    if not user or not user.is_authenticated:
        return queryset.none()
    assignments = list(active_role_assignments(user))
    perms = _role_permission_map(assignments)
    prefixes = [a.node.path for a in assignments if permission_code in perms.get(a.role_id, ())]
    if not prefixes:
        return queryset.none()
    query = Q()
    for prefix in prefixes:
        query |= Q(**{f'{node_field}__path__startswith': prefix})
    return queryset.filter(query)


# ---------------------------------------------------------------------------
# Mutations with validation (duplicate / invalid-assignment / escalation)
# ---------------------------------------------------------------------------

def validate_role_assignment(role, node):
    """Role must be active and permitted at this node's level."""
    if not role.is_active:
        raise ValidationError(f'Role "{role.code}" is inactive.')
    if not role.allows_node_type(node.node_type):
        raise ValidationError(
            f'Role "{role.code}" cannot be assigned at a {node.node_type} node.'
        )


def can_assign(actor, role, node):
    """Guard against privilege escalation: the actor must hold roles.assign at
    the node AND already possess every permission the granted role carries."""
    if getattr(actor, 'is_superuser', False):
        return True
    if not has_permission(actor, Perm.ROLES_ASSIGN, node):
        return False
    actor_codes = permission_codes_at(actor, node)
    if actor_codes is None:  # superuser
        return True
    return set(role.permission_codes()).issubset(actor_codes)


@transaction.atomic
def assign_role(user, role, node, appointed_by=None, start_date=None, enforce_escalation=True):
    """Grant a role at a node (idempotent on the active triple). Validates level
    and, when an actor is given, escalation."""
    validate_role_assignment(role, node)
    if enforce_escalation and appointed_by is not None and not can_assign(appointed_by, role, node):
        raise ValidationError('You cannot grant a role broader than your own authority here.')
    assignment, _ = RoleAssignment.objects.update_or_create(
        user=user, role=role, node=node, is_active=True,
        defaults={'appointed_by': appointed_by, 'start_date': start_date or timezone.localdate()},
    )
    return assignment


@transaction.atomic
def revoke_role(assignment):
    """End a role assignment (soft) so history is preserved."""
    assignment.is_active = False
    if assignment.end_date is None:
        assignment.end_date = timezone.localdate()
    assignment.save(update_fields=['is_active', 'end_date'])
    return assignment


@transaction.atomic
def set_membership(user, node, is_primary=False):
    """Create/reactivate the user's membership at ``node``. If ``is_primary``,
    demote any existing primary first (single home node)."""
    if is_primary:
        Membership.objects.filter(user=user, is_primary=True, is_active=True).update(is_primary=False)
    membership, _ = Membership.objects.update_or_create(
        user=user, organization_node=node, is_active=True,
        defaults={'is_primary': is_primary},
    )
    return membership


@transaction.atomic
def transfer_primary_membership(user, to_node, transferred_by=None, reason=''):
    """Move the user's primary (home) membership to a new node, recording it."""
    current = Membership.objects.filter(user=user, is_primary=True, is_active=True).first()
    from_node = current.organization_node if current else None
    if current:
        current.organization_node = to_node
        current.save(update_fields=['organization_node', 'updated_at'])
    else:
        current = set_membership(user, to_node, is_primary=True)
    MembershipTransfer.objects.create(
        user=user, from_node=from_node, to_node=to_node,
        transferred_by=transferred_by, reason=reason,
    )
    return current


# ---------------------------------------------------------------------------
# DRF permission primitive
# ---------------------------------------------------------------------------

def _scope_node(obj):
    if hasattr(obj, 'get_scope_node'):
        return obj.get_scope_node()
    for attr in ('visibility_node', 'organization_node', 'node'):
        node = getattr(obj, attr, None)
        if node is not None:
            return node
    return None


def HasPermission(permission_code):
    """DRF permission requiring ``permission_code``. Coarse gate on the
    collection (create/list) so non-authorized users can't POST; precise
    node-scoped check on the object."""

    class _HasPermission(BasePermission):
        message = f'Missing required permission: {permission_code}.'

        def has_permission(self, request, view):
            user = request.user
            if not (user and user.is_authenticated):
                return False
            if user.is_superuser:
                return True
            resolver = getattr(view, 'get_permission_node', None)
            if callable(resolver):
                node = resolver(request)
                if node is not None:
                    return has_permission(user, permission_code, node)
            return has_any_permission(user, permission_code)

        def has_object_permission(self, request, view, obj):
            user = request.user
            if user and user.is_superuser:
                return True
            node = _scope_node(obj)
            if node is None:
                return False
            return has_permission(user, permission_code, node)

    _HasPermission.__name__ = f'HasPermission[{permission_code}]'
    return _HasPermission
