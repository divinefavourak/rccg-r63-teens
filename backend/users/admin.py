from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for User model."""
    
    list_display = ('username', 'email', 'name', 'role', 'province', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('role', 'province', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email', 'name', 'province')
    ordering = ('name',)
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        (_('Personal Info'), {'fields': ('name', 'email')}),
        (_('Role Information'), {'fields': ('role', 'province')}),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'name', 'email', 'role', 'province', 'password1', 'password2'),
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        """Make certain fields read-only based on user role."""
        if obj:  # Editing an existing user
            readonly_fields = ['last_login', 'date_joined']
            if not request.user.is_superuser:
                readonly_fields.append('is_superuser')
            return readonly_fields
        return []
    
    def get_fieldsets(self, request, obj=None):
        """Customize fieldsets based on user role."""
        fieldsets = super().get_fieldsets(request, obj)
        
        # If user is not superuser, hide some fields
        if not request.user.is_superuser:
            fieldsets = list(fieldsets)
            # Remove superuser field
            for i, fieldset in enumerate(fieldsets):
                if fieldset[0] == _('Permissions'):
                    fields = list(fieldset[1]['fields'])
                    if 'is_superuser' in fields:
                        fields.remove('is_superuser')
                    fieldsets[i][1]['fields'] = tuple(fields)
        
        return fieldsets