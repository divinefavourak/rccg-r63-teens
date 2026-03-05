"""
Media models for the RCCG R63 Teens platform.
Supports podcasts and video content with audio-only, video-only, or both.
"""
from django.db import models
from django.utils.text import slugify
from common.models import (
    TimestampMixin, UUIDMixin, PublishableMixin, 
    OrderableMixin, ViewableMixin
)
import uuid


class MediaCategory(UUIDMixin, TimestampMixin, OrderableMixin):
    """
    Category/channel for organizing media content.
    E.g., "Teen Talk", "Worship", "Testimonies"
    """
    
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, db_index=True)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to='media_categories/', null=True, blank=True)
    icon = models.CharField(max_length=50, blank=True)  # Icon name for UI
    color = models.CharField(max_length=7, blank=True)  # Hex color code
    is_featured = models.BooleanField(default=False, db_index=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Media Category'
        verbose_name_plural = 'Media Categories'
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:120]
        super().save(*args, **kwargs)
    
    @property
    def series_count(self):
        return self.series.filter(status='published').count()


class MediaSeries(UUIDMixin, TimestampMixin, PublishableMixin):
    """
    A podcast series or show.
    Groups episodes together under a common theme.
    """
    
    category = models.ForeignKey(
        MediaCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='series'
    )
    
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, unique=True, db_index=True)
    description = models.TextField()
    short_description = models.CharField(max_length=500, blank=True)
    
    # Branding
    cover_image = models.ImageField(upload_to='media_series/')
    banner_image = models.ImageField(upload_to='media_series_banners/', null=True, blank=True)
    
    # Host/Author
    host_name = models.CharField(max_length=255)
    host_bio = models.TextField(blank=True)
    host_image = models.ImageField(upload_to='media_hosts/', null=True, blank=True)
    
    # External links
    rss_feed_url = models.URLField(blank=True)
    website_url = models.URLField(blank=True)
    apple_podcasts_url = models.URLField(blank=True)
    spotify_url = models.URLField(blank=True)
    youtube_channel_url = models.URLField(blank=True)
    
    # Release schedule
    release_frequency = models.CharField(max_length=50, blank=True)  # e.g., "Weekly on Thursdays"
    
    # Stats
    subscriber_count = models.PositiveIntegerField(default=0)
    total_listen_count = models.PositiveIntegerField(default=0)
    
    # Ordering
    order = models.PositiveIntegerField(default=0)
    is_featured = models.BooleanField(default=False, db_index=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Media Series'
        verbose_name_plural = 'Media Series'
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['is_featured', 'status']),
        ]
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:300]
        super().save(*args, **kwargs)
    
    @property
    def episode_count(self):
        return self.episodes.filter(status='published').count()
    
    @property
    def latest_episode(self):
        return self.episodes.filter(status='published').order_by('-published_at').first()


