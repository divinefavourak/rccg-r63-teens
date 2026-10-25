"""
Group registration: a coordinator registers a headcount for an event and
pays for it once.

A batch is a number of seats, so many for boys and so many for girls. Each
seat is an `EventRegistration` with a ticket number and a claim code, and no
attendee yet. The coordinator hands the numbers out; at the event the teen
opens the app and claims their seat with both (`claim`), which files it
under their account and fills in who they are.

* The price of a seat is the event's price, or its group price when the
  headcount reaches the event's group threshold. It is fixed on the batch
  when the batch is made or resized.
* Seats hold places like any registration, so a batch is refused when it
  would take the event past its capacity. A batch never goes on the waiting
  list.
* A batch is paid when the successful `Payment`s against it add up to what
  it owes, whether they came through the gateway or from a receipt someone
  checked (`payments/receipts.py`). Only then are its seats paid and
  confirmed. Its unpaid seats are not given up after the hold that applies to
  a teen's own registration (`payments.registrations.expire_unpaid`):
  transfers take days to be checked.
"""
import logging
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.crypto import constant_time_compare, get_random_string

from identity.authorization import has_permission
from identity.permissions_registry import Perm

from . import bedspaces
from .models import Event, EventRegistration, RegistrationAuditLog, RegistrationBatch

logger = logging.getLogger(__name__)

Status = EventRegistration.Status
PaymentStatus = EventRegistration.PaymentStatus
BatchStatus = RegistrationBatch.Status

# Letters and digits that cannot be misread for one another: no 0/O, 1/l/I.
# Upper case only, since a coordinator reads them out loud.
_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
CLAIM_CODE_LENGTH = 6
_REFERENCE_LENGTH = 6

# A sanity limit on one batch, not a business rule.
MAX_SEATS = 2000

GENDERS = ('male', 'female')


class BatchError(Exception):
    """The request cannot be done. The message is for the coordinator."""


# ── Price ────────────────────────────────────────────────────────────────────

def unit_price(event, headcount):
    """What one seat costs in a batch of `headcount`."""
    if event.is_free:
        return Decimal('0')
    price = Decimal(event.current_price or 0)
    if (event.group_discount_price is not None and event.group_discount_threshold
            and headcount >= event.group_discount_threshold):
        price = min(price, Decimal(event.group_discount_price))
    return price


def quote(event, male, female):
    headcount = male + female
    price = unit_price(event, headcount)
    discounted = (
        not event.is_free and price < Decimal(event.current_price or 0))
    return {
        'headcount': headcount,
        'unit_price': price,
        'amount_due': price * headcount,
        'group_discount_applied': discounted,
        'regular_price': Decimal(event.current_price or 0),
    }


# ── Who may ──────────────────────────────────────────────────────────────────

def can_manage(user, batch_or_node):
    """May `user` run batches for this node: `events.manage` at or above it."""
    node = getattr(batch_or_node, 'node', batch_or_node)
    return has_permission(user, Perm.EVENTS_MANAGE, node)


def refusal(event, node, user, headcount):
    """Why a batch of `headcount` cannot be made now, or None when it can."""
    if not event.group_registration_enabled:
        return 'This event does not take group registrations.'
    if event.status != 'published':
        return 'This event is not published yet.'
    if event.registration_status != Event.RegistrationStatus.OPEN:
        return 'Registration is not open for this event.'
    if event.is_past:
        return 'This event has ended.'
    if headcount < 1:
        return 'Register at least one person.'
    if headcount > MAX_SEATS:
        return f'A group can have at most {MAX_SEATS} people. Split it into two.'
    if not can_manage(user, node):
        return 'You do not manage that part of the church.'
    return None


# ── Making and changing a batch ──────────────────────────────────────────────

def _code(length):
    return get_random_string(length, _CODE_ALPHABET)


def _new_reference():
    for _ in range(10):
        reference = f'GRP-{_code(_REFERENCE_LENGTH)}'
        if not RegistrationBatch.objects.filter(reference=reference).exists():
            return reference
    raise RuntimeError('Could not find a free batch reference.')


def _check_room(event, extra):
    if event.max_attendees and event.places_taken + extra > event.max_attendees:
        left = max(event.max_attendees - event.places_taken, 0)
        raise BatchError(
            f'The event has {left} place{"" if left == 1 else "s"} left, '
            f'so it cannot take {extra} more.')


def _add_seats(batch, event, gender, count, user):
    """Make `count` seats for `gender`. Inside the caller's transaction."""
    free = event.is_free
    taken = batch.seats.count()
    for n in range(1, count + 1):
        seat = EventRegistration(
            event=event,
            batch=batch,
            node=batch.node,
            registered_by=user,
            registration_type=EventRegistration.RegistrationType.BULK,
            attendee_name=f'{batch.node.name} · seat {taken + n}',
            attendee_gender=gender,
            amount_due=None if free else batch.unit_price,
            payment_status=PaymentStatus.NOT_REQUIRED if free else PaymentStatus.PENDING,
            guardian_consent=batch.consent_attested,
            consent_timestamp=timezone.now() if batch.consent_attested else None,
        )
        for _ in range(5):
            seat.claim_code = _code(CLAIM_CODE_LENGTH)
            try:
                with transaction.atomic():
                    seat.save()
                break
            except IntegrityError:
                if EventRegistration.objects.filter(claim_code=seat.claim_code).exists():
                    seat.registration_id = ''
                    continue
                raise
        else:
            raise RuntimeError('Could not find a free claim code.')
        if free:
            seat.confirm(user)
        bedspaces.sync(seat)


def _price_seats(batch):
    """Bring the batch's total, and each seat's share, up to date."""
    held = batch.seats.exclude(status=Status.CANCELLED)
    batch.male_count = held.filter(attendee_gender='male').count()
    batch.female_count = held.filter(attendee_gender='female').count()
    batch.unit_price = unit_price(batch.event, batch.headcount)
    batch.amount_due = batch.unit_price * batch.headcount
    if not batch.event.is_free:
        held.update(amount_due=batch.unit_price)


def create(user, event, node, male, female, *, contact_email='', contact_phone='', notes='',
           consent_attested=False):
    """Make a batch and its seats. Raises `BatchError` with the reason it cannot."""
    if male < 0 or female < 0:
        raise BatchError('The counts cannot be negative.')
    with transaction.atomic():
        event = Event.objects.select_for_update().get(pk=event.pk)
        why = refusal(event, node, user, male + female)
        if why:
            raise BatchError(why)
        if event.requires_guardian_consent and not consent_attested:
            raise BatchError(
                'This event needs each parent or guardian to agree. Confirm that they have.')
        _check_room(event, male + female)

        batch = RegistrationBatch.objects.create(
            reference=_new_reference(),
            event=event,
            node=node,
            created_by=user,
            contact_email=contact_email,
            contact_phone=contact_phone,
            notes=notes,
            consent_attested=consent_attested,
            unit_price=unit_price(event, male + female),
        )
        _add_seats(batch, event, 'male', male, user)
        _add_seats(batch, event, 'female', female, user)
        _price_seats(batch)
        if event.is_free:
            batch.status = BatchStatus.PAID
            batch.paid_at = timezone.now()
        batch.save()
        return batch


def resize(user, batch, male, female):
    """
    Change the headcount. Only before any money has come in or a receipt is
    waiting: after that the coordinator makes a second batch for the extra
    people, so what was paid for never changes under the person checking it.
    Seats are taken away newest first, and never a claimed one.
    """
    if male < 0 or female < 0:
        raise BatchError('The counts cannot be negative.')
    with transaction.atomic():
        event = Event.objects.select_for_update().get(pk=batch.event_id)
        batch = RegistrationBatch.objects.select_for_update().get(pk=batch.pk)
        if batch.status != BatchStatus.AWAITING_PAYMENT or batch.amount_paid > 0:
            raise BatchError(
                'This group has a payment or a receipt against it, so its size is fixed. '
                'Register the extra people as a new group.')
        if batch.receipts.filter(status='submitted').exists():
            raise BatchError('A receipt for this group is being checked. Wait for it first.')
        if male + female < 1:
            raise BatchError('A group needs at least one person. Cancel it instead.')
        if male + female > MAX_SEATS:
            raise BatchError(f'A group can have at most {MAX_SEATS} people.')

        held = batch.seats.exclude(status=Status.CANCELLED)
        wanted = {'male': male, 'female': female}
        extra = sum(max(wanted[g] - held.filter(attendee_gender=g).count(), 0) for g in GENDERS)
        _check_room(event, extra)

        for gender in GENDERS:
            have = held.filter(attendee_gender=gender).count()
            if wanted[gender] > have:
                _add_seats(batch, event, gender, wanted[gender] - have, user)
            elif wanted[gender] < have:
                spare = list(
                    held.filter(attendee_gender=gender, claimed_at__isnull=True)
                    .order_by('-created_at', '-registration_id')[:have - wanted[gender]])
                if len(spare) < have - wanted[gender]:
                    raise BatchError(
                        f'Some {gender} seats have been claimed, so there cannot be fewer '
                        f'than {have - len(spare)}.')
                for seat in spare:
                    seat.cancel(user, reason='Removed from the group.')
        _price_seats(batch)
        batch.save()
        return batch


