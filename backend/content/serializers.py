"""
Serializers for the content app (devotionals, manuals, articles).
"""
from rest_framework import serializers
from .models import Devotional, ManualSeries, Manual, Article


# =====================
# DEVOTIONAL SERIALIZERS
# =====================

class DevotionalListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing devotionals."""
    
    has_audio = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Devotional
        fields = [
            'id',
            'date',
            'title',
            'slug',
            'title',
            'slug',
            'memory_verse_passage',
            'memory_verse_content',
            'cover_image',
            'has_audio',
            'view_count',
            'status',
            'published_at',
        ]


class DevotionalDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing a devotional."""
    
    has_audio = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Devotional
        fields = [
            'id',
            'date',
            'title',
            'slug',
            
            # Scripture
            'memory_verse_passage',
            'memory_verse_content',
            'bible_text_passage',
            'bible_text_content',
            'bible_in_one_year',
            
            # Legacy
            'anchor_scripture',
            'scripture_text',
            
            # Content
            'content',
            'key_point',
            'prayer',
            'confession',
            'action_point',
            'hymn',
            
            # Meta
            'author',
            'cover_image',
            
            # Audio
            'audio_url',
            'audio_file',
            'audio_duration_seconds',
            'has_audio',
            
            # Stats
            'view_count',
            'share_count',
            'read_count',
            'tags',
            
            # Status
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]


class DevotionalCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating devotionals (admin only)."""
    
    class Meta:
        model = Devotional
        fields = [
            'date',
            'slug',
            'memory_verse_passage',
            'memory_verse_content',
            'bible_text_passage',
            'bible_text_content',
            'bible_in_one_year',
            
            # Legacy
            'anchor_scripture',
            'scripture_text',
            'bible_in_one_year',
            'content',
            'key_point',
            'prayer',
            'confession',
            'action_point',
            'hymn',
            'author',
            'cover_image',
            'audio_url',
            'audio_file',
            'audio_duration_seconds',
            'tags',
            'status',
            'published_at',
            'published_at',
            'scheduled_for',
        ]
        extra_kwargs = {
            'slug': {'read_only': True},
            'anchor_scripture': {'required': False, 'allow_blank': True},
        }


# =====================
# MANUAL SERIALIZERS
# =====================

class ManualSeriesListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing manual series."""
    
    manual_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = ManualSeries
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'cover_image',
            'start_date',
            'end_date',
            'target_age_group',
            'manual_count',
            'status',
        ]


class ManualSeriesDetailSerializer(serializers.ModelSerializer):
    """Full serializer for a manual series."""
    
    manual_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = ManualSeries
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'cover_image',
            'start_date',
            'end_date',
            'order',
            'target_age_group',
            'manual_count',
            'status',
            'created_at',
            'updated_at',
        ]


class ManualListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing manuals."""
    
    series_title = serializers.CharField(source='series.title', read_only=True)
    has_pdf = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Manual
        fields = [
            'id',
            'series',
            'series_title',
            'week_number',
            'week_start_date',
            'week_end_date',
            'title',
            'slug',
            'theme',
            'cover_image',
            'target_age_group',
            'has_pdf',
            'view_count',
            'status',
        ]


class ManualDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing a manual."""
    
    series_detail = ManualSeriesListSerializer(source='series', read_only=True)
    has_pdf = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Manual
        fields = [
            'id',
            'series',
            'series_detail',
            
            # Week info
            'week_number',
            'week_start_date',
            'week_end_date',
            
            # Content
            'title',
            'slug',
            'theme',
            'memory_verse',
            'memory_verse_text',
            'lesson_objectives',
            'lesson_content',
            'key_takeaways',
            'discussion_questions',
            'practical_application',
            'activity_suggestions',
            'opening_prayer_points',
            'closing_prayer',
            
            # Resources
            'cover_image',
            'pdf_url',
            'pdf_file',
            'additional_resources',
            'has_pdf',
            
            # Meta
            'target_age_group',
            'view_count',
            'download_count',
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]


class ManualCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating manuals (admin only)."""
    
    class Meta:
        model = Manual
        fields = [
            'series',
            'week_number',
            'week_start_date',
            'week_end_date',
            'title',
            'slug',
            'theme',
            'memory_verse',
            'memory_verse_text',
            'lesson_objectives',
            'lesson_content',
            'key_takeaways',
            'discussion_questions',
            'practical_application',
            'activity_suggestions',
            'opening_prayer_points',
            'closing_prayer',
            'cover_image',
            'pdf_url',
            'pdf_file',
            'additional_resources',
            'target_age_group',
            'status',
            'published_at',
            'published_at',
            'scheduled_for',
        ]
        extra_kwargs = {
            'slug': {'read_only': True},
        }


# =====================
# ARTICLE SERIALIZERS
# =====================

class ArticleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing articles."""
    
    class Meta:
        model = Article
        fields = [
            'id',
            'title',
            'slug',
            'excerpt',
            'category',
            'author_name',
            'cover_image',
            'read_time_minutes',
            'view_count',
            'is_featured',
            'published_at',
        ]


class ArticleDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing an article."""
    
    class Meta:
        model = Article
        fields = [
            'id',
            'title',
            'slug',
            'excerpt',
            'content',
            'category',
            'tags',
            'author_name',
            'author_bio',
            'author_image',
            'cover_image',
            'featured_image_caption',
            'read_time_minutes',
            'view_count',
            'share_count',
            'is_featured',
            'is_pinned',
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]
