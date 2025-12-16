from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, LoginHistory, AuditLog


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for User model"""
    list_display = ('username', 'email', 'full_name', 'role', 'province', 'is_active', 'date_joined')
    list_filter = ('role', 'province', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'email', 'phone')}),
        ('Church Info', {'fields': ('role', 'province', 'zone', 'area', 'parish')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Preferences', {'fields': ('email_notifications', 'sms_notifications', 'bio')}),
        ('Important Dates', {'fields': ('last_login', 'date_joined', 'updated_at')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'first_name', 'last_name', 'role', 'province', 'password1', 'password2'),
        }),
    )
    
    readonly_fields = ('date_joined', 'updated_at', 'last_login')


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    """Admin configuration for LoginHistory"""
    list_display = ('user', 'ip_address', 'login_time', 'success')
    list_filter = ('success', 'login_time')
    search_fields = ('user__username', 'user__email', 'ip_address')
    readonly_fields = ('login_time',)
    date_hierarchy = 'login_time'


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin configuration for AuditLog"""
    list_display = ('user', 'action', 'entity_type', 'entity_id', 'timestamp')
    list_filter = ('action', 'entity_type', 'timestamp')
    search_fields = ('user__username', 'entity_type', 'entity_id')
    readonly_fields = ('timestamp',)
    date_hierarchy = 'timestamp'