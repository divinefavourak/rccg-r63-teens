"""
Django admin configuration for the media app.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import MediaCategory, MediaSeries, MediaEpisode, Playlist, PlaylistEpisode


@admin.register(MediaCategory)
class MediaCategoryAdmin(admin.ModelAdmin):
    """Admin for MediaCategory model."""
    
    list_display = [
        'name',
        'slug',
        'is_featured',
        'is_active',
        'order',
        'series_count',
    ]
    list_filter = ['is_featured', 'is_active']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    ordering = ['order', 'name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    def series_count(self, obj):
        return obj.series.count()
    series_count.short_description = 'Series'


@admin.register(MediaSeries)
class MediaSeriesAdmin(admin.ModelAdmin):
    """Admin for MediaSeries model."""
    
    list_display = [
        'title',
        'category',
        'host_name',
        'episode_count',
        'subscriber_count',
        'is_featured',
        'status',
    ]
    list_filter = ['status', 'category', 'is_featured']
    search_fields = ['title', 'description', 'host_name']
    prepopulated_fields = {'slug': ('title',)}
    ordering = ['-created_at']
    
    readonly_fields = [
        'id', 'subscriber_count', 'total_listen_count',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('category', 'title', 'slug', 'description', 'short_description')
        }),
        ('Branding', {
            'fields': ('cover_image', 'banner_image')
        }),
        ('Host', {
            'fields': ('host_name', 'host_bio', 'host_image')
        }),
        ('External Links', {
            'fields': (
                'rss_feed_url', 'website_url', 'apple_podcasts_url',
                'spotify_url', 'youtube_channel_url'
            ),
            'classes': ('collapse',)
        }),
        ('Publishing', {
            'fields': (
                'release_frequency', 'order', 'is_featured',
                'status', 'published_at', 'scheduled_for'
            )
        }),
        ('Stats', {
            'fields': ('subscriber_count', 'total_listen_count'),
            'classes': ('collapse',)
        }),
    )
    
    def episode_count(self, obj):
        return obj.episodes.count()
    episode_count.short_description = 'Episodes'


@admin.register(MediaEpisode)
class MediaEpisodeAdmin(admin.ModelAdmin):
    """Admin for MediaEpisode model."""
    
    list_display = [
        'title',
        'series',
        'episode_number',
        'media_type_badge',
        'duration_display',
        'play_count',
        'status',
        'published_at',
    ]
    list_filter = [
        'status',
        'media_type',
        'series',
        'is_featured',
        'is_premium',
    ]
    search_fields = ['title', 'description', 'tags']
    ordering = ['-published_at']
    date_hierarchy = 'published_at'
    
    readonly_fields = [
        'id', 'slug', 'view_count', 'play_count', 'like_count',
        'share_count', 'download_count', 'completion_rate',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Episode Info', {
            'fields': (
                'series', 'episode_number', 'season_number',
                'title', 'slug', 'description', 'show_notes'
            )
        }),
        ('Thumbnail', {
            'fields': ('thumbnail',)
        }),
        ('Audio', {
            'fields': (
                'audio_url', 'audio_file', 'audio_duration_seconds',
                'audio_file_size_bytes', 'audio_mime_type'
            ),
            'classes': ('collapse',)
        }),
        ('Video', {
            'fields': (
                'video_url', 'video_file', 'video_duration_seconds',
                'video_file_size_bytes', 'video_mime_type', 'video_resolution'
            ),
            'classes': ('collapse',)
        }),
        ('Streaming', {
            'fields': ('hls_url', 'dash_url', 'embed_code', 'external_video_id'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('media_type', 'tags', 'guests', 'chapters', 'transcript'),
            'classes': ('collapse',)
        }),
        ('Publishing', {
            'fields': (
                'is_featured', 'is_premium', 'is_explicit', 'order',
                'status', 'published_at', 'scheduled_for'
            )
        }),
        ('Stats', {
            'fields': (
                'view_count', 'play_count', 'like_count',
                'share_count', 'download_count', 'completion_rate'
            ),
            'classes': ('collapse',)
        }),
    )
    
    def media_type_badge(self, obj):
        colors = {
            'audio': '#4CAF50',
            'video': '#2196F3',
            'both': '#9C27B0',
        }
        color = colors.get(obj.media_type, '#999')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color, obj.get_media_type_display()
        )
    media_type_badge.short_description = 'Type'
    
    def duration_display(self, obj):
        return obj.duration_formatted or '—'
    duration_display.short_description = 'Duration'
    
    actions = ['publish_selected']
    
    @admin.action(description='Publish selected episodes')
    def publish_selected(self, request, queryset):
        from django.utils import timezone
        queryset.update(status='published', published_at=timezone.now())


class PlaylistEpisodeInline(admin.TabularInline):
    """Inline for playlist episodes."""
    
    model = PlaylistEpisode
    extra = 1
    ordering = ['order']
    autocomplete_fields = ['episode']


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    """Admin for Playlist model."""
    
    list_display = [
        'title',
        'created_by',
        'episode_count',
        'is_public',
        'is_featured',
        'is_system',
    ]
    list_filter = ['is_public', 'is_featured', 'is_system']
    search_fields = ['title', 'description']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [PlaylistEpisodeInline]
    
    def episode_count(self, obj):
        return obj.episodes.count()
    episode_count.short_description = 'Episodes'
