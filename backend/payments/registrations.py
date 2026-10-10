"""
Paying for an event registration.

`services.py` was written to pay for a legacy `Ticket`. This module points the
same Squad account and the same `Payment` row at an `EventRegistration`, and
owns the rules about it:

* The amount is the registration's own `amount_due`, fixed when it was made.
  Squad's fee comes out of what the church receives; the payer is charged
  the price the event shows.
* One checkout at a time. A second tap on Pay, or a parent opening the link the
  teen sent, reopens the checkout that is already open rather than starting a
  second charge.
* Squad's word is what marks a registration paid: the webhook, or a verify
  call answered by Squad. Nothing the phone says does.
* A place on a paid event is held for `UNPAID_REGISTRATION_HOLD_HOURS`. After
  that it is given up. The same email cannot register twice for one event, so
  a place given up this way can still be paid for, and comes back if the event
  has room.
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from events.models import Event, EventRegistration, RegistrationAuditLog

from .models import Payment
from .services import PaymentAmountMismatch, PaymentService

logger = logging.getLogger(__name__)

Status = EventRegistration.Status
PaymentStatus = EventRegistration.PaymentStatus

# Written on a registration whose place was given up for not being paid. It is
# also how a late payment recognises a place it may bring back, as opposed to
# one a person cancelled.
UNPAID_REASON = 'Payment was not completed in time.'

# How long an open checkout is handed out again. Past this a new one is made:
# Squad gives up on a checkout nobody finished, and does not say when.
REUSE_FOR = timedelta(minutes=30)
# A payment row with no checkout page yet is another request still talking to
# Squad. After this long it is taken to have died instead.
PREPARING_FOR = timedelta(seconds=30)

_UNPAID = (PaymentStatus.PENDING, PaymentStatus.FAILED)
_PAY_LINK_SALT = 'payments.registration-pay-link'


class NotPayable(Exception):
    """This registration cannot be paid for. The message is for the payer."""


class BeingPrepared(Exception):
    """Another request is opening the checkout for this registration right now."""


class Unavailable(Exception):
    """Squad is not set up, or did not answer. The message is for the payer."""


def hold_hours():
    """How long an unpaid place is held. 0 means for ever."""
    return getattr(settings, 'UNPAID_REGISTRATION_HOLD_HOURS', 24)


def lapsed(registration):
    """Given up for not being paid, rather than cancelled by a person."""
    return (
        registration.status == Status.CANCELLED
        and registration.cancelled_by_id is None
        and registration.cancellation_reason == UNPAID_REASON
    )


def refusal(registration):
    """Why this registration cannot be paid for now, or None when it can."""
    event = registration.event
    if event.is_free or registration.payment_status == PaymentStatus.NOT_REQUIRED:
        return 'There is nothing to pay for this event.'
    if registration.payment_status == PaymentStatus.PAID:
        return 'This registration has already been paid for.'
    if registration.payment_status == PaymentStatus.REFUNDED:
        return 'This registration was refunded.'
    if not registration.amount_due or registration.amount_due <= 0:
        return 'There is nothing to pay for this registration.'
    if event.is_past:
        return 'This event has ended.'
    if registration.status == Status.WAITLISTED:
        return 'You are on the waiting list. You can pay once a place opens up.'
    if registration.status == Status.NO_SHOW:
        return 'This registration is closed.'
    if registration.status == Status.CANCELLED:
        if not lapsed(registration):
            return 'This registration was cancelled.'
        if event.is_full:
            return 'Your place was released and the event is now full.'
    return None


def pay_by(registration):
    """When an unpaid place will be given up, or None when no clock is running."""
    hours = hold_hours()
    if not hours or registration.status != Status.PENDING:
        return None
    if registration.payment_status not in _UNPAID or registration.event.is_free:
        return None
    return registration.created_at + timedelta(hours=hours)


# ── The link a parent pays from ──────────────────────────────────────────────

def pay_token(registration):
    """
    What goes in the link a teen sends to a parent. Signed, so it cannot be
    guessed or altered, and it needs no login. It does not expire by itself:
    it stops working when the registration can no longer be paid for.
    """
    return signing.dumps(str(registration.pk), salt=_PAY_LINK_SALT)


def from_pay_token(token):
    """The registration a pay link is for, or None for a link that is not ours."""
    try:
        pk = signing.loads(token, salt=_PAY_LINK_SALT)
    except signing.BadSignature:
        return None
    return EventRegistration.objects.select_related('event').filter(pk=pk).first()


# ── Opening a checkout ───────────────────────────────────────────────────────

def start(registration, return_url, return_to=''):
    """
    The Squad checkout for this registration: the one already open if there
    is one, a new one otherwise. Returns the `Payment`, whose
    `authorization_url` is the page to send the payer to.

    `return_url` is our page Squad sends the payer back to. It ends in a
    slash and the payment's reference is added to it. Squad's documentation
    does not name the query parameter it appends, so ours is in the path.

    `return_to` is where the payer's own app wants to land afterwards. The
    caller has already checked it is somewhere of ours.
    """
    try:
        service = PaymentService()
    except ValueError:
        raise Unavailable('Paying online is not set up yet. Please try again later.')

    # Held only for the reads and the insert. The call to Squad comes after
    # it is released: a slow answer from them must not hold a database row.
    with transaction.atomic():
        registration = EventRegistration.objects.select_for_update().get(pk=registration.pk)
        why = refusal(registration)
        if why:
            raise NotPayable(why)

        now = timezone.now()
        latest = (
            Payment.objects
            .filter(
                registration=registration,
                status=Payment.Status.PENDING,
                amount=registration.amount_due,
                initiated_at__gte=now - REUSE_FOR,
            )
            .order_by('-initiated_at')
            .first()
        )
        if latest is not None:
            if latest.authorization_url:
                return latest
            if latest.initiated_at >= now - PREPARING_FOR:
                raise BeingPrepared()

        event = registration.event
        payment = Payment.objects.create(
            reference=service.squad.generate_reference(),
            amount=registration.amount_due,
            currency='NGN',
            registration=registration,
            description=f'{event.title}: {registration.registration_id}',
            payer_email=registration.attendee_email,
            payer_name=registration.attendee_name,
            payer_phone=registration.attendee_phone,
            metadata={
                'registration_id': str(registration.pk),
                'registration_code': registration.registration_id,
                'event_id': str(event.pk),
                'return_to': return_to,
            },
        )

    try:
        payment.authorization_url = service.squad.open_checkout(
            reference=payment.reference,
            amount=payment.amount,
            email=registration.attendee_email,
            name=registration.attendee_name,
            callback_url=f'{return_url}{payment.reference}/',
            metadata={
                'payment_id': str(payment.pk),
                'registration_id': str(registration.pk),
                'registration_code': registration.registration_id,
                'event': event.title,
                'attendee': registration.attendee_name,
            },
        )
    except Exception as exc:
        logger.exception('Could not open a checkout for %s', registration.registration_id)
        payment.mark_as_failed({'error': str(exc)})
        raise Unavailable('We could not reach Squad. Please try again in a moment.')

    payment.save(update_fields=['authorization_url', 'updated_at'])
    return payment


# ── A payment that went through ──────────────────────────────────────────────

def settle(payment):
    """
    Record a successful payment on its registration.

    Called by `PaymentService._complete`, inside its transaction and with the
    payment's row locked, so it runs once per payment however many times
    Squad reports it. Returns what to do once that transaction commits, or
    None.
    """
    registration = EventRegistration.objects.select_for_update().get(pk=payment.registration_id)

    if registration.payment_status == PaymentStatus.PAID:
        # Two checkouts were open (the teen's and one a parent was sent
        # earlier) and both were paid. The money is real, so the payment stays
        # successful; the registration is not paid twice. Someone has to send
        # the second one back.
        logger.error(
            'Registration %s paid twice: %s as well as %s',
            registration.registration_id, payment.reference, registration.payment_reference)
        _audit(registration, {'paid_twice': payment.reference,
                              'amount': str(payment.amount)})
        return None

    before = {'payment_status': registration.payment_status, 'status': registration.status}
    registration.payment_status = PaymentStatus.PAID
    registration.amount_paid = payment.amount
    registration.payment = payment
    registration.payment_reference = payment.reference
    registration.save(update_fields=[
        'payment_status', 'amount_paid', 'payment', 'payment_reference', 'updated_at'])

    place_gone = False
    if registration.status == Status.PENDING:
        registration.confirm()
    elif lapsed(registration):
        # The place was given up and then paid for. It comes back unless
        # someone else has taken it since; the event's row is locked so that
        # is decided once.
        event = Event.objects.select_for_update().get(pk=registration.event_id)
        if event.is_full:
            place_gone = True
            logger.error(
                'Registration %s was paid (%s) after its place was released, '
                'and the event is full', registration.registration_id, payment.reference)
        else:
            registration.confirm()

    _audit(registration, {
        'payment_status': registration.payment_status,
        'status': registration.status,
        'reference': payment.reference,
        'amount': str(payment.amount),
        **({'place_gone': True} if place_gone else {}),
    }, before)

    return lambda: _announce_paid(registration, place_gone)


def _audit(registration, new_values, old_values=None):
    RegistrationAuditLog.objects.create(
        registration=registration,
        action=RegistrationAuditLog.ActionType.PAYMENT_UPDATE,
        old_values=old_values,
        new_values=new_values,
    )


def _announce_paid(registration, place_gone):
    """Tell the attendee. A failure here must never undo or fail a payment."""
    from events import notifications as event_notifications
    from events.email_service import EventEmailService

    try:
        event_notifications.notify_payment_received(registration, place_gone=place_gone)
    except Exception:
        logger.exception('Could not notify %s of their payment', registration.registration_id)
    if place_gone:
        return
    try:
        EventEmailService.send_registration_confirmed(registration)
    except Exception:
        logger.exception('Could not email %s their confirmation', registration.registration_id)


# ── Asking Squad ─────────────────────────────────────────────────────────────

def check(payment):
    """
    Ask Squad what became of one payment and act on the answer. Returns True
    when it is now successful.

    For the moment someone comes back from the checkout: the webhook usually
    gets there first, and this covers the times it has not. An unfinished
    checkout is left alone, not failed. Someone paying by transfer leaves the
    page to open their bank's app, and Squad calls that "abandoned" or
    "pending" until the money arrives.
    """
    if payment.status == Payment.Status.SUCCESS:
        return True
    if payment.status != Payment.Status.PENDING:
        return False

    try:
        service = PaymentService()
        charge = service.squad.verify_payment(payment.reference)
    except Exception:
        # Not set up, unreachable, or an answer that is not an answer. The
        # webhook is still on its way; this was only ever the second route.
        logger.exception('Could not ask Squad about %s', payment.reference)
        return False

    if charge['status'] == 'success':
        try:
            completed_payment, _ = service._complete(payment.reference, charge)
        except PaymentAmountMismatch:
            return False
        return completed_payment.status == Payment.Status.SUCCESS

    if charge['status'] == 'failed':
        with transaction.atomic():
            fresh = Payment.objects.select_for_update().get(pk=payment.pk)
            if fresh.status == Payment.Status.PENDING:
                fresh.mark_as_failed(charge['raw'])
    return False


def check_registration(registration):
    """`check` for each checkout this registration still has open."""
    since = timezone.now() - timedelta(hours=max(hold_hours(), 24))
    open_payments = (
        Payment.objects
        .filter(registration=registration, status=Payment.Status.PENDING,
                initiated_at__gte=since)
        .exclude(authorization_url='')
        .order_by('-initiated_at')[:3]
    )
    for payment in open_payments:
        if check(payment):
            return True
    return False


# ── Giving up places nobody paid for ─────────────────────────────────────────

def expire_unpaid(now=None):
    """
    Give up the places that were held for payment and not paid for in time.
    Returns how many.

    Does nothing while Squad is not set up: nobody can pay, so nobody can
    be late. Someone in the middle of paying is left for the next run.
    """
    hours = hold_hours()
    if not hours or not getattr(settings, 'SQUAD_SECRET_KEY', ''):
        return 0

    now = now or timezone.now()
    paying = Payment.objects.filter(
        registration=OuterRef('pk'),
        status=Payment.Status.PENDING,
        initiated_at__gte=now - REUSE_FOR,
    )
    due = (
        EventRegistration.objects
        .filter(
            status=Status.PENDING,
            payment_status__in=_UNPAID,
            event__is_free=False,
            amount_due__gt=0,
            created_at__lt=now - timedelta(hours=hours),
        )
        .filter(~Exists(paying))
        .values_list('pk', flat=True)
    )

    released = 0
    for pk in list(due):
        with transaction.atomic():
            registration = EventRegistration.objects.select_for_update().get(pk=pk)
            # Paid, or confirmed by a leader, since the list was read.
            if registration.status != Status.PENDING or registration.payment_status not in _UNPAID:
                continue
            registration.cancel(reason=UNPAID_REASON)
            RegistrationAuditLog.objects.create(
                registration=registration,
                action=RegistrationAuditLog.ActionType.CANCEL,
                old_values={'status': Status.PENDING},
                new_values={'status': Status.CANCELLED, 'reason': UNPAID_REASON},
            )
            transaction.on_commit(lambda r=registration: _announce_released(r))
        released += 1
    return released


def _announce_released(registration):
    from events import notifications as event_notifications

    try:
        event_notifications.notify_place_released(registration)
    except Exception:
        logger.exception('Could not tell %s their place was released',
                         registration.registration_id)
