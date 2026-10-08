"""
Bedspaces: who sleeps where at an event that has somewhere to sleep.

Off unless the organiser turns it on for the event (`Event.bedspaces_enabled`).
The rules, as the product owner set them:

* Beds are named and numbered serially per hostel: ``HA-014``.
* They are given out automatically, oldest registration first.
* A registration holds its bed while it holds its place. On a free event the
  bed is firm at once; on a paid one it is held and becomes firm when the
  registration is paid. Nothing is stored for that: `is_firm` is read from the
  registration, so it cannot drift from the payment.
* Running out of beds does not close the event. Registration carries on, the
  person simply has no bed, and is told so.
* Leaders do not draw on the attendees' beds. Each hostel reserves a number of
  its beds for leaders; a leader takes one of those and nothing else, and an
  attendee never takes one. The organiser releases reserved beds by lowering
  the number.
* Hostels are single-gender. A registration with no usable gender is never
  placed automatically; it waits for the organiser.

Every allocation locks the event's hostels for that gender, so two people
registering at once cannot be given the same bed.
"""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import BedAssignment, EventRegistration, Hostel

_GENDERS = {
    'male': Hostel.Gender.MALE, 'm': Hostel.Gender.MALE, 'boy': Hostel.Gender.MALE,
    'female': Hostel.Gender.FEMALE, 'f': Hostel.Gender.FEMALE, 'girl': Hostel.Gender.FEMALE,
}

# Roles that are not leadership, the same rule `identity/class_views.py` uses.
_NOT_LEADERSHIP = ('teen', 'parent')
ADULT_AGE = 20


def gender_of(registration):
    """`male`, `female`, or None when the registration does not say."""
    raw = (registration.attendee_gender or '').strip().lower()
    if raw not in _GENDERS:
        profile = registration.profile
        raw = (getattr(profile, 'gender', '') or '').strip().lower()
    return _GENDERS.get(raw)


def holds_leader_role(user):
    """True when the user holds a current role other than teen or parent."""
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    from identity.models import RoleAssignment
    today = timezone.localdate()
    return (
        RoleAssignment.objects
        .filter(user=user, is_active=True, start_date__lte=today)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .exclude(role__code__in=_NOT_LEADERSHIP)
        .exists()
    )


def attends_as_leader(user, age, wanted):
    """
    Whether a registration is a leader's.

    Nobody without a leader role is. An adult with one always is. A teenager
    with one chooses, which is the tick box on the registration form.
    """
    if not holds_leader_role(user):
        return False
    if age is not None and age >= ADULT_AGE:
        return True
    return bool(wanted)


def is_firm(registration):
    """A bed is firm once nothing is owed for the place it goes with."""
    return registration.event.is_free or registration.is_paid


def bed_of(registration):
    """The registration's bed, or None."""
    return BedAssignment.objects.select_related('hostel').filter(
        registration=registration).first()


def _free_serial(hostel, taken):
    return next(n for n in range(1, hostel.capacity + 1) if n not in taken)


def _room_for(hostel, beds, leader):
    """Beds left in `hostel` for a leader, or for an attendee."""
    leaders = sum(1 for _, for_leader in beds if for_leader)
    if leader:
        return hostel.reserved_for_leaders - leaders
    return (hostel.capacity - hostel.reserved_for_leaders) - (len(beds) - leaders)


@transaction.atomic
def allocate(registration, hostel=None, assigned_by=None):
    """
    Give `registration` the next free bed, or return None when there is none.

    With `hostel`, only that hostel is tried: the organiser placing someone by
    hand. It must still be a hostel of this event and of the person's gender.
    """
    existing = bed_of(registration)
    if existing is not None:
        return existing

    gender = gender_of(registration)
    if gender is None:
        if hostel is not None:
            raise ValidationError(
                'This registration has no gender recorded, so it cannot be '
                'placed in a hostel. Add it to the registration first.')
        return None

    hostels = (
        Hostel.objects.select_for_update()
        .filter(event_id=registration.event_id, gender=gender)
        .order_by('code')
    )
    if hostel is not None:
        hostels = hostels.filter(pk=hostel.pk)
        if not hostels.exists():
            raise ValidationError(
                f'{hostel.name} is not a {gender} hostel for this event.')

    leader = registration.attending_as_leader
    for candidate in hostels:
        beds = list(candidate.beds.values_list('serial', 'for_leader'))
        if _room_for(candidate, beds, leader) <= 0:
            continue
        return BedAssignment.objects.create(
            registration=registration,
            hostel=candidate,
            serial=_free_serial(candidate, {serial for serial, _ in beds}),
            for_leader=leader,
            assigned_by=assigned_by,
        )

    if hostel is not None:
        kind = 'leader' if leader else 'attendee'
        raise ValidationError(f'{hostel.name} has no free {kind} bed.')
    return None


def release(registration):
    """Give the bed back. Returns True when there was one."""
    deleted, _ = BedAssignment.objects.filter(registration=registration).delete()
    return bool(deleted)


def sync(registration):
    """
    Make the registration's bed match its status: one while it holds a place,
    none once it does not. Safe to call after any change, any number of times.
    """
    if not registration.event.bedspaces_enabled:
        return None
    if registration.status not in EventRegistration.HOLDS_A_PLACE:
        release(registration)
        return None
    return allocate(registration)


@transaction.atomic
def move(registration, hostel, assigned_by=None):
    """Put the registration in `hostel`, giving up the bed it had."""
    release(registration)
    return allocate(registration, hostel=hostel, assigned_by=assigned_by)


def waiting(event):
    """Registrations that hold a place at `event` and have no bed, oldest first."""
    return (
        event.registrations
        .filter(status__in=EventRegistration.HOLDS_A_PLACE, bed__isnull=True)
        .select_related('profile', 'event')
        .order_by('created_at')
    )


def place_waiting(event):
    """
    Try again for everyone without a bed, oldest registration first. What the
    organiser runs after adding a hostel or releasing reserved beds.

    Returns how many were placed.
    """
    if not event.bedspaces_enabled:
        return 0
    placed = 0
    for registration in waiting(event):
        if allocate(registration) is not None:
            placed += 1
    return placed


def summary(event):
    """The numbers the organiser's screen shows for an event."""
    hostels = []
    for hostel in event.hostels.order_by('code'):
        beds = list(hostel.beds.values_list('serial', 'for_leader'))
        leaders = sum(1 for _, for_leader in beds if for_leader)
        hostels.append({
            'id': str(hostel.pk),
            'name': hostel.name,
            'code': hostel.code,
            'gender': hostel.gender,
            'capacity': hostel.capacity,
            'reserved_for_leaders': hostel.reserved_for_leaders,
            'attendees_placed': len(beds) - leaders,
            'leaders_placed': leaders,
            'attendee_beds_free': _room_for(hostel, beds, leader=False),
            'leader_beds_free': _room_for(hostel, beds, leader=True),
        })
    unplaced = list(waiting(event))
    return {
        'enabled': event.bedspaces_enabled,
        'hostels': hostels,
        'waiting': len(unplaced),
        'waiting_without_gender': sum(1 for r in unplaced if gender_of(r) is None),
    }


def describe(registration):
    """One sentence about the bed, for a notification. '' when beds are off."""
    if not registration.event.bedspaces_enabled:
        return ''
    bed = bed_of(registration)
    if bed is None:
        return (' No bedspace is left for this event, so you will need to '
                'arrange where to sleep.')
    if is_firm(registration):
        return f' Your bedspace is {bed.code} in {bed.hostel.name}.'
    return (f' Bedspace {bed.code} in {bed.hostel.name} is held for you '
            f'until payment is confirmed.')
