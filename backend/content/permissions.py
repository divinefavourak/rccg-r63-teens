from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Permission that only allows admin users to access the view.
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'admin'
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission that allows read-only access to any authenticated user,
    but write access only to admin users.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to admin users
        return request.user.role == 'admin'


class CanAccessContent(permissions.BasePermission):
    """
    Permission that allows any authenticated user to read content.
    Write operations are limited to admin users.
    Teen users can only access published content.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read permissions based on role
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to admin users
        return request.user.role == 'admin'
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins can access everything
        if request.user.role == 'admin':
            return True
        
        # Non-admin users can only view published content
        if request.method in permissions.SAFE_METHODS:
            return getattr(obj, 'is_published', True)
        
        return False
