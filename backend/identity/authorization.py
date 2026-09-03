"""
Centralized authorization — the single home for "what may this user do".

Views and serializers call these helpers; they never re-implement permission
logic. Authority is derived from *current* RoleAssignments (active + within their
date window) whose Role carries the permission, evaluated within the assignment
node's subtree (materialized-path scoping, reused from hierarchy).
"""
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import BasePermission

from .models import Membership, MembershipTransfer, RoleAssignment, RolePermission
from .permissions_registry import Perm


# ---------------------------------------------------------------------------
# Reading current authority
# ---------------------------------------------------------------------------

def active_role_assignments(user):
    """Current (active + in-window) role assignments for a user.

    Returns a queryset of live model instances. Callers that only need to *test*
    authority should go through the cached snapshot below instead — this hits the
    database every time by design, because its remaining callers (the ``/me/``
    serializer, hierarchy scoping) want the real objects.
    """
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


# ---------------------------------------------------------------------------
# Cached authority snapshot
# ---------------------------------------------------------------------------
#
# Every authorization helper below used to run the same two queries —
# active_role_assignments + _role_permission_map — with no memoisation of any
# kind. A single list request could pay that repeatedly: EventViewSet.get_queryset
# alone reached ~11 authorization queries before the page query ran, because the
# coarse gate, the scoping call and the age-group filter each re-derived the same
# facts.
#
# A snapshot is the minimum needed to answer every question in this module:
# per assignment, the role, the node's materialized path and depth, and the
# permission codes that role carries. treebeard's is_descendant_of is a pure
# path-prefix comparison (mp_tree.py: `self.path.startswith(node.path) and
# self.depth > node.depth`), so node containment is answerable from the path and
# depth alone, without loading node rows.
#
# Two layers:
#   * on the user instance — request-scoped for free, since Django reuses one
#     request.user object for the whole request and it is discarded with it;
#   * in Redis — shared across requests and processes.
#
# Correctness notes:
#   * The date is part of the cache key. Assignments are filtered by a start/end
#     window against today, so a snapshot must not outlive the calendar day that
#     produced it.
#   * A global version counter is part of the key, bumped by signals whenever a
#     RoleAssignment, Role or RolePermission changes. Granting or revoking a role
#     therefore takes effect on the next request, not after a TTL. It is global
#     rather than per-user because editing a Role's permissions changes authority
#     for every holder of that role, and role edits are rare admin actions.
#   * Every cache read fails open to the database: CACHES is configured with
#     IGNORE_EXCEPTIONS, so Redis being unreachable costs latency, never
#     correctness.

_AUTHZ_VERSION_KEY = 'authz:version'
_AUTHZ_TTL = 15 * 60


class _Authority:
    """Immutable view of what a user may do, derived once per request/day."""

    __slots__ = ('entries', 'day')

    def __init__(self, entries, day):
        # entries: list of (role_id, node_id, node_path, node_depth, frozenset(codes))
        self.entries = entries
        self.day = day

    def has_any(self, code):
        return any(code in codes for _, _, _, _, codes in self.entries)

    def has_at(self, code, node):
        """Does the user hold ``code`` at an ancestor-or-self of ``node``?"""
        for _, node_id, path, depth, codes in self.entries:
            if code not in codes:
                continue
            if node_id == node.pk:
                return True
            # Inlined is_descendant_of: the assignment node is an ancestor of the
            # target when the target's path extends it and lies deeper.
            if node.path.startswith(path) and node.depth > depth:
                return True
        return False

    def codes_at(self, node):
        codes = set()
        for _, node_id, path, depth, entry_codes in self.entries:
            if node_id == node.pk or (node.path.startswith(path) and node.depth > depth):
                codes |= entry_codes
        return codes

    def all_codes(self):
        codes = set()
        for _, _, _, _, entry_codes in self.entries:
            codes |= entry_codes
        return codes

    def paths_for(self, code):
        """Materialized paths of every node where the user holds ``code``."""
        return [path for _, _, path, _, codes in self.entries if code in codes]


def _authz_version():
    """Monotonic counter; any change to roles or assignments bumps it."""
    version = cache.get(_AUTHZ_VERSION_KEY)
    if version is None:
        # Either a cold cache or Redis is unavailable. Either way 0 is a safe
        # starting point: if Redis was flushed, the cached snapshots went with it.
        cache.set(_AUTHZ_VERSION_KEY, 0, None)
        return 0
    return version


def authz_version():
    """Public read of the authority-cache version.

    Other caches whose contents are scoped by permissions (the Console stats
    endpoint) fold this into their own keys, so a role change re-scopes them at
    the same moment it re-scopes authorization itself.
    """
    return _authz_version()


