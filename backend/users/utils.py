from django.utils.crypto import get_random_string
from django.utils.translation import gettext_lazy as _
from django.core.mail import send_mail
from django.db import models
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def generate_temporary_password(length=12):
    """
    Generate a random temporary password.
    """
    # Generate a password with letters, digits, and special characters
    chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'
    return get_random_string(length, chars)


def send_password_reset_email(user, reset_token):
    """
    Send password reset email to user.
    """
    subject = _('Password Reset Request - RCCG R63 Teens')
    
    reset_url = f"{settings.FRONTEND_URL or 'http://localhost:3000'}/reset-password/{reset_token}"
    
    message = f"""
    Dear {user.name},
    
    You have requested to reset your password for the RCCG R63 Teens Management System.
    
    Please click the link below to reset your password:
    {reset_url}
    
    This link will expire in 24 hours. If you did not request a password reset, 
    please ignore this email and contact the system administrator immediately.
    
    For security reasons, please do not share this link with anyone.
    
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
        logger.info(f"Password reset email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email: {str(e)}")
        return False


def send_account_deactivation_email(user):
    """
    Send account deactivation notification email.
    """
    subject = _('Account Deactivated - RCCG R63 Teens')
    
    message = f"""
    Dear {user.name},
    
    Your account for the RCCG R63 Teens Management System has been deactivated.
    
    Username: {user.username}
    Date deactivated: {user.updated_at.strftime('%Y-%m-%d %H:%M:%S')}
    
    You will no longer be able to access the system with this account.
    
    If you believe this is an error or have any questions, please contact 
    the system administrator.
    
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
        logger.info(f"Account deactivation email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send deactivation email: {str(e)}")
        return False


def send_account_activation_email(user):
    """
    Send account activation notification email.
    """
    subject = _('Account Activated - RCCG R63 Teens')
    
    message = f"""
    Dear {user.name},
    
    Your account for the RCCG R63 Teens Management System has been activated.
    
    Username: {user.username}
    Date activated: {user.updated_at.strftime('%Y-%m-%d %H:%M:%S')}
    
    You can now access the system at: {settings.FRONTEND_URL or 'http://localhost:3000'}
    
    If you have any questions or need assistance, please contact 
    the system administrator.
    
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
        logger.info(f"Account activation email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send activation email: {str(e)}")
        return False


def validate_province(province, user_role):
    """
    Validate province based on user role.
    """
    # In a real implementation, you might have a list of valid provinces
    # from a database or configuration
    VALID_PROVINCES = [
        'Province 1', 'Province 2', 'Province 3', 'Province 4', 'Province 5',
        'Province 6', 'Province 7', 'Province 8', 'Province 9', 'Province 10'
    ]
    
    if user_role == 'admin':
        return True, None  # Admin doesn't need province
    
    if not province:
        return False, "Province is required for coordinators"
    
    if province not in VALID_PROVINCES:
        return False, f"Invalid province. Must be one of: {', '.join(VALID_PROVINCES)}"
    
    return True, None


def get_user_statistics():
    """
    Get user statistics for dashboard.
    """
    from .models import User
    
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    admin_users = User.objects.filter(role=User.Role.ADMIN, is_active=True).count()
    coordinator_users = User.objects.filter(role=User.Role.COORDINATOR, is_active=True).count()
    
    # Count users by province
    province_stats = list(
        User.objects.filter(role=User.Role.COORDINATOR, is_active=True)
        .values('province')
        .annotate(count=models.Count('id'))
        .order_by('province')
    )
    
    return {
        'total_users': total_users,
        'active_users': active_users,
        'admin_users': admin_users,
        'coordinator_users': coordinator_users,
        'province_stats': province_stats,
    }