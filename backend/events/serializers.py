"""
Serializers for the events app (events, registrations, bulk uploads).
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field

from identity.authorization import has_any_permission
from identity.permissions_registry import Perm
from . import bedspaces
from .models import (
    BedAssignment, BulkUpload, Event, EventRegistration, Hostel, RegistrationAuditLog,
)


# =====================
# EVENT SERIALIZERS
# =====================

class EventListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing events."""

    spots_remaining = serializers.IntegerField(read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    current_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    registration_count = serializers.SerializerMethodField()
    scope_node_detail = serializers.SerializerMethodField()

    def get_registration_count(self, obj):
        """Return live annotation if available, else fall back to stored field."""
        return getattr(obj, 'live_registration_count', obj.registration_count)

    def get_scope_node_detail(self, obj):
        """The node that owns the event, or None for one shown to everyone."""
        node = obj.scope_node
        if node is None:
            return None
        return {'id': str(node.pk), 'name': node.name, 'node_type': node.node_type}

    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'slug',
            'event_type',
            'scope_node_detail',
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
            'bedspaces_enabled',
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
            'bedspaces_enabled',
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
            'bedspaces_enabled',
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


def _bed_payload(registration):
    """`{code, hostel, is_firm}` for a registration's bed, or None."""
    try:
        bed = registration.bed
    except BedAssignment.DoesNotExist:
        return None
    return {
        'code': bed.code,
        'hostel': bed.hostel.name,
        'hostel_id': str(bed.hostel_id),
        'for_leader': bed.for_leader,
        'is_firm': bedspaces.is_firm(registration),
    }


class EventRegistrationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing registrations."""

    event_title = serializers.CharField(source='event.title', read_only=True)
    bed = serializers.SerializerMethodField()

    def get_bed(self, obj):
        return _bed_payload(obj)

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
            'attendee_gender',
            'attending_as_leader',
            'bed',
            'status',
            'payment_status',
            'checked_in_at',
            'created_at',
        ]


class EventRegistrationDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing a registration."""

    event_detail = EventListSerializer(source='event', read_only=True)
    bed = serializers.SerializerMethodField()

    def get_bed(self, obj):
        return _bed_payload(obj)
    is_confirmed = serializers.BooleanField(read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    is_checked_in = serializers.BooleanField(read_only=True)
    # Whether to offer Pay, by when, and what goes in the link for a parent.
    # Decided by `payments/registrations.py`, so the phone never works out for
    # itself what can be paid for.
    can_pay = serializers.SerializerMethodField()
    pay_by = serializers.SerializerMethodField()
    pay_token = serializers.SerializerMethodField()
    pay_link = serializers.SerializerMethodField()

    def get_can_pay(self, obj):
        from payments import registrations as registration_payments
        return registration_payments.refusal(obj) is None

    def get_pay_by(self, obj):
        from payments import registrations as registration_payments
        return registration_payments.pay_by(obj)

    def get_pay_token(self, obj):
        from payments import registrations as registration_payments
        if registration_payments.refusal(obj) is not None:
            return None
        return registration_payments.pay_token(obj)

    def get_pay_link(self, obj):
        from django.conf import settings
        from payments import registrations as registration_payments
        if registration_payments.refusal(obj) is not None:
            return None
        request = self.context.get('request')
        api_base = settings.PUBLIC_API_URL or (
            request.build_absolute_uri('/').rstrip('/') if request else '')
        return registration_payments.pay_link(obj, api_base)

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
            'attending_as_leader',
            'bed',
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
            'can_pay',
            'pay_by',
            'pay_token',
            'pay_link',

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
            # A teenager who holds a leader role ticks this to come as one. The
            # server decides what it means: see `bedspaces.attends_as_leader`.
            'attending_as_leader',

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

    ALREADY_REGISTERED = (
        'This email address is already registered for this event. '
        'If it is yours, your ticket is under My tickets.'
    )

    def get_unique_together_validators(self):
        # DRF's own check for (event, attendee_email) answers a teen with "The
        # fields event, attendee_email must make a unique set". The same rule is
        # enforced in `validate` below with words a teen can act on, and the
        # database constraint still backs both.
        return []

    def validate(self, data):
        event = data.get('event')

        email = data.get('attendee_email')
        if email and EventRegistration.objects.filter(
            event=event, attendee_email__iexact=email,
        ).exists():
            raise serializers.ValidationError({'attendee_email': self.ALREADY_REGISTERED})

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
        # One transaction, holding the event's row: the capacity decision at the
        # end must see every registration that got in before this one.
        with transaction.atomic():
            return self._create(validated_data)

    def _create(self, validated_data):
        request = self.context.get('request')

        # Two teens going for the last place queue here. `validate` has already
        # said "full" to anyone who was plainly too late; this is the answer
        # that counts.
        event = Event.objects.select_for_update().get(pk=validated_data['event'].pk)
        validated_data['event'] = event

        if request and request.user.is_authenticated:
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

        # Whose registration it is. A teen registering is registering themself.
        # A leader registering someone is not registering *themself*: the place
        # belongs to the account that owns the attendee's email, if there is
        # one. Filing it under the leader hid it from the teen's My tickets, and
        # the teen was then offered a Register button the server refused.
        if request and request.user.is_authenticated:
            if validated_data.get('registration_type') == EventRegistration.RegistrationType.SELF:
                owner = request.user
            else:
                owner = get_user_model().objects.filter(
                    email__iexact=validated_data['attendee_email'],
                ).first()
            validated_data['user'] = owner
            if owner is not None and hasattr(owner, 'teen_profile'):
                validated_data['profile'] = owner.teen_profile

        # Never taken on the client's word alone: only someone who holds a
        # leader role can come as a leader, whatever the form sent.
        validated_data['attending_as_leader'] = bedspaces.attends_as_leader(
            validated_data.get('user'),
            validated_data.get('attendee_age'),
            validated_data.get('attending_as_leader', False),
        )

        # Set amount due based on event pricing
        if event.is_free:
            validated_data['payment_status'] = EventRegistration.PaymentStatus.NOT_REQUIRED
        else:
            validated_data['amount_due'] = event.current_price

        # Set consent timestamp
        if validated_data.get('guardian_consent'):
            validated_data['consent_timestamp'] = timezone.now()

        # Check if should be waitlisted
        if event.is_full:
            if not event.waitlist_enabled:
                raise serializers.ValidationError({
                    'event': 'This event is full and waitlist is not enabled.'
                })
            validated_data['status'] = EventRegistration.Status.WAITLISTED

        try:
            with transaction.atomic():
                registration = super().create(validated_data)
                # The bed, if the event has them and one is free. Having none
                # does not refuse the registration.
                bedspaces.sync(registration)
                return registration
        except IntegrityError:
            # The same email registering twice at once: both passed `validate`,
            # and the database constraint refused the second.
            if not EventRegistration.objects.filter(
                event=event, attendee_email__iexact=validated_data['attendee_email'],
            ).exists():
                raise
            raise serializers.ValidationError({'attendee_email': self.ALREADY_REGISTERED})


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
    # The ticket number and the attendee, so a reader of the log is not handed
    # a bare row id.
    registration_code = serializers.CharField(
        source='registration.registration_id', read_only=True)
    attendee_name = serializers.CharField(
        source='registration.attendee_name', read_only=True)

    class Meta:
        model = RegistrationAuditLog
        fields = [
            'id',
            'registration',
            'registration_code',
            'attendee_name',
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


# =====================
# BEDSPACES
# =====================

class HostelSerializer(serializers.ModelSerializer):
    """A hostel, and how full each of its two sets of beds is."""

    attendees_placed = serializers.SerializerMethodField()
    leaders_placed = serializers.SerializerMethodField()

    class Meta:
        model = Hostel
        fields = [
            'id', 'event', 'name', 'code', 'gender', 'capacity',
            'reserved_for_leaders', 'attendees_placed', 'leaders_placed',
        ]

    def _counts(self, obj):
        cache = self.context.setdefault('_bed_counts', {})
        if obj.pk not in cache:
            flags = list(obj.beds.values_list('for_leader', flat=True))
            cache[obj.pk] = (len(flags) - sum(flags), sum(flags), )
        return cache[obj.pk]

    def get_attendees_placed(self, obj):
        return self._counts(obj)[0]

    def get_leaders_placed(self, obj):
        return self._counts(obj)[1]

    def validate_code(self, value):
        value = (value or '').strip().upper()
        if not value.isalnum():
            raise serializers.ValidationError('Use letters and numbers only, like HA.')
        return value

    def validate(self, data):
        hostel = self.instance
        capacity = data.get('capacity', getattr(hostel, 'capacity', 0))
        reserved = data.get('reserved_for_leaders', getattr(hostel, 'reserved_for_leaders', 0))
        if capacity < 1:
            raise serializers.ValidationError({'capacity': 'A hostel needs at least one bed.'})
        if reserved > capacity:
            raise serializers.ValidationError({
                'reserved_for_leaders': 'You cannot reserve more beds than the hostel has.'})

        if hostel is None:
            return data

        # Changes that would strand someone who is already placed.
        beds = list(hostel.beds.values_list('serial', 'for_leader'))
        if 'event' in data and data['event'].pk != hostel.event_id:
            raise serializers.ValidationError({'event': 'A hostel cannot move to another event.'})
        if beds and 'gender' in data and data['gender'] != hostel.gender:
            raise serializers.ValidationError({
                'gender': 'People are already placed here. Move them out before changing who it is for.'})
        leaders = sum(1 for _, for_leader in beds if for_leader)
        attendees = len(beds) - leaders
        if beds and capacity < max(serial for serial, _ in beds):
            raise serializers.ValidationError({
                'capacity': f'Bed {max(serial for serial, _ in beds)} is in use, so the hostel cannot be smaller than that.'})
        if reserved < leaders:
            raise serializers.ValidationError({
                'reserved_for_leaders': f'{leaders} leaders are already placed here.'})
        if capacity - reserved < attendees:
            raise serializers.ValidationError({
                'reserved_for_leaders': f'{attendees} attendees are already placed here; that leaves no room to reserve this many.'})
        return data