class MediaEpisode(UUIDMixin, TimestampMixin, PublishableMixin, ViewableMixin):
    """
    Individual podcast/media episode.
    Supports: audio-only, video-only, or both audio and video.
    """
    
    class MediaType(models.TextChoices):
        AUDIO_ONLY = 'audio', 'Audio Only'
        VIDEO_ONLY = 'video', 'Video Only'
        AUDIO_AND_VIDEO = 'both', 'Audio & Video'
    
    # Series relationship (optional — standalone episodes are allowed)
    series = models.ForeignKey(
        MediaSeries,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='episodes'
    )
    
    # Episode identification
    episode_number = models.PositiveIntegerField(null=True, blank=True)
    season_number = models.PositiveIntegerField(null=True, blank=True)
    
    # Content metadata
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, unique=True, db_index=True)
    description = models.TextField()
    show_notes = models.TextField(blank=True)  # Markdown for timestamps, links
    
    # Thumbnail/Cover
    thumbnail = models.ImageField(upload_to='media_thumbnails/', null=True, blank=True)
    
    # Media Type Indicator
    media_type = models.CharField(
        max_length=10,
        choices=MediaType.choices,
        default=MediaType.AUDIO_ONLY
    )
    
    # =====================
    # AUDIO (optional - for audio-only or audio+video)
    # =====================
    audio_url = models.URLField(blank=True)
    audio_file = models.FileField(upload_to='media_audio/', blank=True)
    audio_duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    audio_file_size_bytes = models.PositiveIntegerField(null=True, blank=True)
    audio_mime_type = models.CharField(max_length=50, blank=True)  # e.g., audio/mpeg
    
    # =====================
    # VIDEO (optional - for video-only or audio+video)
    # =====================
    video_url = models.URLField(blank=True)
    video_file = models.FileField(upload_to='media_video/', blank=True)
    video_duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    video_file_size_bytes = models.PositiveIntegerField(null=True, blank=True)
    video_mime_type = models.CharField(max_length=50, blank=True)  # e.g., video/mp4
    video_resolution = models.CharField(max_length=20, blank=True)  # e.g., "1920x1080"
    
    # =====================
    # CDN/Streaming ready fields
    # =====================
    hls_url = models.URLField(blank=True)  # For HLS streaming
    dash_url = models.URLField(blank=True)  # For DASH streaming
    embed_code = models.TextField(blank=True)  # YouTube/Vimeo embed
    external_video_id = models.CharField(max_length=100, blank=True)  # YouTube video ID etc.
    
    # =====================
    # Engagement & Analytics
    # =====================
    play_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)
    
    # Completion tracking (for analytics)
    completion_rate = models.FloatField(default=0)  # Average % of episode completed
    
    # =====================
    # Content metadata
    # =====================
    tags = models.JSONField(default=list, blank=True)  # ["faith", "teens", "prayer"]
    guests = models.JSONField(default=list, blank=True)  # List of guest names
    transcript = models.TextField(blank=True)  # Full transcript
    
    # Chapters/Timestamps
    chapters = models.JSONField(default=list, blank=True)
    # Format: [{"time": 0, "title": "Intro"}, {"time": 120, "title": "Topic 1"}]
    
    # =====================
    # Visibility & Sorting
    # =====================
    is_featured = models.BooleanField(default=False, db_index=True)
    is_premium = models.BooleanField(default=False)  # For future paywall
    is_explicit = models.BooleanField(default=False)  # Content warning
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['-published_at', '-created_at']
        verbose_name = 'Media Episode'
        verbose_name_plural = 'Media Episodes'
        indexes = [
            models.Index(fields=['series', 'episode_number']),
            models.Index(fields=['status', 'published_at']),
            models.Index(fields=['media_type']),
            models.Index(fields=['is_featured', 'status']),
        ]
    
    def __str__(self):
        series_title = self.series.title if self.series else 'Standalone'
        return f"{series_title} - {self.title}"

    def save(self, *args, **kwargs):
        if not self.slug:
            series_prefix = self.series.title if self.series else ''
            base = f"{series_prefix}-{self.title}" if series_prefix else self.title
            self.slug = slugify(base)[:300]
        
        # Auto-detect media type based on what's available
        if not self.media_type or self.media_type == self.MediaType.AUDIO_ONLY:
            has_audio = bool(self.audio_url or self.audio_file)
            has_video = bool(self.video_url or self.video_file or self.hls_url)
            
            if has_audio and has_video:
                self.media_type = self.MediaType.AUDIO_AND_VIDEO
            elif has_video:
                self.media_type = self.MediaType.VIDEO_ONLY
            else:
                self.media_type = self.MediaType.AUDIO_ONLY
        
        super().save(*args, **kwargs)
    
    @property
    def duration_seconds(self):
        """Return primary duration (video takes precedence if both exist)."""
        return self.video_duration_seconds or self.audio_duration_seconds
    
    @property
    def duration_formatted(self):
        """Return duration in HH:MM:SS format."""
        if not self.duration_seconds:
            return None
        hours, remainder = divmod(self.duration_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        if hours:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes}:{seconds:02d}"
    
    @property
    def has_audio(self):
        return bool(self.audio_url or self.audio_file)
    
    @property
    def has_video(self):
        return bool(self.video_url or self.video_file or self.hls_url)
    
    @property
    def file_size_bytes(self):
        """Return primary file size."""
        return self.video_file_size_bytes or self.audio_file_size_bytes
    
    def increment_play_count(self):
        """Thread-safe play count increment."""
        MediaEpisode.objects.filter(pk=self.pk).update(
            play_count=models.F('play_count') + 1
        )


class Playlist(UUIDMixin, TimestampMixin):
    """
    Curated playlist of media episodes.
    Can be system-created (featured) or user-created.
    """
    
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, unique=True)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to='playlists/', null=True, blank=True)
    
    # Episodes in this playlist (ordered)
    episodes = models.ManyToManyField(
        MediaEpisode,
        through='PlaylistEpisode',
        related_name='playlists'
    )
    
    # Creator (null for system playlists)
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='playlists'
    )
    
    # Visibility
    is_public = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    is_system = models.BooleanField(default=False)  # System-created playlists
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title
    
    @property
    def episode_count(self):
        return self.episodes.count()
    
    @property
    def total_duration_seconds(self):
        return sum(
            ep.duration_seconds or 0 
            for ep in self.episodes.all()
        )


class PlaylistEpisode(UUIDMixin, TimestampMixin):
    """Through model for Playlist-Episode relationship with ordering."""
    
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)
    episode = models.ForeignKey(MediaEpisode, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['order']
        unique_together = [['playlist', 'episode']]
