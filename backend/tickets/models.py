from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.utils import timezone
import uuid
from users.models import User


class Ticket(models.Model):
    """Ticket model for teen registrations"""
    
    class Category(models.TextChoices):
        PRE_TEENS = 'pre_teens', 'Pre-Teens (8-12)'
        TEENS = 'teens', 'Teens (13-19)'
    
    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CANCELLED = 'cancelled', 'Cancelled'
    
    # Ticket identification
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_id = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        verbose_name='Ticket ID'
    )
    
    # Personal information
    full_name = models.CharField(max_length=255)
    age = models.IntegerField(
        validators=[
            MinValueValidator(8, message="Age must be at least 8 years."),
            MaxValueValidator(19, message="Age must not exceed 19 years.")
        ]
    )
    category = models.CharField(max_length=20, choices=Category.choices)
    gender = models.CharField(max_length=20, choices=Gender.choices)
    date_of_birth = models.DateField(null=True, blank=True)
    
    # Contact information
    phone = models.CharField(
        max_length=20,
        validators=[
            RegexValidator(
                regex=r'^\+?1?\d{9,15}$',
                message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
            )
        ]
    )
    email = models.EmailField()
    
    # Church hierarchy (from PRD)
    province = models.CharField(max_length=255, choices=User.Province.choices)
    zone = models.CharField(max_length=255)
    area = models.CharField(max_length=255)
    parish = models.CharField(max_length=255)
    department = models.CharField(max_length=255, blank=True)
    
    # Medical information
    medical_conditions = models.TextField(blank=True, verbose_name='Any medical conditions or allergies?')
    medications = models.TextField(blank=True, verbose_name='Current medications')
    dietary_restrictions = models.TextField(blank=True, verbose_name='Dietary restrictions')
    
    # Emergency contact
    emergency_contact = models.CharField(max_length=255)
    emergency_phone = models.CharField(max_length=20)
    emergency_relationship = models.CharField(max_length=100)
    
    # Parent/Guardian information
    parent_name = models.CharField(max_length=255)
    parent_email = models.EmailField()
    parent_phone = models.CharField(max_length=20)
    parent_relationship = models.CharField(max_length=100)
    
    # Status and tracking
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True, help_text='Any additional notes or comments')
    
    # Registration metadata
    registered_at = models.DateTimeField(default=timezone.now)
    registered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='registered_tickets'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_tickets'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # QR Code (for future implementation)
    qr_code = models.ImageField(upload_to='qr_codes/', null=True, blank=True)
    
    class Meta:
        ordering = ['-registered_at']
        indexes = [
            models.Index(fields=['ticket_id']),
            models.Index(fields=['status']),
            models.Index(fields=['province']),
            models.Index(fields=['category']),
            models.Index(fields=['registered_by']),
            models.Index(fields=['registered_at']),
        ]
        verbose_name = 'Ticket'
        verbose_name_plural = 'Tickets'
    
    def __str__(self):
        return f"{self.ticket_id} - {self.full_name}"
    
    def save(self, *args, **kwargs):
        """Generate ticket ID on first save"""
        if not self.ticket_id:
            # Generate ticket ID format: TKT-YYYY-MM-XXXXX
            date_prefix = timezone.now().strftime('%Y%m')
            last_ticket = Ticket.objects.filter(
                ticket_id__startswith=f'TKT-{date_prefix}-'
            ).order_by('ticket_id').last()
            
            if last_ticket:
                last_num = int(last_ticket.ticket_id.split('-')[-1])
                new_num = last_num + 1
            else:
                new_num = 1
            
            self.ticket_id = f'TKT-{date_prefix}-{new_num:05d}'
        
        super().save(*args, **kwargs)
    
    @property
    def is_approved(self):
        return self.status == self.Status.APPROVED
    
    @property
    def is_pending(self):
        return self.status == self.Status.PENDING
    
    @property
    def is_rejected(self):
        return self.status == self.Status.REJECTED
    
    def approve(self, user):
        """Approve this ticket"""
        self.status = self.Status.APPROVED
        self.approved_at = timezone.now()
        self.approved_by = user
        self.save()
    
    def reject(self, user, notes=''):
        """Reject this ticket"""
        self.status = self.Status.REJECTED
        if notes:
            self.notes = notes
        self.save()
    
    def get_age_group(self):
        """Get age group description"""
        if 8 <= self.age <= 12:
            return 'Pre-Teens'
        elif 13 <= self.age <= 19:
            return 'Teens'
        return 'Unknown'


class BulkUpload(models.Model):
    """Model for tracking bulk uploads"""
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        PARTIAL = 'partial', 'Partial Success'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bulk_uploads')
    filename = models.CharField(max_length=255)
    file = models.FileField(upload_to='bulk_uploads/')
    total_records = models.IntegerField(default=0)
    successful_records = models.IntegerField(default=0)
    failed_records = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_log = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.filename} - {self.get_status_display()}"


class TicketAuditLog(models.Model):
    """Audit log specifically for ticket changes"""
    class ActionType(models.TextChoices):
        CREATE = 'create', 'Create'
        UPDATE = 'update', 'Update'
        STATUS_CHANGE = 'status_change', 'Status Change'
        BULK_UPLOAD = 'bulk_upload', 'Bulk Upload'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_audit_actions'
    )
    action = models.CharField(max_length=50, choices=ActionType.choices)
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        null=True,
        blank=True
    )
    bulk_upload = models.ForeignKey(
        BulkUpload,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['ticket', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
        ]
    
    def __str__(self):
        ticket_ref = self.ticket.ticket_id if self.ticket else 'Bulk Upload'
        return f"{self.user.username if self.user else 'System'} - {self.action} - {ticket_ref}"