def bump_authz_version():
    """Invalidate every cached authority snapshot. Called from signals."""
    try:
        cache.incr(_AUTHZ_VERSION_KEY)
    except ValueError:
        # incr raises when the key is absent (it was never set, or it expired).
        # Setting it to 1 achieves the same invalidation, since existing keys were
        # written against version 0.
        cache.set(_AUTHZ_VERSION_KEY, 1, None)


def _build_authority(user, today):
    assignments = list(active_role_assignments(user))
    perms = _role_permission_map(assignments)
    return [
        (
            a.role_id,
            a.node_id,
            a.node.path,
            a.node.depth,
            frozenset(perms.get(a.role_id, ())),
        )
        for a in assignments
    ]


def authority(user):
    """The user's cached authority snapshot. Superusers are not represented here —
    callers short-circuit on ``is_superuser`` before reaching this."""
    today = timezone.localdate()

    memo = getattr(user, '_authority_snapshot', None)
    if memo is not None and memo.day == today:
        return memo

    key = f'authz:v{_authz_version()}:u{user.pk}:{today.isoformat()}:{settings.CACHE_VERSION}'
    entries = cache.get(key)
    if entries is None:
        entries = _build_authority(user, today)
        cache.set(key, entries, _AUTHZ_TTL)

    snapshot = _Authority(entries, today)
    try:
        user._authority_snapshot = snapshot
    except AttributeError:
        # Some auth backends hand back objects with __slots__; the Redis layer
        # still applies, so this is a lost optimisation rather than an error.
        pass
    return snapshot


def users_with_permission(permission_code):
    """
    Every user who currently holds ``permission_code`` anywhere in the tree.

    The reverse of `has_any_permission`: that answers "may this user?", this
    answers "who may?" — which is what a system alert needs when it must reach
    whoever is responsible ("page the admin", `docs/07` §5).

    Deliberately *not* scoped to a node. Callers that need "the coordinators of
    Area X" should filter the result by assignment node; a broadcast alert about a
    region-wide pipeline gap should reach everyone who can act on it.

    Superusers are included: they hold every permission implicitly, and an alert
    that reached nobody because no role happened to be seeded would be worse than
    one that reached one extra person.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    today = timezone.localdate()

    holders = (
        RoleAssignment.objects
        .filter(
            is_active=True,
            start_date__lte=today,
            role__role_permissions__permission__code=permission_code,
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .values_list('user_id', flat=True)
    )

    return User.objects.filter(
        Q(id__in=holders) | Q(is_superuser=True), is_active=True,
    ).distinct()


def permission_codes_at(user, node):
    """All permission codes the user holds at ``node`` (via ancestor-or-self
    assignments). Superusers implicitly hold everything (returns None sentinel)."""
    if getattr(user, 'is_superuser', False):
        return None  # sentinel: all permissions
    if not user or not user.is_authenticated:
        return set()
    return authority(user).codes_at(node)


def has_permission(user, permission_code, node):
    """True iff the user holds ``permission_code`` at an ancestor-or-self of ``node``."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return authority(user).has_at(permission_code, node)


def has_any_permission(user, permission_code):
    """Coarse gate: does the user hold ``permission_code`` at *any* node?"""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return authority(user).has_any(permission_code)


def effective_permissions(user):
    """The union of permission codes the user currently holds anywhere — for
    surfacing capabilities to the client (UI gating). Superuser => all codes."""
    if getattr(user, 'is_superuser', False):
        from .permissions_registry import ALL_PERMISSION_CODES
        return sorted(ALL_PERMISSION_CODES)
    if not user or not user.is_authenticated:
        return []
    return sorted(authority(user).all_codes())


def scope_queryset(queryset, user, permission_code, node_field='node'):
    """Restrict ``queryset`` to rows whose ``node_field`` is within a subtree
    where the user holds ``permission_code`` (path-prefix, evaluated in the DB)."""
    if getattr(user, 'is_superuser', False):
        return queryset
    if not user or not user.is_authenticated:
        return queryset.none()
    prefixes = authority(user).paths_for(permission_code)
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
def assign_role(user, role, node, appointed_by=None, start_date=None, end_date=None,
                enforce_escalation=True):
    """Grant a role at a node (idempotent on the active triple). Validates level
    and, when an actor is given, escalation. Re-granting an already-active
    assignment preserves its original ``start_date`` (get_or_create, not
    update_or_create)."""
    validate_role_assignment(role, node)
    if enforce_escalation and appointed_by is not None and not can_assign(appointed_by, role, node):
        raise ValidationError('You cannot grant a role broader than your own authority here.')
    assignment, created = RoleAssignment.objects.get_or_create(
        user=user, role=role, node=node, is_active=True,
        defaults={
            'appointed_by': appointed_by,
            'start_date': start_date or timezone.localdate(),
            'end_date': end_date,
        },
    )
    # Allow (re)scheduling an end date on an existing active assignment without
    # disturbing its start_date.
    if not created and end_date is not None and assignment.end_date != end_date:
        assignment.end_date = end_date
        assignment.save(update_fields=['end_date', 'updated_at'])
    return assignment


