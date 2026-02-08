from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from .models import TeenProfile, ContentProgress, SavedContent
from content.models import Devotional, Manual, Podcast, Article


class TeenProfileSerializer(serializers.ModelSerializer):
    """Serializer for TeenProfile model"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    interests_list = serializers.ListField(read_only=True)
    favorite_topics_list = serializers.ListField(read_only=True)
    
    class Meta:
        model = TeenProfile
        fields = [
            'id', 'username', 'email', 'full_name',
            'date_of_birth', 'school', 'grade_level',
            'interests', 'interests_list', 'favorite_topics', 'favorite_topics_list',
            'devotional_reminder', 'new_content_notification', 'event_notification',
            'total_devotionals_read', 'total_manuals_completed', 'total_podcasts_played',
            'current_streak', 'longest_streak', 'last_activity_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'username', 'email', 'full_name',
            'total_devotionals_read', 'total_manuals_completed', 'total_podcasts_played',
            'current_streak', 'longest_streak', 'last_activity_at',
            'created_at', 'updated_at'
        ]


class ContentProgressSerializer(serializers.ModelSerializer):
    """Serializer for ContentProgress model"""
    content_type_name = serializers.SerializerMethodField()
    content_title = serializers.SerializerMethodField()
    
    class Meta:
        model = ContentProgress
        fields = [
            'id', 'user', 'content_type', 'content_type_name', 'object_id',
            'content_title', 'status', 'progress_percentage', 'last_position',
            'notes', 'started_at', 'completed_at', 'last_accessed_at'
        ]
        read_only_fields = ['id', 'user', 'content_title', 'content_type_name']
    
    def get_content_type_name(self, obj):
        return obj.content_type.model
    
    def get_content_title(self, obj):
        if obj.content_object:
            return getattr(obj.content_object, 'title', str(obj.content_object))
        return None


class ContentProgressCreateSerializer(serializers.Serializer):
    """Serializer for creating/updating content progress"""
    content_type = serializers.ChoiceField(
        choices=['devotional', 'manual', 'podcast', 'article']
    )
    object_id = serializers.UUIDField()
    status = serializers.ChoiceField(
        choices=['not_started', 'in_progress', 'completed'],
        required=False
    )
    progress_percentage = serializers.IntegerField(min_value=0, max_value=100, required=False)
    last_position = serializers.DurationField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_content_type(self, value):
        """Convert string to ContentType"""
        content_type_map = {
            'devotional': Devotional,
            'manual': Manual,
            'podcast': Podcast,
            'article': Article
        }
        model_class = content_type_map.get(value)
        if not model_class:
            raise serializers.ValidationError(f"Invalid content type: {value}")
        return ContentType.objects.get_for_model(model_class)
    
    def validate(self, data):
        """Validate that the content exists"""
        content_type = data['content_type']
        object_id = data['object_id']
        
        try:
            model_class = content_type.model_class()
            model_class.objects.get(pk=object_id)
        except model_class.DoesNotExist:
            raise serializers.ValidationError(f"Content with id {object_id} does not exist")
        
        return data


class SavedContentSerializer(serializers.ModelSerializer):
    """Serializer for SavedContent model"""
    content_type_name = serializers.SerializerMethodField()
    content_title = serializers.SerializerMethodField()
    content_data = serializers.SerializerMethodField()
    
    class Meta:
        model = SavedContent
        fields = [
            'id', 'user', 'content_type', 'content_type_name', 'object_id',
            'content_title', 'content_data', 'note', 'saved_at'
        ]
        read_only_fields = ['id', 'user', 'saved_at', 'content_title', 'content_data', 'content_type_name']
    
    def get_content_type_name(self, obj):
        return obj.content_type.model
    
    def get_content_title(self, obj):
        if obj.content_object:
            return getattr(obj.content_object, 'title', str(obj.content_object))
        return None
    
    def get_content_data(self, obj):
        """Return minimal content data for display"""
        if obj.content_object:
            return {
                'id': str(obj.content_object.id),
                'title': getattr(obj.content_object, 'title', ''),
                'type': obj.content_type.model
            }
        return None


class SavedContentCreateSerializer(serializers.Serializer):
    """Serializer for saving content"""
    content_type = serializers.ChoiceField(
        choices=['devotional', 'manual', 'podcast', 'article']
    )
    object_id = serializers.UUIDField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
    
    def validate_content_type(self, value):
        """Convert string to ContentType"""
        content_type_map = {
            'devotional': Devotional,
            'manual': Manual,
            'podcast': Podcast,
            'article': Article
        }
        model_class = content_type_map.get(value)
        if not model_class:
            raise serializers.ValidationError(f"Invalid content type: {value}")
        return ContentType.objects.get_for_model(model_class)
    
    def validate(self, data):
        """Validate that the content exists"""
        content_type = data['content_type']
        object_id = data['object_id']
        
        try:
            model_class = content_type.model_class()
            model_class.objects.get(pk=object_id)
        except model_class.DoesNotExist:
            raise serializers.ValidationError(f"Content with id {object_id} does not exist")
        
        return data
