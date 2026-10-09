"""
Check-in at the door.

`docs/CONSOLE-FIGMA-PROMPT.md`: "a purpose-built screen for a volunteer at a door,
on a phone, on a bad connection." Two things follow from that sentence.

**The person at the door is often a Teacher**, who holds `events.checkin` and
nothing else about events: not `events.view`, not `events.manage`. The older
`registrations/<id>/check_in/` action resolves its object through a queryset that
only a manager can see into, so for a Teacher every ticket 404'd. Everything here
is gated on `events.checkin` alone.

**A scan always gets an answer.** A ticket that is cancelled, unpaid, for another
event or already used is not an error to raise: it is one of the six things the
volunteer needs to be told, in words, with the attendee's name attached. So
`scan()` returns an outcome rather than throwing, and the view answers 200 for all
of them. Only a request the app itself got wrong (no event, no permission) is a
4xx.
"""
import logging

from django.db import transaction
from django.db.models import Count, Q

from common.dates import app_today, day_bounds
from identity.authorization import scope_queryset
from identity.permissions_registry import Perm

from . import notifications as event_notifications
from . import scoping
from .models import Event, EventRegistration, RegistrationAuditLog

logger = logging.getLogger(__name__)

# What a scan can turn out to be. The app draws one screen per value.
CHECKED_IN = 'checked_in'
ALREADY_CHECKED_IN = 'already_checked_in'
NOT_FOUND = 'not_found'
WRONG_EVENT = 'wrong_event'
NOT_PAID = 'not_paid'
CANCELLED = 'cancelled'
WAITLISTED = 'waitlisted'

Status = EventRegistration.Status

# A place that counts towards "184 of 240".
_HOLDS_A_PLACE = EventRegistration.HOLDS_A_PLACE
_ARRIVED = EventRegistration.ARRIVED


def checkable_events(user):
    """
    The published events this user may check people in to.

    Either the event reaches them (it is scoped at or above their position, which
    is how a parish Teacher comes to be on the door at a regional camp), or it
    sits inside a subtree where they hold `events.checkin` (a province coordinator
    helping at one of their parishes).
    """
    published = Event.objects.filter(status=Event.Status.PUBLISHED)
    reaches_me = scoping.visible_to(published, user).values('pk')
    under_me = scope_queryset(
        published, user, Perm.EVENTS_CHECKIN, node_field='scope_node').values('pk')
    return published.filter(Q(pk__in=reaches_me) | Q(pk__in=under_me))


def events_today(user):
    """Events running at any point during today, in the app's timezone."""
    start, end = day_bounds(app_today())
    return (
        checkable_events(user)
        .filter(start_datetime__lt=end, end_datetime__gte=start)
        .order_by('start_datetime')
    )


def counts_for(event):
    """`{'registered': 184, 'checked_in': 61}` for the counter on the scanner."""
    return event.registrations.aggregate(
        registered=Count('id', filter=Q(status__in=_HOLDS_A_PLACE)),
        checked_in=Count('id', filter=Q(status__in=_ARRIVED)),
    )


def _photo(registration):
    """The attendee's picture, if they have one: the door volunteer checks the face."""
    profile = registration.profile
    if profile is not None and profile.avatar:
        return profile.avatar.url
    picture = getattr(registration.user, 'profile_picture', None)
    return picture.url if picture else None


def _bed_code(registration):
    # Most events have no beds: do not spend a query per ticket finding that out.
    if not registration.event.bedspaces_enabled:
        return None
    from .models import BedAssignment
    bed = BedAssignment.objects.select_related('hostel').filter(
        registration=registration).first()
    return bed.code if bed else None


def attendee(registration):
    """The little card under every result: who this ticket belongs to."""
    return {
        'registration_id': registration.registration_id,
        'name': registration.attendee_name,
        'parish': registration.attendee_parish,
        'photo': _photo(registration),
        'status': registration.status,
        'payment_status': registration.payment_status,
        # Shown on the check-in success screen, so the volunteer can point.
        'bed': _bed_code(registration),
    }


def _result(outcome, registration=None, **extra):
    return {
        'outcome': outcome,
        'attendee': attendee(registration) if registration is not None else None,
        **extra,
    }


def scan(event, code, user, method='qr_scan', notes=''):
    """
    Resolve a ticket code against `event` and, if it is good, check it in.

    The row is locked for the length of the decision. Two volunteers scanning the
    same ticket at two doors must produce one check-in and one "already checked
    in", not two check-ins and a counter that is one too high.
    """
    code = (code or '').strip()
    if not code:
        return _result(NOT_FOUND)

    with transaction.atomic():
        registration = (
            EventRegistration.objects
            .select_for_update(of=('self',))
            .select_related('event', 'profile', 'user', 'checked_in_by')
            .filter(registration_id__iexact=code)
            .first()
        )

        if registration is None:
            return _result(NOT_FOUND)

        if registration.event_id != event.pk:
            other = registration.event
            return _result(
                WRONG_EVENT, registration,
                other_event={'title': other.title, 'start_datetime': other.start_datetime},
            )

        if registration.status == Status.CANCELLED:
            return _result(
                CANCELLED, registration,
                cancelled_at=registration.cancelled_at,
                refunded=(registration.payment_status
                          == EventRegistration.PaymentStatus.REFUNDED),
            )

        if registration.status in _ARRIVED:
            by = registration.checked_in_by
            return _result(
                ALREADY_CHECKED_IN, registration,
                checked_in_at=registration.checked_in_at,
                checked_in_by=(by.first_name or by.username) if by else '',
            )

        if registration.status == Status.WAITLISTED:
            return _result(WAITLISTED, registration)

        if not event.is_free and not registration.is_paid:
            return _result(NOT_PAID, registration, amount_due=registration.amount_due)

        registration.check_in(user=user, method=method, notes=notes)
        RegistrationAuditLog.objects.create(
            registration=registration,
            user=user,
            action='check_in',
            new_values={
                'checked_in_at': str(registration.checked_in_at),
                'method': registration.check_in_method,
            },
        )
        # Tell the teen, but only once the check-in is safely stored, and never
        # while the row is still locked: a push is a network call, and a slow one
        # must not hold up the next scan of the queue at the door.
        transaction.on_commit(lambda: _announce(registration))
        return _result(CHECKED_IN, registration, checked_in_at=registration.checked_in_at)


def _announce(registration):
    """Notify the attendee. A failure here must never undo or fail a check-in."""
    try:
        event_notifications.notify_checked_in(registration)
    except Exception:
        logger.exception('Could not notify %s of their check-in', registration.registration_id)


def search(event, query, limit=20):
    """
    Find a ticket by name or number, for the teen whose phone is dead.

    Bounded, and scoped to one event: this is a lookup at a door, not a way to
    browse a region's attendees.
    """
    query = (query or '').strip()
    if len(query) < 2:
        return EventRegistration.objects.none()
    return (
        event.registrations
        .select_related('profile', 'user')
        .filter(Q(attendee_name__icontains=query) | Q(registration_id__icontains=query))
        .order_by('attendee_name')[:limit]
    )
