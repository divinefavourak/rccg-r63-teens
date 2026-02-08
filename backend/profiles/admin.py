"""
Django admin configuration for the profiles app.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import TeenProfile, DevotionalProgress, ManualProgress, Favorite


@admin.register(TeenProfile)
class TeenProfileAdmin(admin.ModelAdmin):
    """Admin for TeenProfile model."""
    
    list_display = [
        'get_full_name',
        'user',
        'age',
        'age_group',
        'province',
        'parish',
        'streak_days',
        'devotionals_read_count',
        'created_at',
    ]
    list_filter = [
        'age_group',
        'gender',
        'province',
        'created_at',
    ]
    search_fields = [
        'user__username',
        'user__email',
        'user__first_name',
        'user__last_name',
        'parish',
        'guardian_name',
    ]
    readonly_fields = [
        'id',
        'age',
        'age_group',
        'devotionals_read_count',
        'events_attended_count',
        'streak_days',
        'longest_streak',
        'last_active_at',
        'last_devotional_date',
        'created_at',
        'updated_at',
    ]
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Personal Information', {
            'fields': (
                'date_of_birth', 'age', 'age_group', 'gender', 'bio', 'avatar'
            )
        }),
        ('Church Hierarchy', {
            'fields': ('province', 'zone', 'area', 'parish', 'department')
        }),
        ('Guardian Information', {
            'fields': (
                'guardian_name', 'guardian_phone', 
                'guardian_email', 'guardian_relationship'
            )
        }),
        ('Emergency Contact', {
            'fields': (
                'emergency_contact_name', 'emergency_contact_phone',
                'emergency_contact_relationship'
            ),
            'classes': ('collapse',)
        }),
        ('Medical Information', {
            'fields': (
                'medical_conditions', 'allergies', 'medications',
                'dietary_restrictions', 'blood_group'
            ),
            'classes': ('collapse',)
        }),
        ('Preferences', {
            'fields': ('favorite_devotional_topics', 'notification_preferences'),
            'classes': ('collapse',)
        }),
        ('Engagement Stats', {
            'fields': (
                'devotionals_read_count', 'events_attended_count',
                'streak_days', 'longest_streak',
                'last_active_at', 'last_devotional_date'
            )
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
    get_full_name.short_description = 'Name'
    
    def age(self, obj):
        return obj.age
    age.short_description = 'Age'


@admin.register(DevotionalProgress)
class DevotionalProgressAdmin(admin.ModelAdmin):
    """Admin for DevotionalProgress model."""
    
    list_display = ['profile', 'devotional_id', 'read_at', 'completion_percentage']
    list_filter = ['read_at', 'completion_percentage']
    search_fields = ['profile__user__username', 'profile__user__email']
    readonly_fields = ['id', 'read_at', 'created_at', 'updated_at']


@admin.register(ManualProgress)
class ManualProgressAdmin(admin.ModelAdmin):
    """Admin for ManualProgress model."""
    
    list_display = ['profile', 'manual_id', 'started_at', 'completed_at', 'completion_percentage']
    list_filter = ['started_at', 'completed_at']
    search_fields = ['profile__user__username']
    readonly_fields = ['id', 'started_at', 'created_at', 'updated_at']


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    """Admin for Favorite model."""
    
    list_display = ['profile', 'content_type', 'content_id', 'created_at']
    list_filter = ['content_type', 'created_at']
    search_fields = ['profile__user__username']
    readonly_fields = ['id', 'created_at', 'updated_at']
