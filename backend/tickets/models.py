import uuid
import os
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.dispatch import receiver
from django.db.models.signals import post_save


class Ticket(models.Model):
    """
    Main Ticket model for R63 Teens registrations.
    """
    
    class Category(models.TextChoices):
        PRE_TEENS = 'pre_teens', _('Pre-Teens (8-12)')
        TEENS = 'teens', _('Teens (13-19)')
    
    class Gender(models.TextChoices):
        MALE = 'male', _('Male')
        FEMALE = 'female', _('Female')
    
    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
    
    # Ticket Identification
    ticket_id = models.CharField(
        _('ticket ID'),
        max_length=20,
        unique=True,
        editable=False,
        help_text=_('Auto-generated unique ticket identifier')
    )
    
    # Basic Information
    full_name = models.CharField(
        _('full name'),
        max_length=255,
        help_text=_('Full name of the teen')
    )
    age = models.IntegerField(
        _('age'),
        validators=[MinValueValidator(8), MaxValueValidator(19)],
        help_text=_('Age must be between 8 and 19 years')
    )
    category = models.CharField(
        _('category'),
        max_length=20,
        choices=Category.choices,
        help_text=_('Age category of the teen')
    )
    gender = models.CharField(
        _('gender'),
        max_length=20,
        choices=Gender.choices,
        help_text=_('Gender of the teen')
    )
    
    # Contact Information
    phone = models.CharField(
        _('phone number'),
        max_length=20,
        help_text=_('Phone number of the teen')
    )
    email = models.EmailField(
        _('email address'),
        max_length=255,
        help_text=_('Email address of the teen')
    )
    
    # Church Hierarchy
    province = models.CharField(
        _('province'),
        max_length=255,
        help_text=_('Church province')
    )
    zone = models.CharField(
        _('zone'),
        max_length=255,
        help_text=_('Church zone within the province')
    )
    area = models.CharField(
        _('area'),
        max_length=255,
        help_text=_('Church area within the zone')
    )
    parish = models.CharField(
        _('parish'),
        max_length=255,
        help_text=_('Church parish name')
    )
    department = models.CharField(
        _('department'),
        max_length=255,
        blank=True,
        null=True,
        help_text=_('Department within the church (optional)')
    )
    
    # Medical Information
    medical_conditions = models.TextField(
        _('medical conditions'),
        blank=True,
        null=True,
        help_text=_('Any existing medical conditions (optional)')
    )
    medications = models.TextField(
        _('medications'),
        blank=True,
        null=True,
        help_text=_('Current medications (optional)')
    )
    dietary_restrictions = models.TextField(
        _('dietary restrictions'),
        blank=True,
        null=True,
        help_text=_('Any dietary restrictions or allergies (optional)')
    )
    
    # Emergency Contact
    emergency_contact = models.CharField(
        _('emergency contact name'),
        max_length=255,
        help_text=_('Name of emergency contact person')
    )
    emergency_phone = models.CharField(
        _('emergency contact phone'),
        max_length=20,
        help_text=_('Phone number of emergency contact')
    )
    emergency_relationship = models.CharField(
        _('emergency contact relationship'),
        max_length=100,
        help_text=_('Relationship to the teen (e.g., Parent, Guardian)')
    )
    
    # Parent/Guardian Information
    parent_name = models.CharField(
        _('parent/guardian name'),
        max_length=255,
        help_text=_('Full name of parent or guardian')
    )
    parent_email = models.EmailField(
        _('parent/guardian email'),
        max_length=255,
        help_text=_('Email address of parent or guardian')
    )
    parent_phone = models.CharField(
        _('parent/guardian phone'),
        max_length=20,
        help_text=_('Phone number of parent or guardian')
    )
    parent_relationship = models.CharField(
        _('parent/guardian relationship'),
        max_length=100,
        help_text=_('Relationship to the teen (e.g., Mother, Father, Guardian)')
    )
    
    # System Fields
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        help_text=_('Current status of the ticket')
    )
    registered_at = models.DateTimeField(
        _('registered at'),
        default=timezone.now,
        help_text=_('Date and time when the ticket was registered')
    )
    registered_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='registered_tickets',
        verbose_name=_('registered by'),
        help_text=_('User who registered this ticket')
    )
    approved_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_tickets',
        verbose_name=_('approved by'),
        help_text=_('Admin who approved this ticket')
    )
    approved_at = models.DateTimeField(
        _('approved at'),
        null=True,
        blank=True,
        help_text=_('Date and time when the ticket was approved')
    )
    rejection_reason = models.TextField(
        _('rejection reason'),
        blank=True,
        null=True,
        help_text=_('Reason for ticket rejection (if applicable)')
    )
    
    # Media Files
    qr_code = models.ImageField(
        _('QR code'),
        upload_to='tickets/qr_codes/',
        null=True,
        blank=True,
        help_text=_('QR code image for ticket validation')
    )
    ticket_pdf = models.FileField(
        _('ticket PDF'),
        upload_to='tickets/pdfs/',
        null=True,
        blank=True,
        help_text=_('PDF version of the ticket')
    )
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    
    class Meta:
        verbose_name = _('ticket')
        verbose_name_plural = _('tickets')
        indexes = [
            models.Index(fields=['ticket_id']),
            models.Index(fields=['status']),
            models.Index(fields=['province']),
            models.Index(fields=['category']),
            models.Index(fields=['registered_by']),
            models.Index(fields=['registered_at']),
            models.Index(fields=['approved_at']),
        ]
        ordering = ['-registered_at']
        permissions = [
            ('can_approve_ticket', 'Can approve ticket'),
            ('can_reject_ticket', 'Can reject ticket'),
            ('can_view_all_tickets', 'Can view all tickets'),
        ]
    
    def __str__(self):
        return f"{self.ticket_id} - {self.full_name}"
    
    def save(self, *args, **kwargs):
        """Override save to generate ticket ID and handle status changes."""
        is_new = self._state.adding
        
        if not self.ticket_id:
            self.ticket_id = self.generate_ticket_id()
        
        # Handle status changes
        if not is_new:
            self.handle_status_change()
        
        super().save(*args, **kwargs)
    
    def generate_ticket_id(self):
        """Generate a unique ticket ID."""
        current_year = timezone.now().strftime('%Y')
        current_month = timezone.now().strftime('%m')
        
        # Find the last ticket for this month
        last_ticket = Ticket.objects.filter(
            ticket_id__startswith=f"R63-{current_year}{current_month}"
        ).order_by('-ticket_id').first()
        
        if last_ticket:
            last_number = int(last_ticket.ticket_id.split('-')[-1])
            next_number = last_number + 1
        else:
            next_number = 1
        
        return f"R63-{current_year}{current_month}-{next_number:04d}"
    
    def handle_status_change(self):
        """Handle status changes and update related fields."""
        if self.pk:
            try:
                old_ticket = Ticket.objects.get(pk=self.pk)
                
                if old_ticket.status != self.status:
                    # Log status change
                    print(f"Ticket {self.ticket_id} status changed from {old_ticket.status} to {self.status}")
                    
                    if self.status == self.Status.APPROVED:
                        self.approved_at = timezone.now()
                    elif self.status in [self.Status.PENDING, self.Status.REJECTED]:
                        self.approved_at = None
            except Ticket.DoesNotExist:
                pass
    
    @property
    def is_pending(self):
        return self.status == self.Status.PENDING
    
    @property
    def is_approved(self):
        return self.status == self.Status.APPROVED
    
    @property
    def is_rejected(self):
        return self.status == self.Status.REJECTED
    
    @property
    def get_age_group(self):
        """Get the age group based on age."""
        if 8 <= self.age <= 12:
            return 'pre_teens'
        elif 13 <= self.age <= 19:
            return 'teens'
        return 'unknown'


