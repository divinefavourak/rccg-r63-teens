from django.contrib import admin
from treebeard.admin import TreeAdmin
from treebeard.forms import movenodeform_factory

from .models import HierarchyNode, Membership, RoleAssignment


@admin.register(HierarchyNode)
class HierarchyNodeAdmin(TreeAdmin):
    form = movenodeform_factory(HierarchyNode)
    list_display = ('name', 'node_type', 'code', 'is_active')
    list_filter = ('node_type', 'is_active')
    search_fields = ('name', 'code', 'slug')


@admin.register(RoleAssignment)
class RoleAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'node', 'is_active', 'assigned_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__username', 'user__email', 'node__name')
    raw_id_fields = ('user', 'node', 'assigned_by')


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'node', 'is_provisional', 'updated_at')
    list_filter = ('is_provisional',)
    search_fields = ('user__username', 'user__email', 'node__name')
    raw_id_fields = ('user', 'node')
