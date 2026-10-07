"""
Events models for the RCCG R63 Teens platform.
Handles general events (campouts, conferences, hangouts) and registrations.
"""
from django.db import IntegrityError, models, transaction
from django.db.models.functions import Greatest
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify
from common.models import (
    TimestampMixin, UUIDMixin, PublishableMixin, ViewableMixin, Province
)
import uuid


class Event(UUIDMixin, TimestampMixin, PublishableMixin, ViewableMixin):
    """
    General event (campouts, conferences, hangouts, retreats, workshops, etc.)
    """
    
    class EventType(models.TextChoices):
        CAMPOUT = 'campout', 'Camp Out'
        CONFERENCE = 'conference', 'Conference'
        HANGOUT = 'hangout', 'Hangout'
        RETREAT = 'retreat', 'Retreat'
        WORKSHOP = 'workshop', 'Workshop'
        SERVICE = 'service', 'Service'
        OUTREACH = 'outreach', 'Outreach'
        CONCERT = 'concert', 'Concert'
        WEBINAR = 'webinar', 'Webinar'
        OTHER = 'other', 'Other'
    
    class RegistrationStatus(models.TextChoices):
        NOT_OPEN = 'not_open', 'Not Yet Open'
        OPEN = 'open', 'Open'
        CLOSED = 'closed', 'Closed'
        FULL = 'full', 'Full'
    
    class TargetAgeGroup(models.TextChoices):
        ALL       = 'all',       'All Ages'
        CHILDREN  = 'children',  'Children (6-8)'
        PRE_TEEN  = 'pre_teen',  'Pre-Teens (9-12)'
        TEEN      = 'teen',      'Teens (13-19)'
        SUPERTEEN = 'superteen', 'Superteens (19+)'
    
    # Event Details
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, unique=True, db_index=True)
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    description = models.TextField()
    short_description = models.CharField(max_length=500, blank=True)
    
    # Dates & Times
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    timezone_name = models.CharField(max_length=50, default='Africa/Lagos')
    
    # Location
    venue = models.CharField(max_length=500)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    # Virtual event settings
    is_virtual = models.BooleanField(default=False)
    is_hybrid = models.BooleanField(default=False)
    virtual_link = models.URLField(blank=True)
    virtual_platform = models.CharField(max_length=100, blank=True)  # Zoom, Google Meet, etc.
    
    # Visuals
    #
    # Optional. This was a plain ImageField with neither blank nor null, which
    # made it *required* — so creating an event without a photo failed with
    # DRF's "No file was submitted." and the Console, whose editor offers no
    # upload field, could not create an event at all. An event is a real thing
    # whether or not someone has a banner for it yet; the image is decoration.
    # (Devotional.cover_image already gets this right.)
    cover_image = models.ImageField(upload_to='events/', blank=True, null=True)
    gallery_images = models.JSONField(default=list, blank=True)  # List of image URLs
    promotional_video_url = models.URLField(blank=True)
    
    # Registration Settings
    registration_status = models.CharField(
        max_length=20,
        choices=RegistrationStatus.choices,
        default=RegistrationStatus.NOT_OPEN
    )
    registration_opens = models.DateTimeField(null=True, blank=True)
    registration_closes = models.DateTimeField(null=True, blank=True)
    max_attendees = models.PositiveIntegerField(null=True, blank=True)
    waitlist_enabled = models.BooleanField(default=True)
    max_waitlist = models.PositiveIntegerField(null=True, blank=True)
    
    # Pricing
    is_free = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    early_bird_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    early_bird_deadline = models.DateTimeField(null=True, blank=True)
    group_discount_threshold = models.PositiveIntegerField(null=True, blank=True)
    group_discount_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Eligibility
    #
    # `scope_node` is the event's place in the church tree: the node that owns it,
    # and whose subtree can see it — "every content item, event, and announcement
    # declares a visibility scope; users see items scoped at or above their
    # position" (docs/07-feature-specifications.md §3).
    #
    # It replaces `target_provinces`, a JSON array of hard-coded Lagos province
    # strings. That array made onboarding a second region a code change, which
    # docs/15-technical-architecture.md forbids outright ("no code path may
    # reference any node by ID or name"), and it is why event querysets could never
    # be scoped to a manager's subtree (backend audit, C2).
    #
    # NULL means unscoped — visible to everyone. That is the faithful reading of
    # the old empty-list default, and it fails *open* on the visibility of an
    # already-published event rather than silently hiding it. Writes remain gated
    # on capability regardless.
    scope_node = models.ForeignKey(
        'hierarchy.HierarchyNode',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='events',
        help_text="The node that owns this event; its subtree can see it. "
                  "Blank means visible everywhere.",
    )

    target_age_groups = models.JSONField(default=list, blank=True)
    min_age = models.PositiveIntegerField(null=True, blank=True)
    max_age = models.PositiveIntegerField(null=True, blank=True)
    requires_guardian_consent = models.BooleanField(default=True)
    
    # Organizer
    organizer_name = models.CharField(max_length=255, blank=True)
    organizer_email = models.EmailField(blank=True)
    organizer_phone = models.CharField(max_length=20, blank=True)
    organizer_website = models.URLField(blank=True)
    
    # Additional Info
    what_to_bring = models.JSONField(default=list, blank=True)  # List of items
    schedule = models.JSONField(default=list, blank=True)  # Event schedule/itinerary
    faqs = models.JSONField(default=list, blank=True)  # FAQ list
    
    # Stats
    registration_count = models.PositiveIntegerField(default=0)
    waitlist_count = models.PositiveIntegerField(default=0)
    checked_in_count = models.PositiveIntegerField(default=0)
    
    # Featured
    is_featured = models.BooleanField(default=False, db_index=True)
    
    class Meta:
        ordering = ['-start_datetime']
        verbose_name = 'Event'
        verbose_name_plural = 'Events'
        indexes = [
            models.Index(fields=['event_type']),
            models.Index(fields=['start_datetime']),
            models.Index(fields=['registration_status']),
            models.Index(fields=['status', 'start_datetime']),
            models.Index(fields=['is_featured', 'status']),
        ]
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:300]
        super().save(*args, **kwargs)
    
    @property
    def is_upcoming(self):
        return self.start_datetime > timezone.now()
    
    @property
    def is_ongoing(self):
        now = timezone.now()
        return self.start_datetime <= now <= self.end_datetime
    
    @property
    def is_past(self):
        return self.end_datetime < timezone.now()
    
    @property
    def places_taken(self):
        """
        How many registrations hold a place: pending, confirmed and arrived.

        Counted, not read from `registration_count`: that counter only rises
        when a registration is confirmed, so it let any number of pending
        registrations in past the limit. A queryset may annotate
        `live_places_taken` to save the query.
        """
        annotated = getattr(self, 'live_places_taken', None)
        if annotated is not None:
            return annotated
        return self.registrations.filter(
            status__in=EventRegistration.HOLDS_A_PLACE).count()

    @property
    def spots_remaining(self):
        if self.max_attendees:
            return max(0, self.max_attendees - self.places_taken)
        return None

    @property
    def is_full(self):
        if self.max_attendees:
            return self.places_taken >= self.max_attendees
        return False

    @property
    def current_price(self):
        """Get current applicable price (handles early bird)."""
        if self.is_free:
            return 0
        if self.early_bird_price and self.early_bird_deadline:
            if timezone.now() < self.early_bird_deadline:
                return self.early_bird_price
        return self.price
    
    def update_registration_status(self):
        """Auto-update registration status based on capacity and dates."""
        now = timezone.now()
        
        if self.is_full:
            self.registration_status = self.RegistrationStatus.FULL
        elif self.registration_closes and now > self.registration_closes:
            self.registration_status = self.RegistrationStatus.CLOSED
        elif self.registration_opens and now >= self.registration_opens:
            self.registration_status = self.RegistrationStatus.OPEN
        
        self.save()