def cancel(user, batch, reason=''):
    """Cancel the batch and give up its seats. Not once money has come in."""
    with transaction.atomic():
        batch = RegistrationBatch.objects.select_for_update().get(pk=batch.pk)
        if batch.amount_paid > 0 and not batch.event.is_free:
            raise BatchError(
                'Money has been received for this group. Ask the organisers to refund it '
                'before it is cancelled.')
        for seat in batch.seats.exclude(status=Status.CANCELLED):
            seat.cancel(user, reason=reason or 'The group registration was cancelled.')
        batch.status = BatchStatus.CANCELLED
        batch.save(update_fields=['status', 'updated_at'])
        return batch


def name_seats(user, batch, rows):
    """
    Put names on seats before the teens claim them, for the ticket sheet and
    the check-in desk. `rows` is `[{'registration_id', 'name', 'phone'}]`.
    Returns `(updated, errors)`, the errors one per row that was not used.
    """
    seats = {
        s.registration_id.upper(): s
        for s in batch.seats.exclude(status=Status.CANCELLED)
    }
    updated, errors = 0, []
    for index, row in enumerate(rows, start=1):
        ticket = str(row.get('registration_id') or '').strip().upper()
        seat = seats.get(ticket)
        if seat is None:
            errors.append({'row': index, 'registration_id': ticket,
                           'error': 'No seat in this group has that ticket number.'})
            continue
        if seat.claimed_at:
            errors.append({'row': index, 'registration_id': ticket,
                           'error': 'This seat has been claimed, so it has the teen\'s own name.'})
            continue
        name = str(row.get('name') or '').strip()[:255]
        phone = str(row.get('phone') or '').strip()[:20]
        if not name:
            errors.append({'row': index, 'registration_id': ticket, 'error': 'The name is empty.'})
            continue
        seat.attendee_name = name
        if phone:
            seat.attendee_phone = phone
        seat.save(update_fields=['attendee_name', 'attendee_phone', 'updated_at'])
        updated += 1
    return updated, errors


# ── Money ────────────────────────────────────────────────────────────────────

def refresh(batch):
    """
    Work out what has been paid and what the batch's state is, and mark its
    seats paid once it is paid in full. Call inside a transaction; locks the
    batch. Returns what to do once the transaction commits, or None.
    """
    from payments.models import Payment

    batch = RegistrationBatch.objects.select_for_update().get(pk=batch.pk)
    if batch.status == BatchStatus.CANCELLED:
        return None
    was = batch.status
    paid = (
        Payment.objects.filter(batch=batch, status=Payment.Status.SUCCESS)
        .aggregate(total=Sum('amount'))['total'] or Decimal('0'))
    batch.amount_paid = paid

    if batch.amount_due > 0 and paid >= batch.amount_due or batch.event.is_free:
        batch.status = BatchStatus.PAID
        batch.paid_at = batch.paid_at or timezone.now()
    elif batch.receipts.filter(status='submitted').exists():
        batch.status = BatchStatus.UNDER_REVIEW
    elif paid > 0:
        batch.status = BatchStatus.PART_PAID
    else:
        batch.status = BatchStatus.AWAITING_PAYMENT
    batch.save(update_fields=['amount_paid', 'status', 'paid_at', 'updated_at'])

    if batch.status == BatchStatus.PAID and was != BatchStatus.PAID:
        _settle_seats(batch)
        return lambda: _announce_paid(batch)
    return None


