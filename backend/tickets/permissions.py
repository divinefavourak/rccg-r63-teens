from rest_framework import permissions

class IsAdminOrCoordinatorForProvince(permissions.BasePermission):
    """
    Permission check for admin users or coordinators for their province.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Admin can access all tickets
        if request.user.is_admin:
            return True
        
        # Coordinators can only access tickets from their province
        if request.user.is_coordinator:
            return obj.province == request.user.province
        
        return False


class IsCoordinatorOnly(permissions.BasePermission):
    """Only coordinators can access."""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_coordinator


class IsAdminOnly(permissions.BasePermission):
    """Only admins can access."""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_admin