class EventRegistration(UUIDMixin, TimestampMixin):
    """
    Registration for an event.
    Replaces the old Ticket concept with a more general approach.
    """
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'
        WAITLISTED = 'waitlisted', 'Waitlisted'
        CHECKED_IN = 'checked_in', 'Checked In'
        ATTENDED = 'attended', 'Attended'
        NO_SHOW = 'no_show', 'No Show'
    
    class PaymentStatus(models.TextChoices):
        NOT_REQUIRED = 'not_required', 'Not Required'
        PENDING = 'pending', 'Pending'
        PAID = 'paid', 'Paid'
        REFUNDED = 'refunded', 'Refunded'
        FAILED = 'failed', 'Failed'
    
    class RegistrationType(models.TextChoices):
        SELF = 'self', 'Self Registration'
        COORDINATOR = 'coordinator', 'Coordinator Registration'
        ADMIN = 'admin', 'Admin Registration'
        BULK = 'bulk', 'Bulk Upload'

    # A place that counts towards the event's capacity.
    HOLDS_A_PLACE = (Status.PENDING, Status.CONFIRMED, Status.CHECKED_IN, Status.ATTENDED)
    # What `Event.registration_count` counts.
    COUNTED = (Status.CONFIRMED, Status.CHECKED_IN, Status.ATTENDED)
    # What `Event.checked_in_count` counts.
    ARRIVED = (Status.CHECKED_IN, Status.ATTENDED)

    # Two registrations saved at once read the same last number. The unique
    # constraint refuses the second; this is how many times it tries again.
    ID_ATTEMPTS = 5

    # Unique registration identifier
    registration_id = models.CharField(max_length=30, unique=True, editable=False, db_index=True)
    
    # Relationships
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='registrations'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='event_registrations'
    )
    profile = models.ForeignKey(
        'profiles.TeenProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='profile_registrations'
    )
    
    # =====================
    # Attendee Snapshot (preserved even if profile changes)
    # =====================
    attendee_name = models.CharField(max_length=255)
    attendee_email = models.EmailField()
    attendee_phone = models.CharField(max_length=20)
    attendee_age = models.PositiveIntegerField()
    attendee_gender = models.CharField(max_length=20, blank=True)
    attendee_date_of_birth = models.DateField(null=True, blank=True)
    attendee_category = models.CharField(max_length=50, blank=True)  # Age group category
    
    # Church hierarchy
    attendee_province = models.CharField(max_length=100, choices=Province.choices)
    attendee_zone = models.CharField(max_length=100, blank=True)
    attendee_area = models.CharField(max_length=100, blank=True)
    attendee_parish = models.CharField(max_length=255)
    attendee_department = models.CharField(max_length=255, blank=True)
    
    # =====================
    # Guardian Information
    # =====================
    guardian_name = models.CharField(max_length=255)
    guardian_phone = models.CharField(max_length=20)
    guardian_email = models.EmailField()
    guardian_relationship = models.CharField(max_length=100)
    guardian_consent = models.BooleanField(default=False)
    consent_timestamp = models.DateTimeField(null=True, blank=True)
    
    # =====================
    # Emergency Contact
    # =====================
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_relationship = models.CharField(max_length=100, blank=True)
    
    # =====================
    # Medical Information
    # =====================
    medical_conditions = models.TextField(blank=True)
    allergies = models.TextField(blank=True)
    medications = models.TextField(blank=True)
    dietary_restrictions = models.TextField(blank=True)
    special_needs = models.TextField(blank=True)
    
    # =====================
    # Status & Payment
    # =====================
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING
    )
    registration_type = models.CharField(
        max_length=20,
        choices=RegistrationType.choices,
        default=RegistrationType.SELF
    )
    
    # =====================
    # Payment Details
    # =====================
    amount_due = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment = models.ForeignKey(
        'payments.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registrations'
    )
    payment_reference = models.CharField(max_length=100, blank=True)
    
    # Legacy payment proof (for manual verification)
    proof_of_payment = models.FileField(upload_to='payment_proofs/', null=True, blank=True)
    
    # =====================
    # Check-in
    # =====================
    checked_in_at = models.DateTimeField(null=True, blank=True)
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='checkins_performed'
    )
    check_in_method = models.CharField(max_length=20, blank=True)  # qr_scan, manual, etc.
    check_in_notes = models.TextField(blank=True)
    
    # =====================
    # QR Code
    # =====================
    qr_code = models.ImageField(upload_to='registration_qr/', null=True, blank=True)
    
    # =====================
    # Registration metadata
    # =====================
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='registrations_created'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registrations_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registrations_cancelled'
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    
    # Notes
    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)  # For coordinators/admins only
    
    # IP/Device tracking
    registration_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Event Registration'
        verbose_name_plural = 'Event Registrations'
        unique_together = [['event', 'attendee_email']]  # One registration per email per event
        indexes = [
            # registration_id is already unique=True + db_index=True on the field,
            # so the entry that stood here was a third index on one column.
            models.Index(fields=['event', 'status']),
            models.Index(fields=['attendee_province']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['attendee_email']),
            # Matches the default ordering above; this is the widest table in the
            # project, so an unindexed sort over it is the most expensive one.
            models.Index(fields=['-created_at'], name='evreg_created_desc_idx'),
        ]
    
    def __str__(self):
        return f"{self.registration_id} - {self.attendee_name}"
    
    def _id_prefix(self):
        """`CAMP-20261006-`: the event's first word (e.g. CAMP, CONF, RCCG) and the day."""
        event_prefix = 'EVT'
        if self.event_id:
            try:
                import re
                title = self.event.title or 'EVT'
                event_prefix = re.sub(r'[^A-Z0-9]', '', title.split()[0].upper()[:6]) or 'EVT'
            except Exception:
                event_prefix = 'EVT'
        return f"{event_prefix}-{timezone.now().strftime('%Y%m%d')}-"

    def _next_registration_id(self, prefix):
        last_reg = EventRegistration.objects.filter(
            registration_id__startswith=prefix
        ).order_by('registration_id').last()

        next_num = 1
        if last_reg:
            try:
                next_num = int(last_reg.registration_id.split('-')[-1]) + 1
            except (ValueError, IndexError):
                next_num = 1
        return f'{prefix}{next_num:05d}'

    def save(self, *args, **kwargs):
        if self.registration_id:
            return super().save(*args, **kwargs)

        prefix = self._id_prefix()
        for attempt in range(1, self.ID_ATTEMPTS + 1):
            self.registration_id = self._next_registration_id(prefix)
            try:
                # A savepoint, so a refused insert does not poison the caller's
                # transaction and the next attempt can run inside it.
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError:
                taken = EventRegistration.objects.filter(
                    registration_id=self.registration_id).exists()
                self.registration_id = ''
                # Some other constraint (one email per event), or out of tries.
                if not taken or attempt == self.ID_ATTEMPTS:
                    raise

    @property
    def is_confirmed(self):
        return self.status == self.Status.CONFIRMED
    
    @property
    def is_paid(self):
        return self.payment_status in [self.PaymentStatus.PAID, self.PaymentStatus.NOT_REQUIRED]
    
    @property
    def is_checked_in(self):
        return self.status == self.Status.CHECKED_IN
    
    def _move_to(self, new_status, **changes):
        """
        Change status and keep the event's counters true, as one step.

        The row is locked and the stored status re-read, so the counters move by
        the difference between what the status really was and what it becomes.
        Two requests confirming the same registration produce one confirmation;
        cancelling a checked-in ticket gives back both the place and the arrival.

        Returns the previous status, or None when the registration was already
        in `new_status` and nothing was written.
        """
        with transaction.atomic():
            old_status = (
                EventRegistration.objects.select_for_update()
                .values_list('status', flat=True).get(pk=self.pk)
            )
            if old_status == new_status:
                self.status = old_status
                return None

            self.status = new_status
            for field, value in changes.items():
                setattr(self, field, value)
            self.save(update_fields=['status', *changes, 'updated_at'])

            counted = (new_status in self.COUNTED) - (old_status in self.COUNTED)
            arrived = (new_status in self.ARRIVED) - (old_status in self.ARRIVED)
            counters = {}
            # Clamped at zero: counters written before this method existed may
            # be lower than the rows they describe, and the column is unsigned.
            if counted:
                counters['registration_count'] = Greatest(
                    models.F('registration_count') + counted, 0)
            if arrived:
                counters['checked_in_count'] = Greatest(
                    models.F('checked_in_count') + arrived, 0)
            if counters:
                Event.objects.filter(pk=self.event_id).update(**counters)
            return old_status

    def set_status(self, new_status):
        """Move to any status. Returns the previous status, or None if unchanged."""
        return self._move_to(new_status)

    def confirm(self, user=None):
        """Confirm the registration. Returns the previous status, or None if already confirmed."""
        changes = {'approved_at': timezone.now()}
        if user:
            changes['approved_by'] = user
        return self._move_to(self.Status.CONFIRMED, **changes)

    def cancel(self, user=None, reason=''):
        """Cancel the registration. Returns the previous status, or None if already cancelled."""
        changes = {'cancelled_at': timezone.now(), 'cancellation_reason': reason}
        if user:
            changes['cancelled_by'] = user
        return self._move_to(self.Status.CANCELLED, **changes)

    def check_in(self, user=None, method='manual', notes=''):
        """Check in the attendee. Returns the previous status, or None if already checked in."""
        changes = {
            'checked_in_at': timezone.now(),
            'check_in_method': method,
            'check_in_notes': notes,
        }
        if user:
            changes['checked_in_by'] = user
        return self._move_to(self.Status.CHECKED_IN, **changes)


