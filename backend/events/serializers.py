"""
Serializers for the events app (events, registrations, bulk uploads).
"""
from rest_framework import serializers
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field

from identity.authorization import has_any_permission
from identity.permissions_registry import Perm
from .models import Event, EventRegistration, BulkUpload, RegistrationAuditLog


# =====================
# EVENT SERIALIZERS
# =====================

class EventListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing events."""
    
    spots_remaining = serializers.IntegerField(read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    current_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    registration_count = serializers.SerializerMethodField()

    def get_registration_count(self, obj):
        """Return live annotation if available, else fall back to stored field."""
        return getattr(obj, 'live_registration_count', obj.registration_count)
    
    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'slug',
            'event_type',
            'short_description',
            'start_datetime',
            'end_datetime',
            'venue',
            'city',
            'cover_image',
            'is_virtual',
            'is_free',
            'price',
            'current_price',
            'registration_status',
            'registration_count',
            'max_attendees',
            'spots_remaining',
            'is_upcoming',
            'is_featured',
            'status',
        ]


class EventDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing an event."""
    
    spots_remaining = serializers.IntegerField(read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    is_ongoing = serializers.BooleanField(read_only=True)
    is_past = serializers.BooleanField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    current_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    registration_count = serializers.SerializerMethodField()

    def get_registration_count(self, obj):
        return getattr(obj, 'live_registration_count', obj.registration_count)
    
    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'slug',
            'event_type',
            'description',
            'short_description',
            
            # Dates
            'start_datetime',
            'end_datetime',
            'timezone_name',
            
            # Location
            'venue',
            'address',
            'city',
            'state',
            'latitude',
            'longitude',
            'is_virtual',
            'is_hybrid',
            'virtual_link',
            'virtual_platform',
            
            # Visuals
            'cover_image',
            'gallery_images',
            'promotional_video_url',
            
            # Registration
            'registration_status',
            'registration_opens',
            'registration_closes',
            'max_attendees',
            'spots_remaining',
            'waitlist_enabled',
            'max_waitlist',
            
            # Pricing
            'is_free',
            'price',
            'early_bird_price',
            'early_bird_deadline',
            'group_discount_threshold',
            'group_discount_price',
            'current_price',
            
            # Eligibility
            'scope_node',
            'target_age_groups',
            'min_age',
            'max_age',
            'requires_guardian_consent',
            
            # Organizer
            'organizer_name',
            'organizer_email',
            'organizer_phone',
            'organizer_website',
            
            # Additional info
            'what_to_bring',
            'schedule',
            'faqs',
            
            # Stats
            'registration_count',
            'waitlist_count',
            'checked_in_count',
            'view_count',
            
            # Flags
            'is_featured',
            'is_upcoming',
            'is_ongoing',
            'is_past',
            'is_full',
            
            # Status
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]


class EventCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating events (admin only)."""
    
    class Meta:
        model = Event
        fields = [
            'title',
            'slug',
            'event_type',
            'description',
            'short_description',
            'start_datetime',
            'end_datetime',
            'timezone_name',
            'venue',
            'address',
            'city',
            'state',
            'latitude',
            'longitude',
            'is_virtual',
            'is_hybrid',
            'virtual_link',
            'virtual_platform',
            'cover_image',
            'gallery_images',
            'promotional_video_url',
            'registration_status',
            'registration_opens',
            'registration_closes',
            'max_attendees',
            'waitlist_enabled',
            'max_waitlist',
            'is_free',
            'price',
            'early_bird_price',
            'early_bird_deadline',
            'group_discount_threshold',
            'group_discount_price',
            'scope_node',
            'target_age_groups',
            'min_age',
            'max_age',
            'requires_guardian_consent',
            'organizer_name',
            'organizer_email',
            'organizer_phone',
            'organizer_website',
            'what_to_bring',
            'schedule',
            'faqs',
            'is_featured',
            'status',
            'published_at',
            'scheduled_for',
        ]
        extra_kwargs = {
            # Auto-generated in model.save() from title — do not require from client
            'slug': {'required': False},
        }


# =====================
# REGISTRATION SERIALIZERS
# =====================

class EventRegistrationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing registrations."""
    
    event_title = serializers.CharField(source='event.title', read_only=True)
    
    class Meta:
        model = EventRegistration
        fields = [
            'id',
            'registration_id',
            'event',
            'event_title',
            'attendee_name',
            'attendee_email',
            'attendee_phone',
            'attendee_province',
            'attendee_parish',
            'status',
            'payment_status',
            'checked_in_at',
            'created_at',
        ]


class EventRegistrationDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing a registration."""
    
    event_detail = EventListSerializer(source='event', read_only=True)
    is_confirmed = serializers.BooleanField(read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    is_checked_in = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = EventRegistration
        fields = [
            'id',
            'registration_id',
            'event',
            'event_detail',
            'user',
            'profile',
            
            # Attendee info
            'attendee_name',
            'attendee_email',
            'attendee_phone',
            'attendee_age',
            'attendee_gender',
            'attendee_date_of_birth',
            'attendee_category',
            
            # Church
            'attendee_province',
            'attendee_zone',
            'attendee_area',
            'attendee_parish',
            'attendee_department',
            
            # Guardian
            'guardian_name',
            'guardian_phone',
            'guardian_email',
            'guardian_relationship',
            'guardian_consent',
            'consent_timestamp',
            
            # Emergency
            'emergency_contact_name',
            'emergency_contact_phone',
            'emergency_contact_relationship',
            
            # Medical
            'medical_conditions',
            'allergies',
            'medications',
            'dietary_restrictions',
            'special_needs',
            
            # Status
            'status',
            'payment_status',
            'registration_type',
            'is_confirmed',
            'is_paid',
            'is_checked_in',
            
            # Payment
            'amount_due',
            'amount_paid',
            'payment_reference',
            
            # Check-in
            'checked_in_at',
            'check_in_method',
            
            # QR
            'qr_code',
            
            # Notes
            'notes',
            
            # Meta
            'registered_by',
            'approved_by',
            'approved_at',
            'created_at',
            'updated_at',
        ]


class EventRegistrationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a registration."""
    
    class Meta:
        model = EventRegistration
        fields = [
            'event',
            
            # Attendee info
            'attendee_name',
            'attendee_email',
            'attendee_phone',
            'attendee_age',
            'attendee_gender',
            'attendee_date_of_birth',
            
            # Church
            'attendee_province',
            'attendee_zone',
            'attendee_area',
            'attendee_parish',
            'attendee_department',
            
            # Guardian
            'guardian_name',
            'guardian_phone',
            'guardian_email',
            'guardian_relationship',
            'guardian_consent',
            
            # Emergency
            'emergency_contact_name',
            'emergency_contact_phone',
            'emergency_contact_relationship',
            
            # Medical
            'medical_conditions',
            'allergies',
            'medications',
            'dietary_restrictions',
            'special_needs',
            
            # Notes
            'notes',
        ]
    
    def validate(self, data):
        event = data.get('event')
        
        # Check if event is open for registration
        if event.registration_status != Event.RegistrationStatus.OPEN:
            raise serializers.ValidationError({
                'event': 'Registration is not currently open for this event.'
            })
        
        # Check if event is full
        if event.is_full and not event.waitlist_enabled:
            raise serializers.ValidationError({
                'event': 'This event is full and waitlist is not enabled.'
            })
        
        # Check age requirements
        age = data.get('attendee_age')
        if event.min_age and age < event.min_age:
            raise serializers.ValidationError({
                'attendee_age': f'Minimum age for this event is {event.min_age}.'
            })
        if event.max_age and age > event.max_age:
            raise serializers.ValidationError({
                'attendee_age': f'Maximum age for this event is {event.max_age}.'
            })
        
        # Check guardian consent for minors
        if event.requires_guardian_consent and not data.get('guardian_consent'):
            raise serializers.ValidationError({
                'guardian_consent': 'Guardian consent is required for this event.'
            })
        
        return data
    
    def create(self, validated_data):
        request = self.context.get('request')
        
        # Set user and profile if authenticated
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
            if hasattr(request.user, 'teen_profile'):
                validated_data['profile'] = request.user.teen_profile
            validated_data['registered_by'] = request.user
        
        # Set registration type — a *provenance label* ("who entered this row"),
        # not an authorization decision. Derived from capabilities rather than the
        # legacy `User.role` string, which Phase 1 replaced with RoleAssignments and
        # which is scheduled for removal (backend audit, C2c).
        if request and request.user.is_authenticated:
            if request.user.is_superuser:
                validated_data['registration_type'] = EventRegistration.RegistrationType.ADMIN
            elif has_any_permission(request.user, Perm.EVENTS_MANAGE):
                validated_data['registration_type'] = EventRegistration.RegistrationType.COORDINATOR
            else:
                validated_data['registration_type'] = EventRegistration.RegistrationType.SELF
        
        # Set amount due based on event pricing
        event = validated_data['event']
        if event.is_free:
            validated_data['payment_status'] = EventRegistration.PaymentStatus.NOT_REQUIRED
        else:
            validated_data['amount_due'] = event.current_price
        
        # Set consent timestamp
        if validated_data.get('guardian_consent'):
            validated_data['consent_timestamp'] = timezone.now()
        
        # Check if should be waitlisted
        if event.is_full and event.waitlist_enabled:
            validated_data['status'] = EventRegistration.Status.WAITLISTED
        
        return super().create(validated_data)


class EventRegistrationStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating registration status."""
    
    status = serializers.ChoiceField(choices=EventRegistration.Status.choices)
    notes = serializers.CharField(required=False, allow_blank=True)


class EventRegistrationCheckInSerializer(serializers.Serializer):
    """Serializer for check-in."""
    
    method = serializers.ChoiceField(
        choices=['qr_scan', 'manual', 'barcode', 'nfc'],
        default='manual'
    )
    notes = serializers.CharField(required=False, allow_blank=True)


# =====================
# BULK UPLOAD SERIALIZERS
# =====================

class EventBulkUploadSerializer(serializers.ModelSerializer):
    """Serializer for event bulk uploads."""
    
    class Meta:
        model = BulkUpload
        fields = [
            'id',
            'event',
            'uploaded_by',
            'filename',
            'file',
            'total_records',
            'successful_records',
            'failed_records',
            'status',
            'error_log',
            'error_details',
            'processed_at',
            'created_at',
        ]
        read_only_fields = [
            'id', 'uploaded_by', 'total_records', 'successful_records',
            'failed_records', 'status', 'error_log', 'error_details',
            'processed_at', 'created_at',
        ]


class EventBulkUploadCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating an event bulk upload."""
    
    class Meta:
        model = BulkUpload
        fields = ['event', 'file']
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['uploaded_by'] = request.user
        validated_data['filename'] = validated_data['file'].name
        return super().create(validated_data)


# =====================
# AUDIT LOG SERIALIZER
# =====================

class RegistrationAuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs."""
    
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = RegistrationAuditLog
        fields = [
            'id',
            'registration',
            'user',
            'user_name',
            'action',
            'old_values',
            'new_values',
            'ip_address',
            'timestamp',
        ]


# =====================
# DASHBOARD SERIALIZERS
# =====================

class EventDashboardStatsSerializer(serializers.Serializer):
    """Serializer for event dashboard statistics."""
    
    total_registrations = serializers.IntegerField()
    confirmed_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    cancelled_count = serializers.IntegerField()
    waitlisted_count = serializers.IntegerField()
    checked_in_count = serializers.IntegerField()
    paid_count = serializers.IntegerField()
    unpaid_count = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
