from django.db import models

# Create your models here.
from django.db import models
from django.utils import timezone
import uuid
from users.models import User
from tickets.models import Ticket


class Payment(models.Model):
    """A payment taken through the payment gateway (Squad)"""
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Successful'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'
        REFUNDED = 'refunded', 'Refunded'
    
    class PaymentMethod(models.TextChoices):
        CARD = 'card', 'Card'
        BANK_TRANSFER = 'bank_transfer', 'Bank Transfer'
        USSD = 'ussd', 'USSD'
        BANK = 'bank', 'Bank'
        MOBILE_MONEY = 'mobile_money', 'Mobile Money'
    
    # Payment identification
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=100, unique=True, db_index=True)
    # The gateway's own reference for the charge. Squad asks for it on a refund.
    gateway_reference = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
    # Payment details
    amount = models.DecimalField(max_digits=10, decimal_places=2)  # Amount in Naira
    currency = models.CharField(max_length=3, default='NGN')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, null=True, blank=True)
    
    # What is being paid for
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments'
    )
    # An event registration, when that is what is being paid for. One
    # registration can have several attempts; the one that paid it is
    # `EventRegistration.payment`.
    registration = models.ForeignKey(
        'events.EventRegistration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_attempts'
    )
    # A coordinator's group registration, when the payment is for all its
    # seats at once (`events/batches.py`).
    batch = models.ForeignKey(
        'events.RegistrationBatch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments'
    )
    description = models.TextField()
    
    # Payer information
    payer_email = models.EmailField()
    payer_name = models.CharField(max_length=255, blank=True)
    payer_phone = models.CharField(max_length=20, blank=True)
    
    # What the gateway said about the charge
    gateway_response = models.JSONField(null=True, blank=True)
    authorization_code = models.CharField(max_length=100, blank=True)
    channel = models.CharField(max_length=50, blank=True)
    # The gateway's checkout page for this payment. Kept so that a second tap
    # on Pay reopens the same page instead of starting a second charge. The
    # name is the one the phone app reads.
    authorization_url = models.URLField(max_length=500, blank=True)
    
    # Timestamps
    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Metadata
    metadata = models.JSONField(null=True, blank=True)  # Custom metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-initiated_at']
        indexes = [
            models.Index(fields=['reference']),
            models.Index(fields=['status']),
            models.Index(fields=['payer_email']),
            models.Index(fields=['initiated_at']),
        ]
    
    def __str__(self):
        return f"{self.reference} - {self.amount} NGN - {self.get_status_display()}"
    
    @property
    def is_successful(self):
        return self.status == self.Status.SUCCESS
    
    @property
    def is_pending(self):
        return self.status == self.Status.PENDING
    
    @property
    def formatted_amount(self):
        return f"₦{self.amount:,.2f}"
    
    # Squad's `transaction_type`, lower-cased, as one of our payment methods.
    _METHODS = {
        'card': PaymentMethod.CARD,
        'transfer': PaymentMethod.BANK_TRANSFER,
        'virtualaccount': PaymentMethod.BANK_TRANSFER,
        'bank': PaymentMethod.BANK,
        'ussd': PaymentMethod.USSD,
        'merchantussd': PaymentMethod.USSD,
    }

    def mark_as_successful(self, charge):
        """Mark payment as successful. `charge` is what `services._charge` returns."""
        self.status = self.Status.SUCCESS
        self.completed_at = timezone.now()
        self.gateway_response = charge.get('raw')
        self.gateway_reference = charge.get('gateway_reference')
        self.channel = charge.get('channel') or ''
        self.payment_method = self._METHODS.get(self.channel)
        self.save()
    
    def mark_as_failed(self, gateway_data=None):
        """Mark payment as failed"""
        self.status = self.Status.FAILED
        self.completed_at = timezone.now()
        if gateway_data:
            self.gateway_response = gateway_data
        self.save()


def _receipt_path(instance, filename):
    import os
    ext = os.path.splitext(filename)[1].lower()
    return f'receipts/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}'


def _private_storage():
    from common.storage import private_storage
    return private_storage()


