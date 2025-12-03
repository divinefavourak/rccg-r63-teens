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
    """Permission for province-based access control"""
    def has_permission(self, request, view):
        user = request.user
        
        if not user or not user.is_authenticated:
            return False
        
        # Admins can access all provinces
        if user.role == User.Role.ADMIN:
            return True
        
        # Coordinators can only access their own province
        province_param = request.query_params.get('province') or request.data.get('province')
        if province_param:
            return user.province == province_param
        
        return True
    
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