class BulkUpload(models.Model):
    """
    Model for tracking bulk uploads of tickets.
    """
    
    class StatusChoices(models.TextChoices):
        PENDING = 'pending', _('Pending')
        PROCESSING = 'processing', _('Processing')
        COMPLETED = 'completed', _('Completed')
        FAILED = 'failed', _('Failed')
    
    upload_id = models.UUIDField(
        _('upload ID'),
        default=uuid.uuid4,
        editable=False,
        unique=True
    )
    file = models.FileField(
        _('upload file'),
        upload_to='bulk_uploads/%Y/%m/%d/',
        help_text=_('CSV or Excel file containing ticket data')
    )
    uploaded_by = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='bulk_uploads',
        verbose_name=_('uploaded by'),
        help_text=_('User who uploaded the file')
    )
    
    # Statistics
    total_records = models.IntegerField(
        _('total records'),
        default=0,
        help_text=_('Total number of records in the file')
    )
    successful_records = models.IntegerField(
        _('successful records'),
        default=0,
        help_text=_('Number of records successfully processed')
    )
    failed_records = models.IntegerField(
        _('failed records'),
        default=0,
        help_text=_('Number of records that failed to process')
    )
    
    # Processing information
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING
    )
    errors = models.JSONField(
        _('errors'),
        default=list,
        blank=True,
        help_text=_('List of errors encountered during processing')
    )
    error_file = models.FileField(
        _('error file'),
        upload_to='bulk_uploads/errors/',
        null=True,
        blank=True,
        help_text=_('File containing error details')
    )
    
    # Timestamps
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    started_at = models.DateTimeField(_('started at'), null=True, blank=True)
    completed_at = models.DateTimeField(_('completed at'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('bulk upload')
        verbose_name_plural = _('bulk uploads')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Bulk Upload {self.upload_id} - {self.status}"
    
    def save(self, *args, **kwargs):
        """Update timestamps based on status."""
        if self.status == self.StatusChoices.PROCESSING and not self.started_at:
            self.started_at = timezone.now()
        elif self.status in [self.StatusChoices.COMPLETED, self.StatusChoices.FAILED] and not self.completed_at:
            self.completed_at = timezone.now()
        super().save(*args, **kwargs)
    
    def get_success_rate(self):
        """Calculate the success rate of the upload."""
        if self.total_records == 0:
            return 0
        return (self.successful_records / self.total_records) * 100


class TicketComment(models.Model):
    """
    Model for comments on tickets.
    """
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name=_('ticket')
    )
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='ticket_comments',
        verbose_name=_('user')
    )
    comment = models.TextField(_('comment'))
    is_internal = models.BooleanField(
        _('internal comment'),
        default=False,
        help_text=_('If True, only staff can see this comment')
    )
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    
    class Meta:
        verbose_name = _('ticket comment')
        verbose_name_plural = _('ticket comments')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Comment on {self.ticket.ticket_id} by {self.user.username}"
