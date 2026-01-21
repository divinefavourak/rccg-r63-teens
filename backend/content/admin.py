"""
Django admin configuration for the content app.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import Devotional, ManualSeries, Manual, Article


@admin.register(Devotional)
class DevotionalAdmin(admin.ModelAdmin):
    """Admin for Devotional model."""
    
    list_display = [
        'date',
        'title',
        'anchor_scripture',
        'status',
        'view_count',
        'read_count',
        'has_audio_icon',
        'published_at',
    ]
    list_filter = [
        'status',
        'date',
        'created_at',
    ]
    search_fields = [
        'title',
        'content',
        'anchor_scripture',
        'key_point',
    ]
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'date'
    ordering = ['-date']
    
    readonly_fields = [
        'id', 'slug', 'view_count', 'share_count', 'read_count',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Identification', {
            'fields': ('date', 'title', 'slug')
        }),
        ('Memory Verse', {
            'fields': ('memory_verse_passage', 'memory_verse_content')
        }),
        ('Bible Reading', {
            'fields': ('bible_text_passage', 'bible_text_content', 'bible_in_one_year')
        }),
        ('Content', {
            'fields': ('content', 'key_point', 'prayer', 'confession', 'action_point', 'hymn')
        }),
        ('Media', {
            'fields': ('cover_image', 'audio_url', 'audio_file', 'audio_duration_seconds')
        }),
        ('Metadata', {
            'fields': ('author', 'tags')
        }),
        ('Publishing', {
            'fields': ('status', 'published_at', 'scheduled_for')
        }),
        ('Stats', {
            'fields': ('view_count', 'share_count', 'read_count'),
            'classes': ('collapse',)
        }),
        ('Legacy / Debug', {
             'fields': ('anchor_scripture', 'scripture_text'),
             'classes': ('collapse',)
        }),
    )
    
    def has_audio_icon(self, obj):
        if obj.has_audio:
            return format_html('<span style="color: green;">✓</span>')
        return format_html('<span style="color: #ccc;">—</span>')
    has_audio_icon.short_description = 'Audio'
    
    actions = ['publish_selected', 'archive_selected']
    
    @admin.action(description='Publish selected devotionals')
    def publish_selected(self, request, queryset):
        queryset.update(status='published')
    
    @admin.action(description='Archive selected devotionals')
    def archive_selected(self, request, queryset):
        queryset.update(status='archived')


@admin.register(ManualSeries)
class ManualSeriesAdmin(admin.ModelAdmin):
    """Admin for ManualSeries model."""
    
    list_display = [
        'title',
        'start_date',
        'end_date',
        'manual_count',
        'status',
    ]
    list_filter = ['status', 'start_date']
    search_fields = ['title', 'description']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    def manual_count(self, obj):
        return obj.manuals.count()
    manual_count.short_description = 'Manuals'


@admin.register(Manual)
class ManualAdmin(admin.ModelAdmin):
    """Admin for Manual model."""
    
    list_display = [
        'week_number',
        'title',
        'series',
        'week_start_date',
        'target_age_group',
        'status',
        'view_count',
        'download_count',
    ]
    list_filter = [
        'status',
        'series',
        'target_age_group',
        'week_start_date',
    ]
    search_fields = ['title', 'theme', 'memory_verse']
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'week_start_date'
    ordering = ['-week_start_date']
    
    readonly_fields = [
        'id', 'slug', 'view_count', 'download_count',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Week Info', {
            'fields': ('series', 'week_number', 'week_start_date', 'week_end_date')
        }),
        ('Content', {
            'fields': ('title', 'slug', 'theme', 'memory_verse', 'memory_verse_text')
        }),
        ('Lesson Content', {
            'fields': (
                'lesson_objectives', 'lesson_content', 'key_takeaways',
                'discussion_questions', 'practical_application', 'activity_suggestions'
            )
        }),
        ('Prayer', {
            'fields': ('opening_prayer_points', 'closing_prayer'),
            'classes': ('collapse',)
        }),
        ('Resources', {
            'fields': ('cover_image', 'pdf_url', 'pdf_file', 'additional_resources')
        }),
        ('Publishing', {
            'fields': ('target_age_group', 'status', 'published_at', 'scheduled_for')
        }),
        ('Stats', {
            'fields': ('view_count', 'download_count'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    """Admin for Article model."""
    
    list_display = [
        'title',
        'category',
        'author_name',
        'is_featured',
        'status',
        'view_count',
        'published_at',
    ]
    list_filter = ['status', 'category', 'is_featured', 'is_pinned']
    search_fields = ['title', 'content', 'excerpt', 'author_name']
    prepopulated_fields = {'slug': ('title',)}
    ordering = ['-published_at']
    
    readonly_fields = [
        'id', 'slug', 'view_count', 'share_count', 'read_time_minutes',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Content', {
            'fields': ('title', 'slug', 'excerpt', 'content')
        }),
        ('Categorization', {
            'fields': ('category', 'tags')
        }),
        ('Author', {
            'fields': ('author_name', 'author_bio', 'author_image')
        }),
        ('Media', {
            'fields': ('cover_image', 'featured_image_caption')
        }),
        ('Publishing', {
            'fields': ('status', 'is_featured', 'is_pinned', 'published_at', 'scheduled_for')
        }),
        ('Stats', {
            'fields': ('view_count', 'share_count', 'read_time_minutes'),
            'classes': ('collapse',)
        }),
    )
