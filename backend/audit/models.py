from django.db import models
from django.db.models import JSONField
from django.utils.translation import gettext_lazy as _


class AuditLog(models.Model):
    """Model for tracking all changes in the system."""
    
    user = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        verbose_name=_('user')
    )
    action = models.CharField(
        _('action'),
        max_length=255,
        help_text=_('Action performed (e.g., CREATE, UPDATE, DELETE)')
    )
    entity_type = models.CharField(
        _('entity type'),
        max_length=50,
        help_text=_('Type of entity affected (e.g., user, ticket)')
    )
    entity_id = models.CharField(
        _('entity ID'),
        max_length=255,
        help_text=_('ID of the affected entity')
    )
    old_values = JSONField(
        _('old values'),
        null=True,
        blank=True,
        help_text=_('Values before the change')
    )
    new_values = JSONField(
        _('new values'),
        null=True,
        blank=True,
        help_text=_('Values after the change')
    )
    ip_address = models.GenericIPAddressField(
        _('IP address'),
        null=True,
        blank=True,
        help_text=_('IP address of the user who performed the action')
    )
    user_agent = models.TextField(
        _('user agent'),
        null=True,
        blank=True,
        help_text=_('Browser/device information')
    )
    created_at = models.DateTimeField(
        _('created at'),
        auto_now_add=True,
        help_text=_('Timestamp when the action was performed')
    )
    
    class Meta:
        verbose_name = _('audit log')
        verbose_name_plural = _('audit logs')
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
            models.Index(fields=['action']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.action} on {self.entity_type}:{self.entity_id} by {self.user}"
    
    @classmethod
    def log_action(cls, user, action, entity_type, entity_id, 
                   old_values=None, new_values=None, request=None):
        """Helper method to create an audit log entry."""
        audit_log = cls.objects.create(
            user=user,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=cls._get_client_ip(request) if request else None,
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else None
        )
        return audit_log
    
    @staticmethod
    def _get_client_ip(request):
        """Extract client IP address from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip