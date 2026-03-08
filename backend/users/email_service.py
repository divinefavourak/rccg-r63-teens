"""
Email service for user account lifecycle notifications.

Covers:
- Self-registration welcome email
- Admin-created account notification (coordinator/admin accounts)
- Password changed confirmation
- Password reset link
"""
import logging
import threading

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.html import strip_tags
from django.utils.http import urlsafe_base64_encode

from utils.avatars import get_user_avatar
from utils.email_senders import get_sender

logger = logging.getLogger(__name__)

_LOGO_URL = 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/logo.jpg'
_FAITH_LOGO_URL = 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/faith_logo.jpg'


def _get_frontend_url():
    return getattr(settings, 'FRONTEND_URL', None) or 'https://rccg-r63-juniorchurch.vercel.app'


def _send_in_thread(subject, html_content, recipients, sender='default', fail_silently=True):
    """Dispatch an email in a background daemon thread."""

    def _worker():
        try:
            plain = strip_tags(html_content)
            from_email = get_sender(sender)
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain,
                from_email=from_email,
                to=recipients,
            )
            msg.attach_alternative(html_content, 'text/html')
            msg.send(fail_silently=fail_silently)
            try:
                safe_subject = subject.encode('ascii', 'replace').decode('ascii')
                logger.info('Email sent: %s -> %s', safe_subject, recipients)
            except Exception:
                logger.info('Email sent -> %s', recipients)
        except Exception as exc:
            logger.error('Email failed to %s: %s', recipients, exc)
            if not fail_silently:
                raise

    threading.Thread(target=_worker, daemon=True).start()


def _base_context(user=None):
    ctx = {
        'frontend_url': _get_frontend_url(),
        'logo_url': _LOGO_URL,
        'faith_logo_url': _FAITH_LOGO_URL,
    }
    if user is not None:
        ctx['avatar_url'] = get_user_avatar(user, size=100)
    return ctx


class UserEmailService:

    @staticmethod
    def send_welcome_email(user):
        """
        Send a welcome email after a user self-registers.
        Respects the user's email_notifications preference.
        """
        if not user.email_notifications:
            return

        subject = 'Welcome to RCCG Region 63 Junior Church!'
        context = {
            **_base_context(user),
            'user': user,
            'full_name': user.get_display_name(),
            'login_url': f"{_get_frontend_url()}/login",
        }
        html = render_to_string('emails/account_welcome.html', context)
        _send_in_thread(subject, html, [user.email], sender='junior_church')

    @staticmethod
    def send_account_created_email(user, created_by=None):
        """
        Notify a coordinator/admin that an account was created for them.
        Includes a password-reset link so they can set their own password
        without us ever emailing a plaintext credential.
        """
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        set_password_url = (
            f"{_get_frontend_url()}/set-password?uid={uid}&token={token}"
        )

        subject = 'Your RCCG Region 63 Account Has Been Created'
        context = {
            **_base_context(user),
            'user': user,
            'full_name': user.get_display_name(),
            'username': user.username,
            'role': user.get_role_display(),
            'created_by': created_by,
            'set_password_url': set_password_url,
        }
        html = render_to_string('emails/account_created.html', context)
        _send_in_thread(subject, html, [user.email], sender='support')

    @staticmethod
    def send_password_changed_email(user):
        """
        Send a security notice after a successful password change.
        """
        subject = 'Your RCCG R63 Password Has Been Changed'
        context = {
            **_base_context(user),
            'user': user,
            'full_name': user.get_display_name(),
        }
        html = render_to_string('emails/password_changed.html', context)
        _send_in_thread(subject, html, [user.email], sender='support')

    @staticmethod
    def send_password_reset_email(user):
        """
        Send a password reset link.
        Called from the ForgotPasswordView.
        """
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = (
            f"{_get_frontend_url()}/reset-password?uid={uid}&token={token}"
        )

        subject = 'Reset Your RCCG R63 Password'
        context = {
            **_base_context(user),
            'user': user,
            'full_name': user.get_display_name(),
            'reset_url': reset_url,
        }
        html = render_to_string('emails/password_reset.html', context)
        # Always send reset emails even if notifications are off — it's a security action
        _send_in_thread(subject, html, [user.email], sender='support', fail_silently=False)
