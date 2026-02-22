from rest_framework import serializers
from events.models import Event, EventRegistration


class EventSerializer(serializers.ModelSerializer):
    """Serializer for Event model"""
    is_registration_open = serializers.BooleanField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    spots_remaining = serializers.IntegerField(read_only=True)
    current_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = Event
        fields = [
            'id', 'name', 'slug', 'description', 'short_description', 'event_type',
            'start_date', 'end_date',
            'registration_start', 'registration_end',
            'venue', 'address', 'city', 'state',
            'max_capacity', 'current_registrations', 'spots_remaining',
            'is_free', 'price', 'early_bird_price', 'early_bird_deadline', 'current_price',
            'banner_image', 'thumbnail',
            'status', 'is_featured', 'is_registration_open', 'is_full',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'current_registrations', 'spots_remaining', 'is_registration_open', 
            'is_full', 'current_price', 'created_at', 'updated_at', 'created_by_name'
        ]


class EventListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for event lists"""
    is_registration_open = serializers.BooleanField(read_only=True)
    spots_remaining = serializers.IntegerField(read_only=True)
    current_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Event
        fields = [
            'id', 'name', 'slug', 'short_description', 'event_type',
            'start_date', 'end_date', 'venue',
            'is_free', 'current_price', 'thumbnail',
            'status', 'is_featured', 'is_registration_open', 'spots_remaining'
        ]


class EventRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for EventRegistration model"""
    event_name = serializers.CharField(source='event.name', read_only=True)
    registrant_name = serializers.SerializerMethodField()
    
    class Meta:
        model = EventRegistration
        fields = [
            'id', 'event', 'event_name', 'ticket', 'user',
            'registrant_name', 'status', 'registration_number',
            'amount_paid', 'payment_status',
            'special_requests', 'notes',
            'registered_at', 'confirmed_at', 'checked_in_at'
        ]
        read_only_fields = [
            'id', 'registration_number', 'registered_at', 
            'confirmed_at', 'checked_in_at', 'registrant_name'
        ]
    
    def get_registrant_name(self, obj):
        if obj.ticket:
            return obj.ticket.full_name
        if obj.user:
            return obj.user.full_name
        return 'Unknown'


class EventRegistrationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating event registrations"""
    
    class Meta:
        model = EventRegistration
        fields = ['event', 'ticket', 'special_requests']
    
    def validate_event(self, value):
        if not value.is_registration_open:
            raise serializers.ValidationError("Registration is not open for this event.")
        if value.is_full:
            raise serializers.ValidationError("This event is at full capacity.")
        return value
    
    def create(self, validated_data):
        # Set user from request
        user = self.context['request'].user
        validated_data['user'] = user
        
        registration = super().create(validated_data)
        
        # Increment event registration count
        registration.event.increment_registration_count()
        
        return registration
