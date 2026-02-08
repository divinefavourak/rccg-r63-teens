from rest_framework import serializers
from .models import Devotional, Manual, Podcast, Article


class DevotionalSerializer(serializers.ModelSerializer):
    """Serializer for Devotional model"""
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    
    class Meta:
        model = Devotional
        fields = [
            'id', 'title', 'date', 'scripture', 'scripture_text',
            'content', 'prayer_points', 'memory_verse',
            'author', 'author_name', 'featured_image',
            'is_published', 'published_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'author_name']


class DevotionalListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for devotional lists"""
    
    class Meta:
        model = Devotional
        fields = ['id', 'title', 'date', 'scripture', 'is_published']


class ManualSerializer(serializers.ModelSerializer):
    """Serializer for Manual model"""
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    
    class Meta:
        model = Manual
        fields = [
            'id', 'title', 'year', 'week_number', 'theme',
            'scripture_reference', 'scripture_text', 'lesson_content',
            'discussion_questions', 'practical_application', 'take_home_points',
            'week_start', 'week_end',
            'author', 'author_name', 'pdf_file',
            'is_published', 'published_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'author_name']


class ManualListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for manual lists"""
    
    class Meta:
        model = Manual
        fields = ['id', 'title', 'year', 'week_number', 'theme', 'week_start', 'week_end', 'is_published']


class PodcastSerializer(serializers.ModelSerializer):
    """Serializer for Podcast model"""
    duration_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Podcast
        fields = [
            'id', 'title', 'description', 'category',
            'audio_file', 'duration', 'duration_display', 'thumbnail',
            'host', 'guests', 'episode_number', 'season',
            'play_count',
            'is_published', 'published_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'play_count', 'created_at', 'updated_at', 'duration_display']
    
    def get_duration_display(self, obj):
        """Return human-readable duration"""
        if obj.duration:
            total_seconds = int(obj.duration.total_seconds())
            hours, remainder = divmod(total_seconds, 3600)
            minutes, seconds = divmod(remainder, 60)
            if hours:
                return f"{hours}:{minutes:02d}:{seconds:02d}"
            return f"{minutes}:{seconds:02d}"
        return None


class PodcastListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for podcast lists"""
    duration_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Podcast
        fields = ['id', 'title', 'category', 'thumbnail', 'duration_display', 'episode_number', 'is_published', 'published_at']
    
    def get_duration_display(self, obj):
        if obj.duration:
            total_seconds = int(obj.duration.total_seconds())
            minutes, seconds = divmod(total_seconds, 60)
            return f"{minutes}:{seconds:02d}"
        return None


class ArticleSerializer(serializers.ModelSerializer):
    """Serializer for Article model"""
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    tags_list = serializers.SerializerMethodField()
    
    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'excerpt', 'content', 'category',
            'featured_image',
            'author', 'author_name', 'tags', 'tags_list',
            'view_count', 'is_featured',
            'is_published', 'published_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'view_count', 'created_at', 'updated_at', 'author_name', 'tags_list']
    
    def get_tags_list(self, obj):
        """Return tags as a list"""
        if obj.tags:
            return [tag.strip() for tag in obj.tags.split(',')]
        return []


class ArticleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for article lists"""
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    
    class Meta:
        model = Article
        fields = ['id', 'title', 'slug', 'excerpt', 'category', 'featured_image', 'author_name', 'is_featured', 'is_published', 'published_at']
