"""
Paying by bank transfer, for an event set to manual payment.

The payer transfers to the account on the event, then uploads the receipt
against what it pays for: a coordinator's batch (`events/batches.py`) or one
registration. Someone holding `payments.reconcile` over that part of the
church checks it against the bank statement and verifies it for the amount
that actually arrived, or rejects it with a reason.

Verifying records the money as a successful `Payment`, the same row the
gateway writes, so there is one ledger to reconcile whichever way people
paid. A receipt says what someone claims; the `Payment` is what was checked.
"""
import hashlib
import logging
import os
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from django.utils.crypto import get_random_string

from events import batches
from events.models import EventRegistration, RegistrationBatch
from hierarchy.models import HierarchyNode
from identity.authorization import (
    authority, has_any_permission, has_permission, users_with_permission,
)
from identity.permissions_registry import Perm

from .models import Payment, PaymentReceipt

logger = logging.getLogger(__name__)

ReceiptStatus = PaymentReceipt.Status

# The only types a receipt is ever stored or served as. Decided from what the
# file turned out to be, never from what the uploader's browser said: a PDF
# that is really HTML, sent as text/html, would otherwise be served as a page.
SAFE_TYPES = {
    'PDF': 'application/pdf',
    'PNG': 'image/png',
    'JPEG': 'image/jpeg',
    'WEBP': 'image/webp',
}


class ReceiptError(Exception):
    """The request cannot be done. The message is for the person asking."""


# ── The file ─────────────────────────────────────────────────────────────────

def validate_file(upload):
    """
    Refuse anything that is not a photo or PDF of a sensible size. Checked by
    what the file is, not only what it is called. Returns its sha256 and the
    type it is to be served as.
    """
    if upload is None:
        raise ReceiptError('Attach a photo or PDF of the receipt.')
    limit = getattr(settings, 'MAX_RECEIPT_SIZE', 5 * 1024 * 1024)
    if upload.size > limit:
        raise ReceiptError(f'The file is larger than {limit // (1024 * 1024)} MB.')
    if upload.size == 0:
        raise ReceiptError('The file is empty.')
    ext = os.path.splitext(upload.name or '')[1].lower()
    allowed = getattr(settings, 'ALLOWED_RECEIPT_EXTENSIONS', ['.pdf', '.jpg', '.jpeg', '.png'])
    if ext not in allowed:
        raise ReceiptError('Use a JPG, PNG, WebP or PDF file.')

    upload.seek(0)
    head = upload.read(8)
    upload.seek(0)
    if ext == '.pdf':
        if not head.startswith(b'%PDF-'):
            raise ReceiptError('That file is not a PDF.')
        kind = 'PDF'
    else:
        from PIL import Image
        try:
            with Image.open(upload) as image:
                kind = (image.format or '').upper()
                image.verify()
        except Exception:
            raise ReceiptError('That file is not a picture we can open.')
        finally:
            upload.seek(0)
        if kind not in SAFE_TYPES:
            raise ReceiptError('Use a JPG, PNG, WebP or PDF file.')

    digest = hashlib.sha256()
    for chunk in upload.chunks():
        digest.update(chunk)
    upload.seek(0)
    return digest.hexdigest(), SAFE_TYPES[kind]


# ── Who may ──────────────────────────────────────────────────────────────────

def _root():
    return HierarchyNode.get_first_root_node()


