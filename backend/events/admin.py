"""
Django admin configuration for the events app.
"""
from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from django.db.models import Count, Sum
from .models import Event, EventRegistration, BulkUpload, RegistrationAuditLog


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    """Admin for Event model."""
    
    list_display = [
        'title',
        'event_type',
        'start_datetime',
        'venue',
        'registration_status_badge',
        'registration_stats',
        'status',
        'is_featured',
    ]
    list_filter = [
        'status',
        'event_type',
        'registration_status',
        'is_featured',
        'is_virtual',
        'is_free',
        'start_datetime',
    ]
    search_fields = ['title', 'description', 'venue']
    prepopulated_fields = {'slug': ('title',)}
    ordering = ['-start_datetime']
    date_hierarchy = 'start_datetime'
    
    readonly_fields = [
        'id', 'slug', 'registration_count', 'waitlist_count',
        'checked_in_count', 'view_count', 'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Event Details', {
            'fields': (
                'title', 'slug', 'event_type', 'description', 'short_description'
            )
        }),
        ('Date & Time', {
            'fields': ('start_datetime', 'end_datetime', 'timezone_name')
        }),
        ('Location', {
            'fields': (
                'venue', 'address', 'city', 'state', 'latitude', 'longitude',
                'is_virtual', 'is_hybrid', 'virtual_link', 'virtual_platform'
            )
        }),
        ('Media', {
            'fields': ('cover_image', 'gallery_images', 'promotional_video_url')
        }),
        ('Registration', {
            'fields': (
                'registration_status', 'registration_opens', 'registration_closes',
                'max_attendees', 'waitlist_enabled', 'max_waitlist'
            )
        }),
        ('Pricing', {
            'fields': (
                'is_free', 'price', 'early_bird_price', 'early_bird_deadline',
                'group_discount_threshold', 'group_discount_price'
            )
        }),
        ('Eligibility', {
            'fields': (
                'target_provinces', 'target_age_groups', 'min_age', 'max_age',
                'requires_guardian_consent'
            ),
            'classes': ('collapse',)
        }),
        ('Organizer', {
            'fields': (
                'organizer_name', 'organizer_email', 'organizer_phone',
                'organizer_website'
            ),
            'classes': ('collapse',)
        }),
        ('Additional Info', {
            'fields': ('what_to_bring', 'schedule', 'faqs'),
            'classes': ('collapse',)
        }),
        ('Publishing', {
            'fields': ('is_featured', 'status', 'published_at', 'scheduled_for')
        }),
        ('Stats', {
            'fields': (
                'registration_count', 'waitlist_count', 'checked_in_count', 'view_count'
            ),
            'classes': ('collapse',)
        }),
    )
    
    def registration_status_badge(self, obj):
        colors = {
            'not_open': '#9E9E9E',
            'open': '#4CAF50',
            'closed': '#F44336',
            'full': '#FF9800',
        }
        color = colors.get(obj.registration_status, '#999')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color, obj.get_registration_status_display()
        )
    registration_status_badge.short_description = 'Reg. Status'
    
    def registration_stats(self, obj):
        return format_html(
            '<span title="Checked-in / Registered / Max">{} / {} / {}</span>',
            obj.checked_in_count,
            obj.registration_count,
            obj.max_attendees or '∞'
        )
    registration_stats.short_description = 'Attendance'
    
    actions = ['open_registration', 'close_registration']
    
    @admin.action(description='Open registration')
    def open_registration(self, request, queryset):
        queryset.update(registration_status='open')
    
    @admin.action(description='Close registration')
    def close_registration(self, request, queryset):
        queryset.update(registration_status='closed')


