from django.db import models

# Create your models here.
from django.db import models
from django.utils import timezone
import uuid
from users.models import User
from tickets.models import Ticket


class Payment(models.Model):
    """Payment model for Paystack integration"""
    
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
    paystack_reference = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
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
    description = models.TextField()
    
    # Payer information
    payer_email = models.EmailField()
    payer_name = models.CharField(max_length=255, blank=True)
    payer_phone = models.CharField(max_length=20, blank=True)
    
    # Paystack response data
    paystack_response = models.JSONField(null=True, blank=True)
    authorization_code = models.CharField(max_length=100, blank=True)
    channel = models.CharField(max_length=50, blank=True)
    
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
    
    def mark_as_successful(self, paystack_data):
        """Mark payment as successful with Paystack data"""
        self.status = self.Status.SUCCESS
        self.completed_at = timezone.now()
        self.paystack_response = paystack_data
        self.paystack_reference = paystack_data.get('reference')
        self.authorization_code = paystack_data.get('authorization', {}).get('authorization_code', '')
        self.channel = paystack_data.get('channel', '')
        self.payment_method = paystack_data.get('authorization', {}).get('channel', '')
        self.save()
    
    def mark_as_failed(self, paystack_data=None):
        """Mark payment as failed"""
        self.status = self.Status.FAILED
        self.completed_at = timezone.now()
        if paystack_data:
            self.paystack_response = paystack_data
        self.save()


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