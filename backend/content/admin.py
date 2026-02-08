from django.contrib import admin
from .models import Devotional, Manual, Podcast, Article


@admin.register(Devotional)
class DevotionalAdmin(admin.ModelAdmin):
    list_display = ['title', 'date', 'scripture', 'is_published', 'author', 'created_at']
    list_filter = ['is_published', 'date', 'author']
    search_fields = ['title', 'scripture', 'content']
    date_hierarchy = 'date'
    ordering = ['-date']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'date', 'scripture', 'scripture_text')
        }),
        ('Content', {
            'fields': ('content', 'prayer_points', 'memory_verse')
        }),
        ('Media', {
            'fields': ('featured_image',)
        }),
        ('Publishing', {
            'fields': ('is_published', 'published_at', 'author')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['publish_selected', 'unpublish_selected']
    
    def publish_selected(self, request, queryset):
        queryset.update(is_published=True)
    publish_selected.short_description = "Publish selected devotionals"
    
    def unpublish_selected(self, request, queryset):
        queryset.update(is_published=False)
    unpublish_selected.short_description = "Unpublish selected devotionals"


@admin.register(Manual)
class ManualAdmin(admin.ModelAdmin):
    list_display = ['title', 'year', 'week_number', 'theme', 'week_start', 'week_end', 'is_published']
    list_filter = ['is_published', 'year', 'author']
    search_fields = ['title', 'theme', 'lesson_content']
    ordering = ['-year', '-week_number']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'year', 'week_number', 'theme')
        }),
        ('Dates', {
            'fields': ('week_start', 'week_end')
        }),
        ('Scripture', {
            'fields': ('scripture_reference', 'scripture_text')
        }),
        ('Content', {
            'fields': ('lesson_content', 'discussion_questions', 'practical_application', 'take_home_points')
        }),
        ('Files', {
            'fields': ('pdf_file',)
        }),
        ('Publishing', {
            'fields': ('is_published', 'published_at', 'author')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['publish_selected', 'unpublish_selected']
    
    def publish_selected(self, request, queryset):
        queryset.update(is_published=True)
    publish_selected.short_description = "Publish selected manuals"
    
    def unpublish_selected(self, request, queryset):
        queryset.update(is_published=False)
    unpublish_selected.short_description = "Unpublish selected manuals"


@admin.register(Podcast)
class PodcastAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'episode_number', 'host', 'play_count', 'is_published', 'published_at']
    list_filter = ['is_published', 'category', 'season']
    search_fields = ['title', 'description', 'host', 'guests']
    ordering = ['-published_at', '-created_at']
    readonly_fields = ['play_count', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'category')
        }),
        ('Episode Details', {
            'fields': ('episode_number', 'season', 'host', 'guests')
        }),
        ('Media', {
            'fields': ('audio_file', 'duration', 'thumbnail')
        }),
        ('Statistics', {
            'fields': ('play_count',),
            'classes': ('collapse',)
        }),
        ('Publishing', {
            'fields': ('is_published', 'published_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['publish_selected', 'unpublish_selected']
    
    def publish_selected(self, request, queryset):
        queryset.update(is_published=True)
    publish_selected.short_description = "Publish selected podcasts"
    
    def unpublish_selected(self, request, queryset):
        queryset.update(is_published=False)
    unpublish_selected.short_description = "Unpublish selected podcasts"


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'author', 'is_featured', 'view_count', 'is_published', 'published_at']
    list_filter = ['is_published', 'is_featured', 'category', 'author']
    search_fields = ['title', 'excerpt', 'content', 'tags']
    prepopulated_fields = {'slug': ('title',)}
    ordering = ['-published_at', '-created_at']
    readonly_fields = ['view_count', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'slug', 'category', 'excerpt')
        }),
        ('Content', {
            'fields': ('content', 'featured_image')
        }),
        ('Metadata', {
            'fields': ('author', 'tags', 'is_featured')
        }),
        ('Statistics', {
            'fields': ('view_count',),
            'classes': ('collapse',)
        }),
        ('Publishing', {
            'fields': ('is_published', 'published_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['publish_selected', 'unpublish_selected', 'feature_selected', 'unfeature_selected']
    
    def publish_selected(self, request, queryset):
        queryset.update(is_published=True)
    publish_selected.short_description = "Publish selected articles"
    
    def unpublish_selected(self, request, queryset):
        queryset.update(is_published=False)
    unpublish_selected.short_description = "Unpublish selected articles"
    
    def feature_selected(self, request, queryset):
        queryset.update(is_featured=True)
    feature_selected.short_description = "Mark selected articles as featured"
    
    def unfeature_selected(self, request, queryset):
        queryset.update(is_featured=False)
    unfeature_selected.short_description = "Unmark selected articles as featured"
