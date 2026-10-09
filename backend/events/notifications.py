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

from common.dates import app_timezone
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


def _when_and_where(event):
    """'Friday 18 December at 10:00, Redemption Camp', in the app timezone."""
    # Not `timezone.localtime`: that is settings.TIME_ZONE, which is UTC, and
    # would send the teen an hour early.
    starts_at = event.start_datetime.astimezone(app_timezone())
    when = f'{starts_at:%A} {starts_at.day} {starts_at:%B} at {starts_at:%H:%M}'
    return f'{when}, {event.venue}' if event.venue else when


def notify_registration_received(registration):
    """
    Registration created, payment (if any) still outstanding.

    Worth its own message because unpaid registrations expire (after
    `UNPAID_REGISTRATION_HOLD_HOURS`, 24 unless set otherwise) and
    release their capacity (`docs/07` §9) — a teen who does not know that loses
    their place silently.
    """
    if registration.user_id is None:
        return None

    event = registration.event
    if registration.status == registration.Status.WAITLISTED:
        # No place yet, so nothing is held and there is nothing to pay for.
        body = (f'{event.title} is full, so you are on the waitlist. '
                f'We will tell you if a place opens up.')
    elif registration.is_paid:
        body = f'You are registered for {event.title}.'
    else:
        # The deadline is a setting, and 0 means the place is never given up:
        # say the real number, or no deadline at all.
        from payments.registrations import hold_hours
        hours = hold_hours()
        within = f' within {hours} hour{"" if hours == 1 else "s"}' if hours else ''
        body = (f'Your place at {event.title} is held. '
                f'Complete payment{within} to confirm it.')
    body += f' It is on {_when_and_where(event)}.'
    # Where they will sleep, or that there is no bed left: said at the moment
    # they register, not discovered on arrival.
    from . import bedspaces
    body += bedspaces.describe(registration)
    body += f' Your registration ID is {registration.registration_id}.'

    return send(
        registration.user,
        NotificationType.TRANSACTIONAL,
        'Registration received',
        body,
        deep_link=_ticket_link(registration),
        data={**_base_data(registration), 'payment_status': registration.payment_status},
        dedupe_key=f'event:registration_received:{registration.id}',
        # Called from a request: the teen, or the door, must not wait on it.
        defer_push=True,
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
        # Called from a request: the teen, or the door, must not wait on it.
        defer_push=True,
    )


def notify_payment_received(registration, place_gone=False):
    """
    Paystack confirmed the payment. Quiet-hours exempt: whoever just paid is
    looking at the ticket, waiting for it to change.

    `place_gone` is the rare case of a place that was released for not being
    paid, then paid for after someone else took it.
    """
    if registration.user_id is None:
        return None

    title = registration.event.title
    if place_gone:
        heading = 'Payment received, but the event is full'
        body = (f'We received your payment for {title}, but your place had '
                f'already been released and the event is now full. '
                f'An organiser will contact you about a refund.')
    else:
        from . import bedspaces
        heading = 'Payment received'
        body = (f'We received your payment for {title}. Your place is '
                f'confirmed and your QR ticket is ready.')
        body += bedspaces.describe(registration)

    return send(
        registration.user,
        NotificationType.TRANSACTIONAL,
        heading,
        body,
        deep_link=_ticket_link(registration),
        data={**_base_data(registration), 'payment_status': registration.payment_status},
        dedupe_key=f'event:payment_received:{registration.id}',
        # Called from the webhook: Paystack must not wait on a push.
        defer_push=True,
    )


def notify_place_released(registration):
    """
    The place was held for payment and given up when the time ran out. Said
    plainly, with the way back: the ticket can still be paid for while the
    event has room.
    """
    if registration.user_id is None:
        return None

    return send(
        registration.user,
        NotificationType.EVENT,
        'Your place was released',
        f'Your place at {registration.event.title} was not paid for in time, '
        f'so it was released. If there is still room, you can pay from your '
        f'ticket to get it back.',
        deep_link=_ticket_link(registration),
        data=_base_data(registration),
        dedupe_key=f'event:place_released:{registration.id}',
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
        # Called from a request: the teen, or the door, must not wait on it.
        defer_push=True,
    )


def notify_checked_in(registration):
    """
    The ticket was scanned at the door and accepted.

    Sent so the teen's own phone answers the scan: their ticket turns to
    "Checked in" in front of them instead of a volunteer saying "you're fine, go
    in" while the screen still shows a QR code. `TRANSACTIONAL`, because it is the
    result of something that happened seconds ago and an evening event can easily
    start inside quiet hours.
    """
    if registration.user_id is None:
        return None

    first_name = (registration.attendee_name or '').strip().split(' ')[0]
    return send(
        registration.user,
        NotificationType.TRANSACTIONAL,
        'You’re checked in',
        f'Welcome to {registration.event.title}{", " + first_name if first_name else ""}.',
        deep_link=_ticket_link(registration),
        data=_base_data(registration),
        dedupe_key=f'event:checked_in:{registration.id}',
        # Called from a request: the teen, or the door, must not wait on it.
        defer_push=True,
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
    Status = event.registrations.model.Status
    registrations = (
        event.registrations
        .filter(status=Status.CONFIRMED)
        .exclude(user__isnull=True)
        .select_related('user', 'event')
    )

    # Rendered in the app timezone, not UTC: "starts Saturday at 09:00" must be the
    # time the teen will actually walk in, not the stored instant.
    starts_at = event.start_datetime.astimezone(app_timezone())

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
