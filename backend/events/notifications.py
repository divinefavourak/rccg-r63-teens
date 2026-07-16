"""
Event lifecycle notifications.

`docs/07-feature-specifications.md` §10 lists "event lifecycle (confirmation,
reminder, changes)" among the types the central service must carry, and names
"email/SMS for transactional fallback (tickets, payment)" as a *fallback* — not
the primary channel.

So this module adds push + inbox alongside the existing e-mails; it does not
replace them. A teen on a Nigerian mobile connection may miss the push and find
the e-mail, or miss the e-mail and find the inbox. Both paths stay open.

**Type choice matters here.** Confirmations and tickets are `TRANSACTIONAL` —
quiet-hours exempt, because a teen who just paid at 22:00 is staring at the screen
waiting for their ticket. Reminders and change announcements are `EVENT` — they
respect quiet hours, because nothing about them cannot wait until morning.

Registrations may have **no user** (`EventRegistration.user` is nullable — a
coordinator can register an attendee who has no account). Those get the e-mail
only. Every function here is a no-op rather than an error in that case: a
notification failure must never break a registration.
"""
import logging

from notifications.models import NotificationType
from notifications.services import send

logger = logging.getLogger(__name__)


def _event_link(event):
    return f'/events/{event.id}'


def _ticket_link(registration):
    return f'/events/{registration.event_id}/ticket/{registration.id}'


def _base_data(registration):
    return {
        'event_id': str(registration.event_id),
        'registration_id': str(registration.id),
        'event_title': registration.event.title,
    }


def notify_registration_received(registration):
    """
    Registration created, payment (if any) still outstanding.

    Worth its own message because unpaid registrations expire after 24h and
    release their capacity (`docs/07` §9) — a teen who does not know that loses
    their place silently.
    """
    if registration.user_id is None:
        return None

    paid_already = registration.is_paid
    body = (
        f'You are registered for {registration.event.title}.'
        if paid_already else
        f'Your place at {registration.event.title} is held. '
        f'Complete payment within 24 hours to confirm it.'
    )

    return send(
        registration.user,
        NotificationType.TRANSACTIONAL,
        'Registration received',
        body,
        deep_link=_ticket_link(registration),
        data={**_base_data(registration), 'payment_status': registration.payment_status},
        dedupe_key=f'event:registration_received:{registration.id}',
    )


def notify_registration_confirmed(registration):
    """Confirmed and ticketed. Quiet-hours exempt: they are waiting for this."""
    if registration.user_id is None:
        return None

    return send(
        registration.user,
        NotificationType.TRANSACTIONAL,
        'You are in!',
        f'Your place at {registration.event.title} is confirmed. '
        f'Your QR ticket is ready.',
        deep_link=_ticket_link(registration),
        data=_base_data(registration),
        dedupe_key=f'event:registration_confirmed:{registration.id}',
    )


def notify_status_changed(registration, old_status, new_status):
    """
    A registration's status moved (waitlist promotion, cancellation, ...).

    Waitlist promotion is `TRANSACTIONAL`: a promoted teen usually has a deadline
    to claim the place, and holding that behind quiet hours could cost them it.
    Everything else is an ordinary `EVENT` notification.
    """
    if registration.user_id is None or old_status == new_status:
        return None

    Status = registration.Status
    promoted = old_status == Status.WAITLISTED and new_status in (
        Status.CONFIRMED, Status.PENDING,
    )

    if promoted:
        title = 'A place opened up'
        body = (f'A place at {registration.event.title} is yours. '
                f'Confirm it to keep it.')
        notification_type = NotificationType.TRANSACTIONAL
    elif new_status == Status.CANCELLED:
        title = 'Registration cancelled'
        body = f'Your registration for {registration.event.title} has been cancelled.'
        notification_type = NotificationType.EVENT
    else:
        title = 'Registration updated'
        body = (f'Your registration for {registration.event.title} is now '
                f'{registration.get_status_display().lower()}.')
        notification_type = NotificationType.EVENT

    return send(
        registration.user,
        notification_type,
        title,
        body,
        deep_link=_ticket_link(registration),
        data={**_base_data(registration),
              'old_status': old_status, 'new_status': new_status},
        # Keyed on the transition, not just the registration: a teen who is
        # waitlisted, promoted, and later cancelled must hear about each move.
        dedupe_key=f'event:status:{registration.id}:{old_status}:{new_status}',
    )


def _live_registrations(event):
    """Registrations that still care about this event."""
    Status = event.registrations.model.Status
    return (
        event.registrations
        .filter(status__in=[Status.PENDING, Status.CONFIRMED, Status.WAITLISTED])
        .exclude(user__isnull=True)
        .select_related('user', 'event')
    )


def notify_event_changed(event, summary):
    """
    Something about the event moved — time, venue, details.

    Goes to everyone still holding a place, including the waitlist: a waitlisted
    teen deciding whether to keep waiting deserves to know the venue changed.
    """
    sent = 0
    for registration in _live_registrations(event).iterator():
        notification = send(
            registration.user,
            NotificationType.EVENT,
            f'Update: {event.title}',
            summary,
            deep_link=_event_link(event),
            data=_base_data(registration),
            # `updated_at` in the key so a *second* change is a second message,
            # while a retried task is not.
            dedupe_key=f'event:changed:{event.id}:{event.updated_at.isoformat()}',
        )
        if notification:
            sent += 1
    return sent


def notify_event_cancelled(event):
    sent = 0
    for registration in _live_registrations(event).iterator():
        notification = send(
            registration.user,
            NotificationType.EVENT,
            f'{event.title} has been cancelled',
            'We are sorry. If you paid, a refund is being processed.',
            deep_link=_event_link(event),
            data=_base_data(registration),
            dedupe_key=f'event:cancelled:{event.id}',
        )
        if notification:
            sent += 1
    return sent


def notify_event_reminder(event):
    """
    The day-before reminder. Confirmed attendees only — reminding a teen to turn up
    to an event they have not paid for reads as a dunning notice, not a kindness.
    """
    from django.utils import timezone as dj_timezone

    Status = event.registrations.model.Status
    registrations = (
        event.registrations
        .filter(status=Status.CONFIRMED)
        .exclude(user__isnull=True)
        .select_related('user', 'event')
    )

    # Rendered in the app timezone, not UTC: "starts Saturday at 09:00" must be the
    # time the teen will actually walk in, not the stored instant.
    starts_at = dj_timezone.localtime(event.start_datetime)

    sent = 0
    for registration in registrations.iterator():
        notification = send(
            registration.user,
            NotificationType.EVENT,
            f'Coming up: {event.title}',
            f'{event.title} starts {starts_at.strftime("%A at %H:%M")}. '
            f'Have your QR ticket ready.',
            deep_link=_ticket_link(registration),
            data=_base_data(registration),
            # One reminder per registration, ever — the task's window may overlap.
            dedupe_key=f'event:reminder:{registration.id}',
        )
        if notification:
            sent += 1
    return sent
