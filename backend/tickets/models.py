from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.utils import timezone
import uuid
from users.models import User


class Ticket(models.Model):
    """Ticket model for teen registrations"""
    
    class Category(models.TextChoices):
        TODDLER = 'toddler', 'Toddler (1-5)'          # ✅ Added
        CHILDREN = 'children_6_8', 'Children (6-8)'   # ✅ Added
        PRE_TEENS = 'pre_teens', 'Pre-Teens (8-12)'
        TEENS = 'teens', 'Teens (13-19)'
        SUPER_TEENS = 'super_teens', 'Super Teens'    # ✅ Added
        ALUMNI = 'alumni', 'Alumni'                   # ✅ Added
        TEACHER = 'teacher', 'Teacher/Volunteer'      # ✅ Added
    
    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        CANCELLED = 'cancelled', 'Cancelled'

    class PaymentStatus(models.TextChoices):
        UNPAID = 'unpaid', 'Unpaid'
        VERIFICATION_PENDING = 'verification_pending', 'Verification Pending'
        PAID = 'paid', 'Paid'
    
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
            MinValueValidator(1, message="Age must be at least 1 year."), # ✅ Updated min age
            MaxValueValidator(100, message="Age must not exceed 100 years.") # ✅ Updated max age
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
    # ✅ Made email optional to match Bulk Registration form
    email = models.EmailField(blank=True, null=True) 
    
    # Church hierarchy
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
    
    # QR Code
    qr_code = models.ImageField(upload_to='qr_codes/', null=True, blank=True)

    # Payment Information
    proof_of_payment = models.ImageField(upload_to='payment_proofs/', null=True, blank=True)
    payment_status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID
    )
    
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
        self.status = self.Status.APPROVED
        self.approved_at = timezone.now()
        self.approved_by = user
        self.save()
    
    def reject(self, user, notes=''):
        self.status = self.Status.REJECTED
        if notes:
            self.notes = notes
        self.save()
    
    def get_age_group(self):
        if self.age <= 5: return 'Toddler'
        if 6 <= self.age <= 8: return 'Children'
        if 8 <= self.age <= 12: return 'Pre-Teens'
        elif 13 <= self.age <= 19: return 'Teens'
        return 'Adult/Other'


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
    
class CheckInRecord(models.Model):
    """Record of ticket check-ins at the event"""
    
    class CheckInMethod(models.TextChoices):
        MANUAL = 'manual', 'Manual Entry'
        QR_SCAN = 'qr_scan', 'QR Scan'
        BARCODE = 'barcode', 'Barcode Scan'
        NFC = 'nfc', 'NFC Tap'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='check_in_records'
    )
    checked_in_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='checked_in_tickets'
    )
    checked_in_at = models.DateTimeField(auto_now_add=True)
    check_in_method = models.CharField(max_length=20, choices=CheckInMethod.choices, default=CheckInMethod.MANUAL)
    notes = models.TextField(blank=True)
    
    # Location data (if available)
    location_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_long = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    # Device info
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device_id = models.CharField(max_length=255, blank=True)
    
    class Meta:
        ordering = ['-checked_in_at']
        indexes = [
            models.Index(fields=['ticket', 'checked_in_at']),
            models.Index(fields=['checked_in_at']),
            models.Index(fields=['checked_in_by', 'checked_in_at']),
        ]
        verbose_name = 'Check-in Record'
        verbose_name_plural = 'Check-in Records'
    
    def __str__(self):
        return f"{self.ticket.ticket_id} - {self.checked_in_at.strftime('%Y-%m-%d %H:%M')}"