class PaymentReceipt(models.Model):
    """
    Proof of a bank transfer to an event's account, for a manual-payment
    event. Someone holding `payments.reconcile` checks it against the bank
    statement; verifying it records the money as a `Payment`, so the ledger
    has online and manual money in one place. The rules are in `receipts.py`.
    """

    class Status(models.TextChoices):
        SUBMITTED = 'submitted', 'Waiting to be checked'
        VERIFIED = 'verified', 'Verified'
        REJECTED = 'rejected', 'Rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # What it pays for: a coordinator's batch, or one registration.
    batch = models.ForeignKey(
        'events.RegistrationBatch', on_delete=models.CASCADE,
        null=True, blank=True, related_name='receipts')
    registration = models.ForeignKey(
        'events.EventRegistration', on_delete=models.CASCADE,
        null=True, blank=True, related_name='receipts')

    submitted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='payment_receipts')
    amount_claimed = models.DecimalField(max_digits=12, decimal_places=2)
    paid_on = models.DateField()
    payer_name = models.CharField(max_length=255, blank=True)
    # The transfer's reference or narration, as the bank shows it.
    bank_reference = models.CharField(max_length=100, blank=True)
    file = models.FileField(upload_to=_receipt_path, storage=_private_storage)
    file_name = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=100, blank=True)
    # So the same receipt sent twice, for two batches, is noticed.
    file_sha256 = models.CharField(max_length=64, db_index=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED)
    amount_verified = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payment_receipts_reviewed')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    # The money this receipt was verified as.
    payment = models.OneToOneField(
        Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='receipt')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(batch__isnull=False, registration__isnull=True)
                    | models.Q(batch__isnull=True, registration__isnull=False)
                ),
                name='receipt_for_batch_or_registration',
            ),
        ]
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['bank_reference']),
        ]

    def __str__(self):
        return f'Receipt {self.amount_claimed} ({self.get_status_display()})'

    @property
    def target(self):
        return self.batch or self.registration

    @property
    def event(self):
        return self.batch.event if self.batch_id else self.registration.event

    @property
    def node(self):
        return self.batch.node if self.batch_id else self.registration.node


class PaymentPlan(models.Model):
    """Payment plans for different ticket types"""
    
    class PlanType(models.TextChoices):
        REGULAR = 'regular', 'Regular'
        EARLY_BIRD = 'early_bird', 'Early Bird'
        GROUP = 'group', 'Group Discount'
        VIP = 'vip', 'VIP'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    plan_type = models.CharField(max_length=20, choices=PlanType.choices, default=PlanType.REGULAR)
    description = models.TextField(blank=True)
    
    # Pricing
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='NGN')
    
    # Validity
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    
    # Ticket association
    ticket_category = models.CharField(
        max_length=20,
        choices=Ticket.Category.choices,
        blank=True,
        help_text="Leave blank for all categories"
    )
    
    # Limits
    max_usage = models.IntegerField(default=0, help_text="0 = unlimited")
    usage_count = models.IntegerField(default=0, editable=False)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['amount']
    
    def __str__(self):
        return f"{self.name} - {self.formatted_amount}"
    
    @property
    def formatted_amount(self):
        return f"₦{self.amount:,.2f}"
    
    @property
    def is_valid(self):
        """Check if plan is currently valid"""
        now = timezone.now()
        return self.is_active and self.valid_from <= now <= self.valid_to
    
    def increment_usage(self):
        """Increment usage count"""
        if self.max_usage == 0 or self.usage_count < self.max_usage:
            self.usage_count += 1
            self.save()
            return True
        return False


class TransactionLog(models.Model):
    """Log all payment transactions for audit"""
    
    class TransactionType(models.TextChoices):
        INITIATE = 'initiate', 'Initiate Payment'
        VERIFY = 'verify', 'Verify Payment'
        REFUND = 'refund', 'Refund'
        WEBHOOK = 'webhook', 'Webhook'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='transaction_logs',
        null=True,
        blank=True
    )
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    
    # Request/Response data
    request_data = models.JSONField(null=True, blank=True)
    response_data = models.JSONField(null=True, blank=True)
    
    # Status
    is_successful = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    
    # Metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.timestamp}"