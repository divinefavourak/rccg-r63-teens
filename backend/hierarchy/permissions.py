"""
DRF permission primitives for scoped RBAC.

Thin wrappers over ``hierarchy.services`` so views can declare capability
requirements. Not yet wired into existing views — that cut-over is Phase 1b
(see docs/design/phase1-hierarchy-rbac.md). Provided here as the reusable
primitive with test coverage.
"""
from rest_framework.permissions import BasePermission

from . import services


def _scope_node(obj):
    """Resolve the hierarchy node an object is scoped to, by convention."""
    if hasattr(obj, 'get_scope_node'):
        return obj.get_scope_node()
    return getattr(obj, 'visibility_node', None) or getattr(obj, 'node', None)


def HasCapability(capability):
    """
    Build an object-level DRF permission requiring ``capability`` at the
    object's scope node. List-level scoping is done via querysets using
    ``services.scoped_node_ids_for`` — object permissions guard detail/mutation.
    """

    class _HasCapability(BasePermission):
        message = f'You do not have the required capability: {capability}.'

        def has_permission(self, request, view):
            return bool(request.user and request.user.is_authenticated)

        def has_object_permission(self, request, view, obj):
            node = _scope_node(obj)
            if node is None:
                return False
            return services.user_has_capability(request.user, capability, node)

    _HasCapability.__name__ = f'HasCapability[{capability}]'
    return _HasCapability
