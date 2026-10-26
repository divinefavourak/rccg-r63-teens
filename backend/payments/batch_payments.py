"""
Paying for a coordinator's group through the gateway, on an online-payment
event. The same rules as one registration (`registrations.py`): one checkout
at a time, the amount fixed by us, and only the gateway's word marks money
received. The group is paid when its payments add up to what it owes
(`events.batches.refresh`).
"""
import logging

from django.db import transaction
from django.utils import timezone

from events.models import RegistrationBatch

from .models import Payment
from .registrations import (
    PREPARING_FOR, REUSE_FOR, BeingPrepared, NotPayable, Unavailable, check,
)
from .services import PaymentService

logger = logging.getLogger(__name__)


def refusal(batch):
    """Why this group cannot be paid for online now, or None."""
    event = batch.event
    if event.is_free:
        return 'There is nothing to pay for this event.'
    if event.pays_manually:
        return 'This event is paid for by bank transfer. Upload the receipt instead.'
    if batch.status == RegistrationBatch.Status.CANCELLED:
        return 'This group was cancelled.'
    if batch.status == RegistrationBatch.Status.PAID or batch.balance <= 0:
        return 'This group is already paid for.'
    if event.is_past:
        return 'This event has ended.'
    return None


def start(batch, callback_url='', return_url='', return_to=''):
    """
    The gateway's checkout for what the group still owes. Returns the
    `Payment`, whose `authorization_url` is the page to send the coordinator
    to.

    The gateway sends them back to `callback_url` (the web Console), or, with
    `return_url`, to our own page there with the payment's reference on the
    end. That page offers `return_to`, the phone app's address for the group.
    """
    try:
        service = PaymentService()
    except ValueError:
        raise Unavailable('Paying online is not set up yet. Please try again later.')

    with transaction.atomic():
        batch = RegistrationBatch.objects.select_for_update(of=('self',)).select_related(
            'event', 'created_by').get(pk=batch.pk)
        why = refusal(batch)
        if why:
            raise NotPayable(why)

        now = timezone.now()
        latest = (
            Payment.objects
            .filter(batch=batch, status=Payment.Status.PENDING, amount=batch.balance,
                    initiated_at__gte=now - REUSE_FOR)
            .order_by('-initiated_at').first())
        if latest is not None:
            if latest.authorization_url:
                return latest
            if latest.initiated_at >= now - PREPARING_FOR:
                raise BeingPrepared()

        coordinator = batch.created_by
        payment = Payment.objects.create(
            reference=service.squad.generate_reference(),
            amount=batch.balance,
            currency='NGN',
            batch=batch,
            description=f'{batch.event.title}: group {batch.reference} ({batch.headcount} seats)',
            payer_email=batch.reply_email,
            payer_name=coordinator.get_full_name() if coordinator else '',
            payer_phone=batch.contact_phone,
            metadata={'batch_id': str(batch.pk), 'batch_reference': batch.reference,
                      'event_id': str(batch.event_id), 'return_to': return_to},
        )
    if return_url:
        callback_url = f'{return_url}{payment.reference}/'

    try:
        payment.authorization_url = service.squad.open_checkout(
            reference=payment.reference,
            amount=payment.amount,
            email=payment.payer_email,
            name=payment.payer_name or batch.reference,
            callback_url=callback_url,
            metadata={'payment_id': str(payment.pk), 'batch_id': str(batch.pk),
                      'batch_reference': batch.reference, 'event': batch.event.title},
        )
    except Exception as exc:
        logger.exception('Could not open a checkout for %s', batch.reference)
        payment.mark_as_failed({'error': str(exc)})
        raise Unavailable('We could not reach the payment gateway. Please try again in a moment.')

    payment.save(update_fields=['authorization_url', 'updated_at'])
    return payment


def check_batch(batch):
    """Ask the gateway about the group's open checkouts. True if one went through."""
    open_payments = (
        Payment.objects
        .filter(batch=batch, status=Payment.Status.PENDING)
        .exclude(authorization_url='')
        .order_by('-initiated_at')[:3])
    return any(check(payment) for payment in open_payments)