def _settle_seats(batch):
    latest = batch.payments.filter(status='success').order_by('-completed_at').first()
    reference = latest.reference if latest else ''
    for seat in batch.seats.select_for_update().exclude(status=Status.CANCELLED):
        if seat.payment_status == PaymentStatus.PAID:
            continue
        before = {'payment_status': seat.payment_status, 'status': seat.status}
        seat.payment_status = PaymentStatus.PAID
        seat.amount_paid = seat.amount_due
        seat.payment = latest
        seat.payment_reference = reference
        seat.save(update_fields=[
            'payment_status', 'amount_paid', 'payment', 'payment_reference', 'updated_at'])
        if seat.status == Status.PENDING:
            seat.confirm()
        RegistrationAuditLog.objects.create(
            registration=seat,
            action=RegistrationAuditLog.ActionType.PAYMENT_UPDATE,
            old_values=before,
            new_values={'payment_status': PaymentStatus.PAID, 'status': seat.status,
                        'batch': batch.reference, 'reference': reference},
        )


def _announce_paid(batch):
    from .email_service import EventEmailService
    try:
        EventEmailService.send_batch_paid(batch)
    except Exception:
        logger.exception('Could not email the coordinator that %s is paid', batch.reference)


# ── A teen claiming a seat ───────────────────────────────────────────────────

def claim(user, ticket, code):
    """
    File a seat under `user`, who proved it is theirs with its ticket number
    and claim code. Returns the seat. Raises `BatchError` with the reason it
    cannot.
    """
    ticket = (ticket or '').strip().upper()
    code = (code or '').strip().upper()
    if not ticket or not code:
        raise BatchError('Enter the ticket number and the code your coordinator gave you.')

    with transaction.atomic():
        seat = (
            EventRegistration.objects.select_for_update()
            .select_related('event')
            .filter(registration_id__iexact=ticket, batch__isnull=False).first())
        # The same answer for a ticket that is not a seat and a wrong code, so
        # the endpoint cannot be used to find out which ticket numbers exist.
        if seat is None or not constant_time_compare(seat.claim_code or '', code):
            raise BatchError('That ticket number and code do not match.')
        if seat.claimed_at:
            if seat.user_id == user.pk:
                return seat
            raise BatchError('This seat has already been claimed. Ask your coordinator.')
        if seat.status == Status.CANCELLED:
            raise BatchError('This seat was cancelled. Ask your coordinator.')
        if user.email and EventRegistration.objects.filter(
                event=seat.event, attendee_email__iexact=user.email).exists():
            raise BatchError('You already have a ticket for this event.')

        profile = getattr(user, 'teen_profile', None)
        gender = (getattr(profile, 'gender', '') or getattr(user, 'gender', '') or '').lower()
        if gender in GENDERS and seat.attendee_gender in GENDERS and gender != seat.attendee_gender:
            raise BatchError(
                f'This seat is for a {seat.attendee_gender} attendee. Ask your coordinator '
                f'for the right ticket.')

        seat.user = user
        seat.profile = profile
        seat.attendee_name = user.get_full_name() or seat.attendee_name
        seat.attendee_email = user.email or ''
        seat.attendee_phone = getattr(user, 'phone', '') or seat.attendee_phone
        if profile is not None:
            dob = profile.date_of_birth
            if dob:
                today = timezone.localdate()
                seat.attendee_date_of_birth = dob
                seat.attendee_age = today.year - dob.year - (
                    (today.month, today.day) < (dob.month, dob.day))
            for field in ('guardian_name', 'guardian_phone', 'guardian_email',
                          'guardian_relationship', 'emergency_contact_name',
                          'emergency_contact_phone', 'emergency_contact_relationship',
                          'medical_conditions', 'allergies', 'medications',
                          'dietary_restrictions'):
                value = getattr(profile, field, '')
                if value:
                    setattr(seat, field, value)
        seat.claimed_at = timezone.now()
        try:
            with transaction.atomic():
                seat.save()
        except IntegrityError:
            raise BatchError('You already have a ticket for this event.')
        RegistrationAuditLog.objects.create(
            registration=seat,
            user=user,
            action=RegistrationAuditLog.ActionType.UPDATE,
            new_values={'claimed_by': str(user.pk)},
        )
        return seat
