"""
Email service for EventRegistration notifications.

Sends transactional emails triggered by registration lifecycle events:
- Registration created (confirmation / pending)
- Registration confirmed (approval with optional QR code)
- Registration status change
- Bulk registration summary sent to coordinator
"""
import base64
import logging
import threading

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from utils.avatars import get_registration_avatar
from utils.email_senders import get_sender

logger = logging.getLogger(__name__)

_LOGO_URL = 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/logo.jpg'
_FAITH_LOGO_URL = 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/faith_logo.jpg'


def _get_frontend_url():
    return getattr(settings, 'FRONTEND_URL', None) or 'https://rccg-r63-juniorchurch.vercel.app'


def _send_in_thread(subject, html_content, recipients, sender='default', fail_silently=True):
    """Dispatch an email in a background daemon thread so it never blocks the response."""

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
                logger.info('Email sent: %s → %s', safe_subject, recipients)
            except Exception:
                logger.info('Email sent → %s', recipients)
        except Exception as exc:
            logger.error('Email failed to %s: %s', recipients, exc)
            if not fail_silently:
                raise

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    return thread


def _base_context(registration):
    """
    Build template context from an EventRegistration, aliasing field names so
    the existing email templates (which were written for the legacy Ticket model)
    continue to work without modification.
    """
    frontend_url = _get_frontend_url()
    event = registration.event
    # Deep-link into the attendee's registration on the frontend
    registration_url = (
        f"{frontend_url}/events/{event.slug}/registration/{registration.registration_id}"
        if event and event.slug else None
    )
    return {
        'registration': registration,
        'event': event,
        # Aliases expected by existing templates
        'ticket_id': registration.registration_id,
        'full_name': registration.attendee_name,
        'category': registration.attendee_category,
        'registered_at': registration.created_at,
        'registration_url': registration_url,
        # Gender-aware Open Peeps avatar
        'avatar_url': get_registration_avatar(registration, size=100),
        # Shared visuals
        'frontend_url': frontend_url,
        'logo_url': _LOGO_URL,
        'faith_logo_url': _FAITH_LOGO_URL,
    }


def _recipients(registration):
    """Return attendee email plus guardian email when they differ."""
    emails = [registration.attendee_email]
    if registration.guardian_email and registration.guardian_email != registration.attendee_email:
        emails.append(registration.guardian_email)
    return emails


class EventEmailService:
    """Transactional email methods for the events app."""

    @staticmethod
    def send_registration_confirmation(registration):
        """
        Send a 'registration received / pending' email immediately after signup.
        Reuses the existing ticket_confirmation.html template.
        """
        subject = (
            f"Registration Received – {registration.event.title} "
            f"[{registration.registration_id}]"
        )
        context = _base_context(registration)
        html = render_to_string('emails/ticket_confirmation.html', context)
        return _send_in_thread(subject, html, _recipients(registration), sender='no_reply')

    @staticmethod
    def send_registration_confirmed(registration):
        """
        Send an approval / confirmation email with optional QR code.
        Reuses the existing ticket_approved.html template.
        """
        subject = (
            f"\U0001f389 You're Confirmed! {registration.event.title} "
            f"[{registration.registration_id}]"
        )
        context = _base_context(registration)

        # Attach QR code as base64 if it exists
        if registration.qr_code:
            try:
                with registration.qr_code.open('rb') as f:
                    context['qr_code_base64'] = base64.b64encode(f.read()).decode('utf-8')
            except Exception as exc:
                logger.warning(
                    'Could not read QR code for %s: %s',
                    registration.registration_id, exc
                )

        html = render_to_string('emails/ticket_approved.html', context)
        return _send_in_thread(subject, html, _recipients(registration), sender='junior_church')

    @staticmethod
    def send_status_update(registration, old_status, new_status):
        """
        Send a generic status-change notification.
        Reuses the existing status_update.html template.
        """
        subject = f"Registration Update – {registration.registration_id}"
        context = {
            **_base_context(registration),
            'old_status': old_status,
            'new_status': new_status,
        }
        html = render_to_string('emails/status_update.html', context)
        return _send_in_thread(subject, html, _recipients(registration), sender='no_reply')

    @staticmethod
    def send_bulk_registration_confirmation(registrations, coordinator_name, coordinator_email):
        """
        Send a consolidated summary to a coordinator after bulk registration.
        Reuses the existing bulk_ticket_confirmation.html template.

        Args:
            registrations: list of EventRegistration objects
            coordinator_name: str – name shown in the greeting
            coordinator_email: str – sole recipient
        """
        if not registrations or not coordinator_email:
            logger.warning(
                'Cannot send bulk confirmation: missing registrations or coordinator email'
            )
            return None

        count = len(registrations)
        subject = (
            f"Bulk Registration Confirmation – "
            f"{registrations[0].event.title} ({count} registrations)"
        )

        # Group registrations by category for the template
        by_category = {}
        for reg in registrations:
            cat = reg.attendee_category or 'General'
            by_category.setdefault(cat, []).append(reg)

        context = {
            'coordinator_name': coordinator_name,
            'ticket_count': count,
            'registrations': registrations,
            'registrations_by_category': by_category,
            'registered_at': registrations[0].created_at,
            'event': registrations[0].event,
            'frontend_url': _get_frontend_url(),
            'logo_url': _LOGO_URL,
            'faith_logo_url': _FAITH_LOGO_URL,
        }
        html = render_to_string('emails/bulk_registration_confirmation.html', context)
        return _send_in_thread(subject, html, [coordinator_email], sender='no_reply')