@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    """Admin for EventRegistration model."""
    
    list_display = [
        'registration_id',
        'attendee_name',
        'event',
        'attendee_province',
        'status_badge',
        'payment_status_badge',
        'checked_in_at',
        'created_at',
    ]
    list_filter = [
        'status',
        'payment_status',
        'registration_type',
        'event',
        'attendee_province',
        'guardian_consent',
        'created_at',
    ]
    search_fields = [
        'registration_id',
        'attendee_name',
        'attendee_email',
        'attendee_phone',
        'guardian_name',
    ]
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    raw_id_fields = ['event', 'user', 'profile', 'payment']
    
    readonly_fields = [
        'id', 'registration_id', 'qr_code',
        'approved_at', 'cancelled_at', 'checked_in_at',
        'consent_timestamp', 'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Registration Info', {
            'fields': ('registration_id', 'event', 'user', 'profile', 'registration_type')
        }),
        ('Attendee', {
            'fields': (
                'attendee_name', 'attendee_email', 'attendee_phone',
                'attendee_age', 'attendee_gender', 'attendee_date_of_birth',
                'attendee_category'
            )
        }),
        ('Church', {
            'fields': (
                'attendee_province', 'attendee_zone', 'attendee_area',
                'attendee_parish', 'attendee_department'
            )
        }),
        ('Guardian', {
            'fields': (
                'guardian_name', 'guardian_phone', 'guardian_email',
                'guardian_relationship', 'guardian_consent', 'consent_timestamp'
            )
        }),
        ('Emergency Contact', {
            'fields': (
                'emergency_contact_name', 'emergency_contact_phone',
                'emergency_contact_relationship'
            ),
            'classes': ('collapse',)
        }),
        ('Medical', {
            'fields': (
                'medical_conditions', 'allergies', 'medications',
                'dietary_restrictions', 'special_needs'
            ),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('status', 'payment_status')
        }),
        ('Payment', {
            'fields': (
                'amount_due', 'amount_paid', 'payment', 'payment_reference',
                'proof_of_payment'
            )
        }),
        ('Check-in', {
            'fields': (
                'checked_in_at', 'checked_in_by', 'check_in_method', 'check_in_notes',
                'qr_code'
            )
        }),
        ('Workflow', {
            'fields': (
                'registered_by', 'approved_by', 'approved_at',
                'cancelled_by', 'cancelled_at', 'cancellation_reason'
            ),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes', 'internal_notes'),
            'classes': ('collapse',)
        }),
    )
    
    def status_badge(self, obj):
        colors = {
            'pending': '#FF9800',
            'confirmed': '#4CAF50',
            'cancelled': '#F44336',
            'waitlisted': '#9C27B0',
            'checked_in': '#2196F3',
            'no_show': '#607D8B',
        }
        color = colors.get(obj.status, '#999')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def payment_status_badge(self, obj):
        colors = {
            'not_required': '#9E9E9E',
            'pending': '#FF9800',
            'paid': '#4CAF50',
            'refunded': '#2196F3',
            'failed': '#F44336',
        }
        color = colors.get(obj.payment_status, '#999')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color, obj.get_payment_status_display()
        )
    payment_status_badge.short_description = 'Payment'
    
    actions = ['confirm_registrations', 'check_in_registrations']
    
    @admin.action(description='Confirm selected registrations')
    def confirm_registrations(self, request, queryset):
        for reg in queryset:
            reg.confirm(request.user)
    
    @admin.action(description='Check-in selected registrations')
    def check_in_registrations(self, request, queryset):
        for reg in queryset:
            reg.check_in(request.user, method='admin')


@admin.register(BulkUpload)
class BulkUploadAdmin(admin.ModelAdmin):
    """Admin for BulkUpload model."""
    
    list_display = [
        'filename',
        'event',
        'uploaded_by',
        'total_records',
        'successful_records',
        'failed_records',
        'status',
        'created_at',
    ]
    list_filter = ['status', 'event', 'created_at']
    search_fields = ['filename', 'event__title']
    readonly_fields = [
        'id', 'filename', 'total_records', 'successful_records',
        'failed_records', 'status', 'error_log', 'error_details',
        'processed_at', 'created_at', 'updated_at'
    ]


@admin.register(RegistrationAuditLog)
class RegistrationAuditLogAdmin(admin.ModelAdmin):
    """Admin for RegistrationAuditLog model."""
    
    list_display = [
        'registration',
        'action',
        'user',
        'timestamp',
    ]
    list_filter = ['action', 'timestamp']
    search_fields = ['registration__registration_id', 'user__username']
    readonly_fields = [
        'id', 'registration', 'user', 'action', 'old_values',
        'new_values', 'ip_address', 'user_agent', 'timestamp'
    ]
    ordering = ['-timestamp']
