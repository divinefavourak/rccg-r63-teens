from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.core.mail import send_mail
from django.conf import settings
from .models import User
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def user_post_save(sender, instance, created, **kwargs):
    """
    Signal handler for User post_save.
    Performs actions after a User is saved.
    """
    if created:
        # Log user creation
        logger.info(f"New user created: {instance.username} ({instance.role})")
        
        # Send welcome email if email is provided
        if instance.email and settings.EMAIL_BACKEND != 'django.core.mail.backends.console.EmailBackend':
            try:
                send_welcome_email(instance)
            except Exception as e:
                logger.error(f"Failed to send welcome email to {instance.email}: {str(e)}")
    
    # Log user updates
    else:
        logger.info(f"User updated: {instance.username}")


@receiver(pre_save, sender=User)
def user_pre_save(sender, instance, **kwargs):
    """
    Signal handler for User pre_save.
    Performs validation and actions before a User is saved.
    """
    # Check if this is an update (not creation)
    if instance.pk:
        try:
            old_user = User.objects.get(pk=instance.pk)
            
            # Log role changes
            if old_user.role != instance.role:
                logger.info(
                    f"User {instance.username} role changed from "
                    f"{old_user.role} to {instance.role}"
                )
            
            # Log province changes for coordinators
            if old_user.role == User.Role.COORDINATOR and old_user.province != instance.province:
                logger.info(
                    f"Coordinator {instance.username} province changed from "
                    f"{old_user.province} to {instance.province}"
                )
            
            # Log activation status changes
            if old_user.is_active != instance.is_active:
                status = "activated" if instance.is_active else "deactivated"
                logger.info(f"User {instance.username} {status}")
        
        except User.DoesNotExist:
            pass
    
    # Clean up province field based on role
    if instance.role == User.Role.ADMIN:
        instance.province = None
    
    # Ensure email is lowercase
    if instance.email:
        instance.email = instance.email.lower()
    
    # Ensure username is lowercase
    instance.username = instance.username.lower()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Create additional user profile if needed.
    Currently a placeholder for future extensions.
    """
    if created:
        # TODO: Create additional profile models if needed
        # For example: UserProfile, CoordinatorProfile, etc.
        pass


def send_welcome_email(user):
    """
    Send welcome email to new user.
    """
    # Skip sending email in test environment or if disabled
    if getattr(settings, 'DISABLE_WELCOME_EMAILS', False):
        logger.info(f"Welcome email disabled for {user.email}")
        return
    
    subject = _('Welcome to RCCG R63 Teens Management System')
    
    # Email content based on user role
    if user.is_admin:
        role_description = _('Administrator')
        permissions_description = _(
            'You have full access to manage the system, including user management, '
            'ticket approvals, and system configurations.'
        )
    else:
        role_description = _('Coordinator')
        permissions_description = _(
            f'You have been assigned to manage registrations for {user.province} province. '
            'You can register new tickets, view and manage tickets from your province.'
        )
    
    message = f"""
    Dear {user.name},
    
    Welcome to the RCCG R63 Teens Management System!
    
    Your account has been created with the following details:
    
    Username: {user.username}
    Role: {role_description}
    {'Province: ' + user.province if user.province else ''}
    
    {permissions_description}
    
    You can access the system at: {settings.FRONTEND_URL or 'http://localhost:3000'}
    
    Please keep your login credentials secure and do not share them with anyone.
    
    If you have any questions or need assistance, please contact the system administrator.
    
    Best regards,
    RCCG R63 Teens Management Team
    """
    
    try:
        send_mail(
            subject=subject,
            message=message.strip(),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Welcome email sent to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send welcome email to {user.email}: {str(e)}")

@receiver(post_save, sender=User)
def log_user_activity(sender, instance, created, **kwargs):
    """
    Log user activity for audit purposes.
    This could be connected to an audit app later.
    """
    # Import here to avoid circular imports
    try:
        from audit.models import AuditLog
        
        if created:
            action = 'USER_CREATED'
            old_values = None
            new_values = {
                'username': instance.username,
                'email': instance.email,
                'role': instance.role,
                'province': instance.province,
                'is_active': instance.is_active
            }
        else:
            action = 'USER_UPDATED'
            # In a real implementation, we would compare old and new values
            old_values = None
            new_values = None
        
        # Create audit log entry if audit app exists
        AuditLog.objects.create(
            user=instance,
            action=action,
            entity_type='user',
            entity_id=str(instance.id),
            old_values=old_values,
            new_values=new_values
        )
    except ImportError:
        # Audit app not installed yet, skip logging
        pass
    except Exception as e:
        logger.error(f"Failed to log user activity: {str(e)}")


@receiver(post_save, sender=User)
def check_user_tickets(sender, instance, **kwargs):
    """
    Check and update user-related data when user is deactivated.
    """
    # If user is being deactivated, handle related tickets
    if not instance.is_active:
        # Find tickets registered by this user
        from tickets.models import Ticket  # Import here to avoid circular imports
        
        tickets_count = Ticket.objects.filter(registered_by=instance).count()
        if tickets_count > 0:
            logger.warning(
                f"User {instance.username} is being deactivated but has "
                f"{tickets_count} tickets registered."
            )
            
            # TODO: You might want to reassign tickets or take other actions
            # For example:
            # 1. Reassign tickets to another coordinator
            # 2. Notify admin about orphaned tickets
            # 3. Prevent deactivation if tickets are pending