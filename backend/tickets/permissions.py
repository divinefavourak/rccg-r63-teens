from rest_framework import permissions
from users.models import User


class TicketPermission(permissions.BasePermission):
    """
    Permission check for ticket operations.
    Admins can access all tickets.
    Coordinators can only access tickets from their province.
    """
    
    def has_permission(self, request, view):
        user = request.user
        
        if not user or not user.is_authenticated:
            return False
        
        # Everyone can create tickets (coordinator or admin)
        if request.method == 'POST':
            return True
        
        return True
    
    def has_object_permission(self, request, view, obj):
        user = request.user
        
        if not user or not user.is_authenticated:
            return False
        
        # Admins can access all tickets
        if user.role == User.Role.ADMIN:
            return True
        
        # Coordinators can only access tickets from their province
        if user.role == User.Role.COORDINATOR:
            return obj.province == user.province
        
        return False


class CanApproveTicket(permissions.BasePermission):
    """Only admins can approve tickets"""
    
    def has_permission(self, request, view):
        user = request.user
        return user and user.is_authenticated and user.role == User.Role.ADMIN
    
    def has_object_permission(self, request, view, obj):
        user = request.user
        return user and user.is_authenticated and user.role == User.Role.ADMIN