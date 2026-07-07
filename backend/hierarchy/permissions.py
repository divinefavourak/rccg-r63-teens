"""
DRF permission primitives for scoped RBAC.

Thin wrappers over ``hierarchy.services``. Not yet wired into existing views —
that cut-over is Phase 1b (see docs/design/phase1-hierarchy-rbac.md). Provided
here as the reusable primitive with test coverage.

Usage notes (important — avoids a real footgun):
- ``has_object_permission`` enforces the capability at the object's scope node
  and is the precise check for detail/mutation of an existing object.
- ``has_permission`` runs on *every* request, including ``create``/``list``
  where there is no object. It denies anyone who does not hold the capability at
  *some* node (coarse gate), so a plain authenticated user cannot POST to a
  capability-guarded endpoint. For a create endpoint, also scope the target:
  either implement ``get_capability_node(self, request)`` on the view (checked
  here) or validate the chosen node in the serializer.
"""
from rest_framework.permissions import BasePermission

from . import services


def _scope_node(obj):
    """Resolve the hierarchy node an object is scoped to, by convention."""
    if hasattr(obj, 'get_scope_node'):
        return obj.get_scope_node()
    node = getattr(obj, 'visibility_node', None)
    if node is None:
        node = getattr(obj, 'node', None)
    return node


def _cached_assignments(request):
    """Fetch the user's active assignments once per request (avoids N+1 across
    object-level checks on a list)."""
    cached = getattr(request, '_hierarchy_assignments', None)
    if cached is None:
        user = request.user
        if user and user.is_authenticated and not user.is_superuser:
            cached = list(services.active_assignments(user))
        else:
            cached = []
        request._hierarchy_assignments = cached
    return cached


def HasCapability(capability):
    """Build a DRF permission requiring ``capability`` (see module docstring)."""

    class _HasCapability(BasePermission):
        message = f'You do not have the required capability: {capability}.'

        def has_permission(self, request, view):
            user = request.user
            if not (user and user.is_authenticated):
                return False
            if user.is_superuser:
                return True
            # If the view can name the target node (e.g. a create endpoint),
            # enforce precisely now; otherwise apply the coarse gate.
            resolver = getattr(view, 'get_capability_node', None)
            if callable(resolver):
                node = resolver(request)
                if node is not None:
                    assignments = _cached_assignments(request)
                    return any(services.assignment_grants(a, capability, node) for a in assignments)
            return services.user_has_any_capability(user, capability)

        def has_object_permission(self, request, view, obj):
            user = request.user
            if user and user.is_superuser:
                return True
            node = _scope_node(obj)
            if node is None:
                return False
            assignments = _cached_assignments(request)
            return any(services.assignment_grants(a, capability, node) for a in assignments)

    _HasCapability.__name__ = f'HasCapability[{capability}]'
    return _HasCapability
