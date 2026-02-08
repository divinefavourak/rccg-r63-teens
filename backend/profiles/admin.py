from django.contrib import admin
from .models import TeenProfile, ContentProgress, SavedContent


@admin.register(TeenProfile)
class TeenProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'school', 'grade_level', 'current_streak', 'total_devotionals_read', 'last_activity_at']
    list_filter = ['grade_level', 'devotional_reminder', 'new_content_notification']
    search_fields = ['user__username', 'user__email', 'school']
    readonly_fields = [
        'total_devotionals_read', 'total_manuals_completed', 'total_podcasts_played',
        'current_streak', 'longest_streak', 'last_activity_at',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Personal Details', {
            'fields': ('date_of_birth', 'school', 'grade_level')
        }),
        ('Interests', {
            'fields': ('interests', 'favorite_topics')
        }),
        ('Notification Preferences', {
            'fields': ('devotional_reminder', 'new_content_notification', 'event_notification')
        }),
        ('Engagement Stats', {
            'fields': (
                'total_devotionals_read', 'total_manuals_completed', 'total_podcasts_played',
                'current_streak', 'longest_streak', 'last_activity_at'
            ),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ContentProgress)
class ContentProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'content_type', 'object_id', 'status', 'progress_percentage', 'last_accessed_at']
    list_filter = ['status', 'content_type']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['last_accessed_at']
    date_hierarchy = 'last_accessed_at'


@admin.register(SavedContent)
class SavedContentAdmin(admin.ModelAdmin):
    list_display = ['user', 'content_type', 'object_id', 'note', 'saved_at']
    list_filter = ['content_type', 'saved_at']
    search_fields = ['user__username', 'user__email', 'note']
    date_hierarchy = 'saved_at'
