from django.contrib import admin
from .models import Ticket, BulkUpload, TicketAuditLog


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    """Admin configuration for Ticket model"""
    list_display = (
        'ticket_id', 'full_name', 'age', 'category', 'gender',
        'province', 'status', 'registered_at', 'registered_by'
    )
    list_filter = (
        'status', 'category', 'gender', 'province',
        'zone', 'area', 'registered_at'
    )
    search_fields = (
        'ticket_id', 'full_name', 'email', 'phone',
        'province', 'zone', 'area', 'parish'
    )
    readonly_fields = ('ticket_id', 'registered_at', 'created_at', 'updated_at')
    fieldsets = (
        ('Ticket Information', {
            'fields': ('ticket_id', 'status', 'notes')
        }),
        ('Personal Information', {
            'fields': ('full_name', 'age', 'date_of_birth', 'category', 'gender')
        }),
        ('Contact Information', {
            'fields': ('phone', 'email')
        }),
        ('Church Hierarchy', {
            'fields': ('province', 'zone', 'area', 'parish', 'department')
        }),
        ('Medical Information', {
            'fields': ('medical_conditions', 'medications', 'dietary_restrictions'),
            'classes': ('collapse',)
        }),
        ('Emergency Contact', {
            'fields': ('emergency_contact', 'emergency_phone', 'emergency_relationship')
        }),
        ('Parent/Guardian Information', {
            'fields': ('parent_name', 'parent_email', 'parent_phone', 'parent_relationship')
        }),
        ('Registration Details', {
            'fields': ('registered_at', 'registered_by', 'approved_at', 'approved_by')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(BulkUpload)
class BulkUploadAdmin(admin.ModelAdmin):
    """Admin configuration for BulkUpload model"""
    list_display = ('filename', 'uploaded_by', 'status', 'total_records', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('filename', 'uploaded_by__username')
    readonly_fields = ('created_at', 'processed_at', 'error_log')


@admin.register(TicketAuditLog)
class TicketAuditLogAdmin(admin.ModelAdmin):
    """Admin configuration for TicketAuditLog model"""
    list_display = ('user', 'action', 'ticket', 'timestamp')
    list_filter = ('action', 'timestamp')
    search_fields = ('user__username', 'ticket__ticket_id', 'ticket__full_name')
    readonly_fields = ('timestamp',)
    date_hierarchy = 'timestamp'