def can_reconcile(user, node, code=Perm.PAYMENTS_RECONCILE):
    """
    May `user` verify money for `node`. A registration with no place in the
    tree belongs to whoever holds the permission over the whole of it.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if node is None:
        root = _root()
        return root is not None and has_permission(user, code, root)
    return has_permission(user, code, node)


def _covers(user, code):
    """The paths the user holds `code` at, and whether one is the whole tree."""
    prefixes = authority(user).paths_for(code)
    return prefixes, any(len(p) == HierarchyNode.steplen for p in prefixes)


def scope_receipts(queryset, user, code=Perm.PAYMENTS_RECONCILE):
    """The receipts in the part of the church where `user` holds `code`."""
    if user.is_superuser:
        return queryset
    prefixes, whole = _covers(user, code)
    if not prefixes:
        return queryset.none()
    match = Q()
    for prefix in prefixes:
        match |= Q(batch__node__path__startswith=prefix)
        match |= Q(registration__node__path__startswith=prefix)
    if whole:
        match |= Q(registration__isnull=False, registration__node__isnull=True)
    return queryset.filter(match)


def scope_payments(queryset, user, code=Perm.PAYMENTS_RECONCILE):
    """The same, for `Payment` rows of event registrations and batches."""
    if user.is_superuser:
        return queryset
    prefixes, whole = _covers(user, code)
    if not prefixes:
        return queryset.none()
    match = Q()
    for prefix in prefixes:
        match |= Q(batch__node__path__startswith=prefix)
        match |= Q(registration__node__path__startswith=prefix)
    if whole:
        match |= Q(registration__isnull=False, registration__node__isnull=True)
    return queryset.filter(match)


def scope_batches(queryset, user, code=Perm.PAYMENTS_RECONCILE):
    if user.is_superuser:
        return queryset
    prefixes, _ = _covers(user, code)
    if not prefixes:
        return queryset.none()
    match = Q()
    for prefix in prefixes:
        match |= Q(node__path__startswith=prefix)
    return queryset.filter(match)


def can_see(user, receipt):
    """The person who sent it, whoever runs that batch, and its reconcilers."""
    if receipt.submitted_by_id == user.pk:
        return True
    if receipt.batch_id and batches.can_manage(user, receipt.batch):
        return True
    return (
        can_reconcile(user, receipt.node)
        or can_reconcile(user, receipt.node, Perm.PAYMENTS_VIEW))


def _may_pay_for(user, target):
    if isinstance(target, RegistrationBatch):
        return batches.can_manage(user, target)
    if target.user_id == user.pk:
        return True
    if user.email and (target.attendee_email or '').lower() == user.email.lower():
        return True
    return has_any_permission(user, Perm.EVENTS_MANAGE)


# ── Sending one ──────────────────────────────────────────────────────────────

def _outstanding(target):
    if isinstance(target, RegistrationBatch):
        return target.balance
    paid = (
        Payment.objects.filter(registration=target, status=Payment.Status.SUCCESS)
        .aggregate(total=Sum('amount'))['total'] or Decimal('0'))
    return max(Decimal(target.amount_due or 0) - paid, Decimal('0'))


def submit_refusal(target):
    """Why a receipt cannot be sent for `target` now, or None."""
    event = target.event
    if event.is_free:
        return 'There is nothing to pay for this event.'
    if not event.pays_manually:
        return 'This event is paid for online, not by transfer.'
    if isinstance(target, RegistrationBatch):
        if target.status == RegistrationBatch.Status.CANCELLED:
            return 'This group was cancelled.'
        if target.status == RegistrationBatch.Status.PAID:
            return 'This group is already paid for.'
    else:
        if target.batch_id:
            return 'This seat is paid for with its group.'
        if target.payment_status == EventRegistration.PaymentStatus.PAID:
            return 'This registration is already paid for.'
        if target.status == EventRegistration.Status.CANCELLED:
            return 'This registration was cancelled.'
    if _outstanding(target) <= 0:
        return 'Nothing is outstanding.'
    return None


def submit(user, target, *, amount, paid_on, file, payer_name='', bank_reference=''):
    """Record a receipt for `target` and ask for it to be checked."""
    if not _may_pay_for(user, target):
        raise ReceiptError('You cannot send a receipt for this.')
    why = submit_refusal(target)
    if why:
        raise ReceiptError(why)
    amount = Decimal(amount)
    if amount <= 0:
        raise ReceiptError('Enter the amount you transferred.')
    if paid_on > timezone.localdate():
        raise ReceiptError('The date of the transfer cannot be in the future.')
    digest, content_type = validate_file(file)

    with transaction.atomic():
        receipt = PaymentReceipt.objects.create(
            batch=target if isinstance(target, RegistrationBatch) else None,
            registration=target if isinstance(target, EventRegistration) else None,
            submitted_by=user,
            amount_claimed=amount,
            paid_on=paid_on,
            payer_name=payer_name.strip()[:255],
            bank_reference=bank_reference.strip()[:100],
            file=file,
            file_name=os.path.basename(file.name or '')[:255],
            file_type=content_type,
            file_sha256=digest,
        )
        if receipt.batch_id:
            batches.refresh(receipt.batch)
    transaction.on_commit(lambda: _ask_for_review(receipt))
    return receipt


def duplicates(receipt):
    """Other receipts with the same file or the same bank reference."""
    match = Q(file_sha256=receipt.file_sha256)
    if receipt.bank_reference:
        match |= Q(bank_reference__iexact=receipt.bank_reference)
    return PaymentReceipt.objects.filter(match).exclude(pk=receipt.pk)


def reviewers(node):
    """Everyone who may check a receipt for `node`."""
    return [
        user for user in users_with_permission(Perm.PAYMENTS_RECONCILE)
        if user.email and can_reconcile(user, node)
    ]


def _ask_for_review(receipt):
    from events.email_service import EventEmailService
    try:
        recipients = [user.email for user in reviewers(receipt.node)]
        EventEmailService.send_receipt_submitted(receipt, recipients)
    except Exception:
        logger.exception('Could not ask for receipt %s to be checked', receipt.pk)


# ── Checking one ─────────────────────────────────────────────────────────────

def _reference():
    return f'MAN{timezone.now():%Y%m%d%H%M%S}{get_random_string(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")}'


def verify(reviewer, receipt, *, amount=None, note=''):
    """
    The money arrived: record `amount` (what the statement shows, the amount
    claimed by default) as a payment and bring what it pays for up to date.
    """
    if not can_reconcile(reviewer, receipt.node):
        raise ReceiptError('You cannot verify payments for this part of the church.')
    after = []
    with transaction.atomic():
        receipt = PaymentReceipt.objects.select_for_update().get(pk=receipt.pk)
        if receipt.status != ReceiptStatus.SUBMITTED:
            raise ReceiptError(f'This receipt has already been {receipt.get_status_display().lower()}.')
        amount = Decimal(receipt.amount_claimed if amount is None else amount)
        if amount <= 0:
            raise ReceiptError('Enter the amount that arrived.')

        target = receipt.target
        event = receipt.event
        submitter = receipt.submitted_by
        payment = Payment.objects.create(
            reference=_reference(),
            amount=amount,
            currency='NGN',
            status=Payment.Status.SUCCESS,
            payment_method=Payment.PaymentMethod.BANK,
            channel='manual_transfer',
            batch=receipt.batch,
            registration=receipt.registration,
            description=(
                f'{event.title}: transfer for '
                f'{target.reference if receipt.batch_id else target.registration_id}'),
            payer_email=(
                receipt.batch.reply_email if receipt.batch_id
                else (submitter.email if submitter else '')) or '',
            payer_name=receipt.payer_name or (submitter.get_full_name() if submitter else ''),
            completed_at=timezone.now(),
            metadata={
                'receipt_id': str(receipt.pk),
                'bank_reference': receipt.bank_reference,
                'paid_on': receipt.paid_on.isoformat(),
                'verified_by': str(reviewer.pk),
            },
        )
        receipt.status = ReceiptStatus.VERIFIED
        receipt.amount_verified = amount
        receipt.reviewed_by = reviewer
        receipt.reviewed_at = timezone.now()
        receipt.review_note = note.strip()
        receipt.payment = payment
        receipt.save()

        if receipt.batch_id:
            announce = batches.refresh(receipt.batch)
            batch = RegistrationBatch.objects.get(pk=receipt.batch_id)
            if announce:
                after.append(announce)
            elif batch.status == RegistrationBatch.Status.PART_PAID:
                after.append(lambda: _tell_coordinator(batch, 'part_paid', note))
        else:
            after.extend(_apply_to_registration(payment))

    for action in after:
        transaction.on_commit(action)
    return receipt


def _apply_to_registration(payment):
    from . import registrations
    registration = EventRegistration.objects.select_for_update().get(pk=payment.registration_id)
    paid = (
        Payment.objects.filter(registration=registration, status=Payment.Status.SUCCESS)
        .aggregate(total=Sum('amount'))['total'] or Decimal('0'))
    if paid >= Decimal(registration.amount_due or 0):
        announce = registrations.settle(payment)
        EventRegistration.objects.filter(pk=registration.pk).update(amount_paid=paid)
        return [announce] if announce else []
    registration.amount_paid = paid
    registration.save(update_fields=['amount_paid', 'updated_at'])
    return []


def reject(reviewer, receipt, *, reason):
    """The money did not arrive, or not as the receipt says. `reason` is shown to the payer."""
    if not can_reconcile(reviewer, receipt.node):
        raise ReceiptError('You cannot review payments for this part of the church.')
    reason = (reason or '').strip()
    if not reason:
        raise ReceiptError('Say why, so the payer knows what to fix.')
    with transaction.atomic():
        receipt = PaymentReceipt.objects.select_for_update().get(pk=receipt.pk)
        if receipt.status != ReceiptStatus.SUBMITTED:
            raise ReceiptError(f'This receipt has already been {receipt.get_status_display().lower()}.')
        receipt.status = ReceiptStatus.REJECTED
        receipt.reviewed_by = reviewer
        receipt.reviewed_at = timezone.now()
        receipt.review_note = reason
        receipt.save()
        if receipt.batch_id:
            batches.refresh(receipt.batch)
            batch = RegistrationBatch.objects.get(pk=receipt.batch_id)
            transaction.on_commit(lambda: _tell_coordinator(batch, 'rejected', reason))
    return receipt


def _tell_coordinator(batch, outcome, note=''):
    from events.email_service import EventEmailService
    try:
        EventEmailService.send_batch_update(batch, outcome, note)
    except Exception:
        logger.exception('Could not email the coordinator of %s', batch.reference)


# ── Reconciliation ───────────────────────────────────────────────────────────

def summary(event, user):
    """
    What the event expects and what has come in, in the part of the church
    the user reconciles. Amounts are Naira, as Decimals.
    """
    seats = EventRegistration.objects.filter(event=event).exclude(
        status__in=[EventRegistration.Status.CANCELLED, EventRegistration.Status.WAITLISTED])
    seats = _scope_registrations(seats, user)
    expected = seats.aggregate(total=Sum('amount_due'))['total'] or Decimal('0')

    payments = scope_payments(
        Payment.objects.filter(
            Q(batch__event=event) | Q(registration__event=event),
            status=Payment.Status.SUCCESS),
        user, _code_for(user))
    manual = payments.filter(channel='manual_transfer').aggregate(t=Sum('amount'))['t'] or Decimal('0')
    online = payments.exclude(channel='manual_transfer').aggregate(t=Sum('amount'))['t'] or Decimal('0')

    waiting = scope_receipts(
        PaymentReceipt.objects.filter(
            Q(batch__event=event) | Q(registration__event=event),
            status=ReceiptStatus.SUBMITTED),
        user, _code_for(user))
    return {
        'expected': expected,
        'received_online': online,
        'received_manual': manual,
        'received': online + manual,
        'under_review': waiting.aggregate(t=Sum('amount_claimed'))['t'] or Decimal('0'),
        'receipts_waiting': waiting.count(),
        'outstanding': max(expected - online - manual, Decimal('0')),
    }


def can_reconcile_anywhere(user):
    return has_any_permission(user, Perm.PAYMENTS_RECONCILE)


def _code_for(user):
    """Reconcilers see their reconcile scope; viewers their view scope."""
    return Perm.PAYMENTS_RECONCILE if can_reconcile_anywhere(user) else Perm.PAYMENTS_VIEW


def _scope_registrations(queryset, user):
    if user.is_superuser:
        return queryset
    prefixes, whole = _covers(user, _code_for(user))
    if not prefixes:
        return queryset.none()
    match = Q()
    for prefix in prefixes:
        match |= Q(node__path__startswith=prefix)
    if whole:
        match |= Q(node__isnull=True)
    return queryset.filter(match)
