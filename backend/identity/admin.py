from django.contrib import admin

from .models import (
    Membership, MembershipTransfer, Permission, Profile, Role, RoleAssignment,
    RolePermission,
)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'display_name', 'gender', 'timezone', 'updated_at')
    search_fields = ('user__username', 'user__email', 'display_name')
    raw_id_fields = ('user',)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('code', 'label')
    search_fields = ('code', 'label')


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0
    autocomplete_fields = ('permission',)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('label', 'code', 'is_system', 'is_active', 'permission_count')
    list_filter = ('is_system', 'is_active')
    search_fields = ('code', 'label')
    inlines = [RolePermissionInline]

    @admin.display(description='Permissions')
    def permission_count(self, obj):
        return obj.permissions.count()


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization_node', 'is_primary', 'is_active', 'joined_at')
    list_filter = ('is_primary', 'is_active')
    search_fields = ('user__username', 'user__email', 'organization_node__name')
    raw_id_fields = ('user', 'organization_node')


@admin.register(RoleAssignment)
class RoleAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'node', 'is_active', 'start_date', 'end_date')
    list_filter = ('role', 'is_active')
    search_fields = ('user__username', 'user__email', 'node__name', 'role__code')
    raw_id_fields = ('user', 'node', 'appointed_by')


@admin.register(MembershipTransfer)
class MembershipTransferAdmin(admin.ModelAdmin):
    list_display = ('user', 'from_node', 'to_node', 'transferred_at', 'transferred_by')
    search_fields = ('user__username', 'user__email')
    raw_id_fields = ('user', 'from_node', 'to_node', 'transferred_by')
