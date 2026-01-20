"""
Shared permission classes for the RCCG R63 Teens platform.
"""
from rest_framework import permissions


class IsTeen(permissions.BasePermission):
    """Permission check for teen users."""
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'teen'
        )


class IsCoordinator(permissions.BasePermission):
    """Permission check for coordinator users."""
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'coordinator'
        )


class IsAdmin(permissions.BasePermission):
    """Permission check for admin users."""
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'admin'
        )


class IsCoordinatorOrAdmin(permissions.BasePermission):
    """Permission for coordinator or admin users."""
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['coordinator', 'admin']
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only access to all authenticated users, write access to admins only."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'admin'
        )


class IsOwner(permissions.BasePermission):
    """Check if user is the owner of the object."""
    
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allow access to owners or admins."""
    
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False


class IsPublicOrAuthenticated(permissions.BasePermission):
    """Allow public read access, require authentication for writes."""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated


class ProvinceAccessPermission(permissions.BasePermission):
    """
    Province-based access control.
    - Admins can access all data.
    - Coordinators can only access data from their province.
    - Teens can only access their own data.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins have full access
        if request.user.role == 'admin':
            return True
        
        # For coordinators, check province filtering
        if request.user.role == 'coordinator':
            province_param = (
                request.query_params.get('province') or 
                request.data.get('province') or 
                request.data.get('attendee_province')
            )
            if province_param:
                return request.user.province == province_param
            return True
        
        return True

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins have full access
        if request.user.role == 'admin':
            return True
        
        # Coordinators can access objects in their province
        if request.user.role == 'coordinator':
            if hasattr(obj, 'attendee_province'):
                return obj.attendee_province == request.user.province
            if hasattr(obj, 'province'):
                return obj.province == request.user.province
        
        # Teens can access their own objects
        if request.user.role == 'teen':
            if hasattr(obj, 'user'):
                return obj.user == request.user
            if hasattr(obj, 'profile') and hasattr(request.user, 'teen_profile'):
                return obj.profile == request.user.teen_profile
        
        return False


class ContentPermission(permissions.BasePermission):
    """
    Permission for content management (devotionals, manuals, media).
    - Public: Read published content
    - Admin: Full CRUD access
    """
    
    def has_permission(self, request, view):
        # Allow read access to published content for everyone
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Only admins can create/update/delete content
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'admin'
        )