class BulkUpload(UUIDMixin, TimestampMixin):
    """Model for tracking bulk registration uploads."""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        PARTIAL = 'partial', 'Partial Success'
    
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='bulk_uploads'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='event_bulk_uploads'
    )
    
    filename = models.CharField(max_length=255)
    file = models.FileField(upload_to='bulk_uploads/')
    
    total_records = models.IntegerField(default=0)
    successful_records = models.IntegerField(default=0)
    failed_records = models.IntegerField(default=0)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_log = models.TextField(blank=True)
    error_details = models.JSONField(default=list, blank=True)  # Detailed errors per row
    
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Bulk Upload'
        verbose_name_plural = 'Bulk Uploads'
    
    def __str__(self):
        return f"{self.filename} - {self.get_status_display()}"


class RegistrationAuditLog(UUIDMixin):
    """Audit log for registration changes."""
    
    class ActionType(models.TextChoices):
        CREATE = 'create', 'Create'
        UPDATE = 'update', 'Update'
        STATUS_CHANGE = 'status_change', 'Status Change'
        PAYMENT_UPDATE = 'payment_update', 'Payment Update'
        CHECK_IN = 'check_in', 'Check In'
        CANCEL = 'cancel', 'Cancel'
    
    registration = models.ForeignKey(
        EventRegistration,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    action = models.CharField(max_length=50, choices=ActionType.choices)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['registration', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.registration.registration_id} - {self.action}"
