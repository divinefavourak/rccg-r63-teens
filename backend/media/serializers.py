"""
Serializers for the media app (podcasts, videos, playlists).
"""
from rest_framework import serializers
from .models import MediaCategory, MediaSeries, MediaEpisode, Playlist, PlaylistEpisode


# =====================
# CATEGORY SERIALIZERS
# =====================

class MediaCategorySerializer(serializers.ModelSerializer):
    """Serializer for media categories."""
    
    series_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = MediaCategory
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'cover_image',
            'icon',
            'color',
            'is_featured',
            'is_active',
            'order',
            'series_count',
        ]


# =====================
# SERIES SERIALIZERS
# =====================

class MediaSeriesListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing series."""
    
    category_name = serializers.CharField(source='category.name', read_only=True)
    episode_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = MediaSeries
        fields = [
            'id',
            'category',
            'category_name',
            'title',
            'slug',
            'short_description',
            'cover_image',
            'host_name',
            'episode_count',
            'subscriber_count',
            'is_featured',
            'status',
        ]


class MediaSeriesDetailSerializer(serializers.ModelSerializer):
    """Full serializer for a media series."""
    
    category_detail = MediaCategorySerializer(source='category', read_only=True)
    episode_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = MediaSeries
        fields = [
            'id',
            'category',
            'category_detail',
            'title',
            'slug',
            'description',
            'short_description',
            'cover_image',
            'banner_image',
            'host_name',
            'host_bio',
            'host_image',
            'rss_feed_url',
            'website_url',
            'apple_podcasts_url',
            'spotify_url',
            'youtube_channel_url',
            'release_frequency',
            'subscriber_count',
            'total_listen_count',
            'episode_count',
            'order',
            'is_featured',
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]


# =====================
# EPISODE SERIALIZERS
# =====================

class MediaEpisodeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing episodes."""
    
    series_title = serializers.CharField(source='series.title', read_only=True)
    duration_formatted = serializers.CharField(read_only=True)
    has_audio = serializers.BooleanField(read_only=True)
    has_video = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = MediaEpisode
        fields = [
            'id',
            'series',
            'series_title',
            'episode_number',
            'season_number',
            'title',
            'slug',
            'description',
            'thumbnail',
            'media_type',
            'has_audio',
            'has_video',
            'duration_seconds',
            'duration_formatted',
            'published_at',
            'view_count',
            'play_count',
            'is_featured',
            'status',
        ]


class MediaEpisodeDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing an episode with all media URLs."""
    
    series_detail = MediaSeriesListSerializer(source='series', read_only=True)
    duration_formatted = serializers.CharField(read_only=True)
    has_audio = serializers.BooleanField(read_only=True)
    has_video = serializers.BooleanField(read_only=True)
    file_size_bytes = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = MediaEpisode
        fields = [
            'id',
            'series',
            'series_detail',
            
            # Episode info
            'episode_number',
            'season_number',
            'title',
            'slug',
            'description',
            'show_notes',
            'thumbnail',
            
            # Media type
            'media_type',
            'has_audio',
            'has_video',
            
            # Audio URLs
            'audio_url',
            'audio_file',
            'audio_duration_seconds',
            'audio_file_size_bytes',
            'audio_mime_type',
            
            # Video URLs
            'video_url',
            'video_file',
            'video_duration_seconds',
            'video_file_size_bytes',
            'video_mime_type',
            'video_resolution',
            
            # Streaming URLs
            'hls_url',
            'dash_url',
            'embed_code',
            'external_video_id',
            
            # Duration
            'duration_seconds',
            'duration_formatted',
            'file_size_bytes',
            
            # Engagement
            'view_count',
            'play_count',
            'like_count',
            'share_count',
            'download_count',
            
            # Metadata
            'tags',
            'guests',
            'transcript',
            'chapters',
            
            # Flags
            'is_featured',
            'is_premium',
            'is_explicit',
            'order',
            
            # Status
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]


class MediaEpisodeCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating episodes (admin only).

    Accepts a generic ``file`` field (write-only) and routes it to
    ``audio_file`` or ``video_file`` based on ``media_type``.
    Also accepts ``duration`` (string "MM:SS") and stores it as seconds.
    """

    # Generic upload field — maps to audio_file / video_file in create/update
    file = serializers.FileField(write_only=True, required=False)
    # Human-readable duration e.g. "15:30"
    duration = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = MediaEpisode
        fields = [
            'series',
            'episode_number',
            'season_number',
            'title',
            'slug',
            'description',
            'show_notes',
            'thumbnail',
            'media_type',

            # Generic upload helpers
            'file',
            'duration',

            # Audio
            'audio_url',
            'audio_file',
            'audio_duration_seconds',
            'audio_file_size_bytes',
            'audio_mime_type',

            # Video
            'video_url',
            'video_file',
            'video_duration_seconds',
            'video_file_size_bytes',
            'video_mime_type',
            'video_resolution',

            # Streaming
            'hls_url',
            'dash_url',
            'embed_code',
            'external_video_id',

            # Metadata
            'tags',
            'guests',
            'transcript',
            'chapters',

            # Flags
            'is_featured',
            'is_premium',
            'is_explicit',
            'order',

            # Publishing
            'status',
            'published_at',
            'scheduled_for',
        ]

    def _parse_duration_seconds(self, duration_str: str) -> int:
        """Convert 'MM:SS' or 'HH:MM:SS' to total seconds."""
        try:
            parts = [int(p) for p in duration_str.strip().split(':')]
            if len(parts) == 2:
                return parts[0] * 60 + parts[1]
            if len(parts) == 3:
                return parts[0] * 3600 + parts[1] * 60 + parts[2]
        except (ValueError, AttributeError):
            pass
        return 0

    def _route_file(self, validated_data: dict) -> dict:
        """Move generic ``file`` into ``audio_file`` or ``video_file``."""
        uploaded = validated_data.pop('file', None)
        if uploaded:
            media_type = validated_data.get('media_type', 'audio')
            if media_type == 'video':
                validated_data.setdefault('video_file', uploaded)
            else:
                validated_data.setdefault('audio_file', uploaded)
        return validated_data

    def _route_duration(self, validated_data: dict) -> dict:
        """Convert ``duration`` string into the correct seconds field."""
        duration_str = validated_data.pop('duration', None)
        if duration_str:
            seconds = self._parse_duration_seconds(duration_str)
            media_type = validated_data.get('media_type', 'audio')
            if media_type == 'video':
                validated_data.setdefault('video_duration_seconds', seconds)
            else:
                validated_data.setdefault('audio_duration_seconds', seconds)
        return validated_data

    def create(self, validated_data):
        validated_data = self._route_file(validated_data)
        validated_data = self._route_duration(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._route_file(validated_data)
        validated_data = self._route_duration(validated_data)
        return super().update(instance, validated_data)


# =====================
# PLAYLIST SERIALIZERS
# =====================

class PlaylistEpisodeSerializer(serializers.ModelSerializer):
    """Serializer for playlist episodes."""
    
    episode_detail = MediaEpisodeListSerializer(source='episode', read_only=True)
    
    class Meta:
        model = PlaylistEpisode
        fields = [
            'id',
            'episode',
            'episode_detail',
            'order',
        ]


class PlaylistSerializer(serializers.ModelSerializer):
    """Serializer for playlists."""
    
    episode_count = serializers.IntegerField(read_only=True)
    total_duration_seconds = serializers.IntegerField(read_only=True)
    episodes_list = PlaylistEpisodeSerializer(source='playlistepisode_set', many=True, read_only=True)
    
    class Meta:
        model = Playlist
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'cover_image',
            'created_by',
            'is_public',
            'is_featured',
            'is_system',
            'episode_count',
            'total_duration_seconds',
            'episodes_list',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_by', 'is_system']
