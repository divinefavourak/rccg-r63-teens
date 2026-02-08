"""
Serializers for the profiles app.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import TeenProfile, DevotionalProgress, ManualProgress, Favorite

User = get_user_model()


class TeenProfileSerializer(serializers.ModelSerializer):
    """Full serializer for teen profiles."""
    
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    age = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = TeenProfile
        fields = [
            'id',
            'user',
            'user_email',
            'user_username',
            'full_name',
            
            # Personal
            'date_of_birth',
            'age',
            'age_group',
            'gender',
            'bio',
            'avatar',
            
            # Church hierarchy
            'province',
            'zone',
            'area',
            'parish',
            'department',
            
            # Guardian
            'guardian_name',
            'guardian_phone',
            'guardian_email',
            'guardian_relationship',
            
            # Emergency
            'emergency_contact_name',
            'emergency_contact_phone',
            'emergency_contact_relationship',
            
            # Medical
            'medical_conditions',
            'allergies',
            'medications',
            'dietary_restrictions',
            'blood_group',
            
            # Preferences
            'favorite_devotional_topics',
            'notification_preferences',
            
            # Stats
            'devotionals_read_count',
            'events_attended_count',
            'streak_days',
            'longest_streak',
            'last_active_at',
            
            # Timestamps
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'age', 'age_group',
            'devotionals_read_count', 'events_attended_count',
            'streak_days', 'longest_streak', 'last_active_at',
            'created_at', 'updated_at',
        ]


class TeenProfileCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a teen profile."""
    
    class Meta:
        model = TeenProfile
        fields = [
            'date_of_birth',
            'gender',
            'province',
            'zone',
            'area',
            'parish',
            'department',
            'guardian_name',
            'guardian_phone',
            'guardian_email',
            'guardian_relationship',
        ]
    
    def create(self, validated_data):
        user = self.context['request'].user
        return TeenProfile.objects.create(user=user, **validated_data)


class TeenProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a teen profile."""
    
    class Meta:
        model = TeenProfile
        fields = [
            'bio',
            'avatar',
            'zone',
            'area',
            'parish',
            'department',
            'guardian_name',
            'guardian_phone',
            'guardian_email',
            'guardian_relationship',
            'emergency_contact_name',
            'emergency_contact_phone',
            'emergency_contact_relationship',
            'medical_conditions',
            'allergies',
            'medications',
            'dietary_restrictions',
            'blood_group',
            'favorite_devotional_topics',
            'notification_preferences',
        ]


class TeenProfileListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing profiles."""
    
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    age = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = TeenProfile
        fields = [
            'id',
            'full_name',
            'age',
            'age_group',
            'gender',
            'avatar',
            'province',
            'parish',
            'streak_days',
        ]


class DevotionalProgressSerializer(serializers.ModelSerializer):
    """Serializer for devotional progress tracking."""
    
    class Meta:
        model = DevotionalProgress
        fields = [
            'id',
            'profile',
            'devotional_id',
            'read_at',
            'completion_percentage',
            'notes',
        ]
        read_only_fields = ['id', 'profile', 'read_at']
    
    def create(self, validated_data):
        profile = self.context['request'].user.teen_profile
        return DevotionalProgress.objects.create(profile=profile, **validated_data)


class ManualProgressSerializer(serializers.ModelSerializer):
    """Serializer for manual progress tracking."""
    
    class Meta:
        model = ManualProgress
        fields = [
            'id',
            'profile',
            'manual_id',
            'started_at',
            'completed_at',
            'completion_percentage',
            'notes',
        ]
        read_only_fields = ['id', 'profile', 'started_at']


class FavoriteSerializer(serializers.ModelSerializer):
    """Serializer for user favorites."""
    
    class Meta:
        model = Favorite
        fields = [
            'id',
            'profile',
            'content_type',
            'content_id',
            'created_at',
        ]
        read_only_fields = ['id', 'profile', 'created_at']
    
    def create(self, validated_data):
        profile = self.context['request'].user.teen_profile
        return Favorite.objects.create(profile=profile, **validated_data)