@transaction.atomic
def revoke_role(assignment):
    """End a role assignment (soft) so history is preserved."""
    assignment.is_active = False
    if assignment.end_date is None:
        assignment.end_date = timezone.localdate()
    assignment.save(update_fields=['is_active', 'end_date', 'updated_at'])
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
    """Move the user's primary (home) membership to a new node, recording it.

    Delegates to ``set_membership`` (which demotes the old primary and
    update-or-creates the destination membership in place) rather than repointing
    the row — otherwise a pre-existing active membership at ``to_node`` would
    collide with the unique (user, organization_node) constraint.
    """
    current = Membership.objects.filter(user=user, is_primary=True, is_active=True).first()
    from_node = current.organization_node if current else None
    membership = set_membership(user, to_node, is_primary=True)
    MembershipTransfer.objects.create(
        user=user, from_node=from_node, to_node=to_node,
        transferred_by=transferred_by, reason=reason,
    )
    return membership


# ---------------------------------------------------------------------------
# DRF permission primitive
# ---------------------------------------------------------------------------

def _scope_node(obj):
    if hasattr(obj, 'get_scope_node'):
        return obj.get_scope_node()
    for attr in ('visibility_node', 'organization_node', 'scope_node', 'node'):
        node = getattr(obj, attr, None)
        if node is not None:
            return node
    return None


def HasPermission(permission_code):
    """DRF permission requiring ``permission_code``. Coarse gate on the
    collection (create/list) so non-authorized users can't POST; precise
    node-scoped check on the object *when the object carries a node*.

    Objects that do not yet carry a hierarchy node fall back to the coarse gate —
    the same expand-contract rule ``HasPermissionOrReadOnly`` already applies.
    Denying them outright (the previous behaviour) made every object-level action
    on a node-less model unreachable: content is the live example, since
    ``Devotional`` has no scope node until content adopts the hierarchy, so a
    reviewer holding ``content.publish`` could not approve anything. It was also
    self-inconsistent — the very same user could already ``PATCH`` that devotional
    through ``HasPermissionOrReadOnly``, which falls back to the coarse gate."""

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
            if node is not None:
                return has_permission(user, permission_code, node)
            return has_any_permission(user, permission_code)

    _HasPermission.__name__ = f'HasPermission[{permission_code}]'
    return _HasPermission


def HasPermissionOrReadOnly(permission_code):
    """Public/authenticated read (SAFE methods), permissioned write. Replaces the
    legacy ``ContentPermission``/``IsAdminOrReadOnly`` pattern. Object writes are
    node-scoped when the object carries a scope node; otherwise the coarse gate
    applies (resources without a hierarchy node yet — see expand-contract plan)."""
    from rest_framework.permissions import SAFE_METHODS

    class _HasPermissionOrReadOnly(BasePermission):
        message = f'Missing required permission: {permission_code}.'

        def has_permission(self, request, view):
            if request.method in SAFE_METHODS:
                return True
            user = request.user
            if not (user and user.is_authenticated):
                return False
            return user.is_superuser or has_any_permission(user, permission_code)

        def has_object_permission(self, request, view, obj):
            if request.method in SAFE_METHODS:
                return True
            user = request.user
            if user and user.is_superuser:
                return True
            node = _scope_node(obj)
            if node is not None:
                return has_permission(user, permission_code, node)
            return has_any_permission(user, permission_code)

    _HasPermissionOrReadOnly.__name__ = f'HasPermissionOrReadOnly[{permission_code}]'
    return _HasPermissionOrReadOnly


def IsSelfOrHasPermission(permission_code, user_attr='user'):
    """Owner (``obj.user`` is the requester, or the object *is* the user) OR a
    holder of ``permission_code`` at the object's node. Replaces ``IsSelfOrAdmin``/
    ``IsOwnerOrAdmin``."""

    class _IsSelfOrHasPermission(BasePermission):
        def has_permission(self, request, view):
            return bool(request.user and request.user.is_authenticated)

        def has_object_permission(self, request, view, obj):
            user = request.user
            if user and user.is_superuser:
                return True
            owner = obj if _looks_like_user(obj) else getattr(obj, user_attr, None)
            if owner is not None and owner == user:
                return True
            node = _scope_node(obj)
            if node is not None:
                return has_permission(user, permission_code, node)
            return has_any_permission(user, permission_code)

    _IsSelfOrHasPermission.__name__ = f'IsSelfOrHasPermission[{permission_code}]'
    return _IsSelfOrHasPermission


def _looks_like_user(obj):
    from django.contrib.auth import get_user_model
    return isinstance(obj, get_user_model())
