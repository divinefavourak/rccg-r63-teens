from rest_framework import permissions
from .models import User


class IsAdmin(permissions.BasePermission):
    """Permission check for admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN


class IsCoordinator(permissions.BasePermission):
    """Permission check for coordinator users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == User.Role.COORDINATOR


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only access to all, but write only to admins"""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN


class IsSelfOrAdmin(permissions.BasePermission):
    """Allow users to access their own data, or admins to access any"""
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_authenticated:
            if request.user.role == User.Role.ADMIN:
                return True
            if hasattr(obj, 'id'):
                return obj.id == request.user.id
        return False


class ProvinceAccessPermission(permissions.BasePermission):
    """
    Province-based access control. **Deprecated** — use
    `identity.authorization.HasPermission` / `scope_queryset`, which evaluate
    capabilities across a real hierarchy subtree. This class survives only because
    the legacy `tickets` app still imports it, and `tickets` is slated for removal.

    The collection-level check used to read a `province` value *from the request*
    and allow the call outright when the client simply left it out:

        province_param = request.query_params.get('province') or request.data.get('province')
        if province_param:
            return user.province == province_param
        return True          # <- omit the parameter, skip the check entirely

    That let the caller decide whether they were checked, which is the IDOR the
    backend audit flagged (C2). Client input no longer influences this decision:
    the collection level only authenticates, and the province comparison happens on
    the object, always against the user's *own* province.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        
        if not user or not user.is_authenticated:
            return False
        
        # Admins can access all objects
        if user.role == User.Role.ADMIN:
            return True
        
        # For User objects, check if accessing self
        if isinstance(obj, User):
            return obj.id == user.id
        
        # For objects with province field, check province match
        if hasattr(obj, 'province'):
            return user.province == obj.province
        
        # For objects with registered_by (User), check user's province
        if hasattr(obj, 'registered_by') and obj.registered_by:
            return user.province == obj.registered_by.province
        
        return False


class IsTeen(permissions.BasePermission):
    """Permission check for teen users"""
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == User.Role.TEEN
        )


class IsTeenOrCoordinator(permissions.BasePermission):
    """Permission check for teen or coordinator users"""
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in [User.Role.TEEN, User.Role.COORDINATOR]
        )


class IsTeenOrHigher(permissions.BasePermission):
    """
    Permission check for teen or higher access level.
    Access levels: Teen < Individual < Coordinator < Admin
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [
            User.Role.TEEN, 
            User.Role.INDIVIDUAL, 
            User.Role.COORDINATOR, 
            User.Role.ADMIN
        ]


class CanManageEvents(permissions.BasePermission):
    """Permission for event management - only Admin can create/edit events"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read permissions for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only for admin
        return request.user.role == User.Role.ADMIN


class CanRegisterForEvents(permissions.BasePermission):
    """Permission for event registration - Teen, Coordinator, Admin can register"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        return request.user.role in [
            User.Role.TEEN,
            User.Role.COORDINATOR,
            User.Role.ADMIN
        ]