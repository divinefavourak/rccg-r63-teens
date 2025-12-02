from rest_framework import permissions
from django.utils.translation import gettext_lazy as _


class IsAdminUser(permissions.BasePermission):
    """
    Allows access only to admin users.
    """
    
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsCoordinatorUser(permissions.BasePermission):
    """
    Allows access only to coordinator users.
    """
    
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_coordinator)


class IsAdminOrCoordinator(permissions.BasePermission):
    """
    Allows access to admin or coordinator users.
    """
    
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_admin or request.user.is_coordinator)
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Allows access to object owner or admin.
    """
    
    def has_object_permission(self, request, view, obj):
        # Admin can access any object
        if request.user.is_admin:
            return True
        
        # User can access their own object
        return obj == request.user