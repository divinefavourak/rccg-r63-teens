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
    # Name and phone live on the account, but a profile screen edits them next
    # to the teen data, so they are exposed here rather than making every client
    # talk to two endpoints to render one form.
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)
    age = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = TeenProfile
        fields = [
            'id',
            'user',
            'user_email',
            'user_username',
            'full_name',
            'first_name',
            'last_name',
            'phone',
            
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
    """Serializer for updating a teen profile.

    Name and phone are declared without a model source on purpose: they live on
    `User`, and `update()` writes them there. Date of birth and province are
    self-service too: a teen knows their birthday and which province they are
    in, and both are corrected often at the start of a new session. The profile
    model recalculates `age_group` from the new date on save, so a teen never
    sets the group directly. Gender remains a leader's correction.
    """

    MAX_AVATAR_BYTES = 5 * 1024 * 1024

    first_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    phone = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=20,
        # The same rule the account enforces, so a number that a profile accepts
        # cannot fail when it is written to User.phone.
        validators=list(User._meta.get_field('phone').validators),
    )

    class Meta:
        model = TeenProfile
        fields = [
            'first_name',
            'last_name',
            'phone',
            'date_of_birth',
            'province',
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

    def validate_avatar(self, value):
        if value and value.size > self.MAX_AVATAR_BYTES:
            raise serializers.ValidationError(
                'That photo is larger than 5 MB. Choose a smaller one.'
            )
        return value

    def to_internal_value(self, data):
        # A form that has never had a birthday sends the field as ''. DRF's
        # DateField rejects that before any field validator runs, so turn it
        # into the null the model actually stores.
        if data.get('date_of_birth') == '':
            data = data.copy()
            data['date_of_birth'] = None
        return super().to_internal_value(data)

    def update(self, instance, validated_data):
        user = instance.user
        user_fields = [
            field
            for field in ('first_name', 'last_name', 'phone')
            if field in validated_data
        ]
        for field in user_fields:
            setattr(user, field, validated_data.pop(field))

        # The website's registration form prefills its province from
        # `User.province`, not from the teen profile. Keep the two in step so a
        # province corrected here is the one the next registration starts with.
        if 'province' in validated_data:
            user.province = validated_data['province']
            user_fields.append('province')

        # `avatar` is the field the app writes. The account's `profile_picture`
        # is what older tools and the website read, so keep the two pointing at
        # the same file instead of letting one screen show a stale photo.
        avatar_supplied = 'avatar' in validated_data
        profile = super().update(instance, validated_data)

        if user_fields:
            user.save(update_fields=user_fields)

        if avatar_supplied:
            # The file itself was saved by `super()`. Copy its stored name, not
            # the upload, so there is one file in the bucket rather than two.
            user.profile_picture = profile.avatar.name if profile.avatar else None
            user.save(update_fields=['profile_picture'])

        return profile


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
