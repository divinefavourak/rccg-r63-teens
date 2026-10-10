import hashlib
import hmac
import json
import logging

import requests
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import uuid
from .models import Payment, TransactionLog
from tickets.models import Ticket

logger = logging.getLogger(__name__)


class PaymentAmountMismatch(Exception):
    """Squad reported a successful charge for a different amount than was due."""


class SquadError(Exception):
    """Squad refused a request, or answered with something that is not an answer."""


def _kobo(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _charge(body):
    """
    Squad's account of one transaction, in the names the rest of this app uses.

    The webhook and the verify call describe the same transaction with
    different keys (`amount` and `gateway_ref` in one, `transaction_amount` and
    `gateway_transaction_ref` in the other), and both capitalise the status.
    `raw` is what Squad sent, kept for the record.
    """
    return {
        'reference': body.get('transaction_ref'),
        # success, failed, abandoned or pending
        'status': str(body.get('transaction_status') or '').lower(),
        # In kobo
        'amount': _kobo(body.get('transaction_amount', body.get('amount'))),
        'gateway_reference': (
            body.get('gateway_transaction_ref') or body.get('gateway_ref') or None),
        'channel': str(body.get('transaction_type') or '').lower(),
        'raw': body,
    }


class SquadService:
    """Service to handle Squad payments (https://docs.squadco.com)"""

    # Seconds to wait for Squad. Without one, a request that Squad never
    # answers holds a worker until the platform kills it.
    TIMEOUT = 15

    LIVE_URL = 'https://api-d.squadco.com'
    SANDBOX_URL = 'https://sandbox-api-d.squadco.com'

    def __init__(self):
        self.secret_key = getattr(settings, 'SQUAD_SECRET_KEY', '') or ''

        if not self.secret_key:
            raise ValueError("Squad secret key not configured in settings")

        # A sandbox key only works against the sandbox and a live key only
        # against live, so the key says which one to call.
        sandbox = self.secret_key.startswith('sandbox_')
        self.base_url = self.SANDBOX_URL if sandbox else self.LIVE_URL

    def get_headers(self):
        """Get request headers with authorization"""
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type': 'application/json',
        }

    def _call(self, method, path, transaction_type, payload=None):
        """
        One request to Squad, logged. Returns the `data` of a successful
        answer and raises SquadError for anything else.
        """
        response = requests.request(
            method,
            f"{self.base_url}{path}",
            headers=self.get_headers(),
            json=payload,
            timeout=self.TIMEOUT
        )
        try:
            answer = response.json()
        except ValueError:
            answer = None
        data = answer.get('data') if isinstance(answer, dict) else None
        ok = response.status_code == 200 and isinstance(data, dict)

        # Log transaction
        TransactionLog.objects.create(
            transaction_type=transaction_type,
            request_data=payload if payload is not None else {'path': path},
            response_data=answer,
            is_successful=ok,
            error_message='' if ok else response.text[:2000]
        )

        if not ok:
            # The address, never the key: a key for the wrong environment is
            # the usual reason for a refusal, and this says which one was asked.
            raise SquadError(
                f"Squad API error from {self.base_url}{path}: "
                f"{response.status_code} - {response.text[:500]}")
        return data

    def open_checkout(self, reference, amount, email, name, callback_url, metadata=None):
        """
        Start a transaction and return the address of Squad's payment page for
        it. `amount` is in Naira.

        `pass_charge` is off: Squad's fee comes out of what the church
        receives, and the payer is charged `amount` and nothing more.
        """
        data = self._call('POST', '/transaction/initiate', TransactionLog.TransactionType.INITIATE, {
            'amount': int(Decimal(amount) * 100),  # kobo
            'email': email,
            'currency': 'NGN',
            'initiate_type': 'inline',
            'transaction_ref': reference,
            'customer_name': name,
            'callback_url': callback_url,
            'pass_charge': False,
            'metadata': metadata or {},
        })
        checkout_url = data.get('checkout_url')
        if not checkout_url:
            raise SquadError('Squad opened no payment page.')
        return checkout_url

    def verify_payment(self, reference):
        """Ask Squad what became of a transaction. Returns a charge (see `_charge`)."""
        data = self._call(
            'GET', f'/transaction/verify/{reference}', TransactionLog.TransactionType.VERIFY)
        return _charge(data)

    def refund_payment(self, payment, reason, amount=None):
        """
        Refund a successful payment.

        Args:
            payment: the Payment, which must hold Squad's `gateway_reference`
            reason: why, as Squad will record it
            amount: Amount to refund (in kobo). None for full refund.
        """
        refund_data = {
            'gateway_transaction_ref': payment.gateway_reference,
            'transaction_ref': payment.reference,
            'refund_type': 'Partial' if amount else 'Full',
            'reason_for_refund': reason,
        }

        if amount:
            refund_data['refund_amount'] = str(amount)

        return self._call(
            'POST', '/transaction/refund', TransactionLog.TransactionType.REFUND, refund_data)

    def generate_reference(self, prefix='RCCG'):
        """Generate unique reference for payment"""
        # Letters and digits only: it travels in the address Squad sends the
        # payer back to.
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        unique_id = uuid.uuid4().hex[:8].upper()
        return f"{prefix}{timestamp}{unique_id}"


class PaymentService:
    """High-level payment service"""

    def __init__(self):
        self.squad = SquadService()

    def create_payment(self, ticket, user, request=None):
        """
        Create a payment record and open Squad's checkout for a SINGLE ticket.
        Returns the payment and the address of the payment page.
        """
        # Generate reference
        reference = self.squad.generate_reference()

        # Calculate amount (₦3,000)
        amount = Decimal('3000.00')

        # Create payment record
        payment = Payment.objects.create(
            reference=reference,
            amount=amount,
            currency='NGN',
            ticket=ticket,
            description=f"Payment for ticket: {ticket.ticket_id}",
            payer_email=user.email,
            payer_name=user.full_name,
            payer_phone=user.phone,
            metadata={
                'ticket_id': str(ticket.id),
                'ticket_reference': ticket.ticket_id,
                'user_id': str(user.id),
                'full_name': ticket.full_name,
            },
            ip_address=self._get_client_ip(request) if request else None,
            user_agent=self._get_user_agent(request) if request else None
        )

        return payment, self._open(payment, user, {
            'payment_id': str(payment.id),
            'ticket_id': str(ticket.id),
            'ticket_holder': ticket.full_name,
            'ticket_reference': ticket.ticket_id,
        })

    def create_bulk_payment(self, tickets, user, request=None):
        """
        Create a single payment for MULTIPLE tickets (Bulk Registration).
        Returns the payment and the address of the payment page.
        """
        reference = self.squad.generate_reference()

        # Calculate total amount (₦3,000 per ticket)
        unit_price = Decimal('3000.00')
        total_amount = unit_price * len(tickets)

        # Create descriptions and metadata
        ticket_refs = [t.ticket_id for t in tickets]
        ticket_ids = [str(t.id) for t in tickets]
        desc = f"Bulk Payment for {len(tickets)} tickets."

        # Create payment record (ticket is NULL for bulk, metadata holds the links)
        payment = Payment.objects.create(
            reference=reference,
            amount=total_amount,
            currency='NGN',
            ticket=None,
            description=desc,
            payer_email=user.email,
            payer_name=user.full_name,
            payer_phone=user.phone,
            metadata={
                'is_bulk': True,
                'ticket_ids': ticket_ids,
                'ticket_refs': ticket_refs,
                'user_id': str(user.id),
                'count': len(tickets)
            },
            ip_address=self._get_client_ip(request) if request else None,
            user_agent=self._get_user_agent(request) if request else None
        )

        return payment, self._open(payment, user, {
            'payment_id': str(payment.id),
            'is_bulk': True,
            'ticket_count': len(tickets),
        })

    def _open(self, payment, user, metadata):
        """Open Squad's checkout for a ticket payment and return its address."""
        callback_url = f"{settings.FRONTEND_URL}/payment/callback" if getattr(settings, 'FRONTEND_URL', None) else ''

        try:
            payment.authorization_url = self.squad.open_checkout(
                reference=payment.reference,
                amount=payment.amount,
                email=user.email,
                name=user.full_name,
                callback_url=callback_url,
                metadata=metadata,
            )
        except Exception as e:
            # Mark payment as failed
            payment.mark_as_failed({'error': str(e)})
            raise
        payment.save(update_fields=['authorization_url', 'updated_at'])
        return payment.authorization_url

    def verify_and_complete_payment(self, reference, request=None):
        """
        Verify payment with Squad and complete the process (Handles both Single and Bulk)
        """
        if not Payment.objects.filter(reference=reference).exists():
            raise Exception(f"Payment not found: {reference}")

        # Ask Squad before taking the row lock: a slow answer from them must
        # not hold a database row.
        charge = self.squad.verify_payment(reference)

        if charge['status'] == 'success':
            payment, _ = self._complete(reference, charge)
            return payment

        # Only a failed payment is failed, and only while it is pending: a late
        # answer must not undo one the webhook completed. "Abandoned" and
        # "pending" are also what Squad says while a transfer is on its way.
        if charge['status'] == 'failed':
            with transaction.atomic():
                payment = Payment.objects.select_for_update().get(reference=reference)
                if payment.status == Payment.Status.PENDING:
                    payment.mark_as_failed(charge['raw'])
        raise Exception(f"Payment not successful: {charge['status']}")

    def verify_webhook_signature(self, raw_body, signature):
        """
        True when `signature` is Squad's HMAC-SHA512 of the raw request body,
        keyed with our secret key. The webhook is unauthenticated, so this is the
        only thing that says the event came from Squad.
        """
        if not signature:
            return False
        expected = hmac.new(
            self.squad.secret_key.encode('utf-8'), raw_body, hashlib.sha512,
        ).hexdigest().upper()
        # Squad sends the digest in capitals. As bytes: compare_digest raises
        # on a str with non-ASCII characters, and anyone can send this endpoint
        # any header they like.
        return hmac.compare_digest(
            expected.encode('ascii'), signature.strip().upper().encode('utf-8', 'replace'))

    def handle_webhook(self, raw_body, signature):
        """
        Handle Squad webhook. `raw_body` is the request body as bytes, exactly
        as received: the signature is over those bytes, not over re-serialised
        JSON.

        Raises PermissionDenied on a bad signature. Returns True when the event
        completed a payment, False when there was nothing to do.
        """
        if not self.verify_webhook_signature(raw_body, signature):
            raise PermissionDenied('Invalid Squad signature.')

        try:
            payload = json.loads(raw_body)
        except ValueError:
            return False
        if not isinstance(payload, dict):
            return False

        event = payload.get('Event')
        body = payload.get('Body')
        if not isinstance(body, dict):
            body = {}

        # Log webhook. No ip_address: the column is an inet, and the 'webhook'
        # placeholder that stood here is not one, so Postgres refused the row.
        TransactionLog.objects.create(
            transaction_type=TransactionLog.TransactionType.WEBHOOK,
            request_data=payload,
            is_successful=True,
            user_agent='squad_webhook'
        )

        charge = _charge(body)
        if event != 'charge_successful' or charge['status'] != 'success':
            return False

        reference = charge['reference'] or payload.get('TransactionRef')
        if not reference:
            return False

        try:
            _, completed = self._complete(reference, charge)
        except Payment.DoesNotExist:
            return False
        except PaymentAmountMismatch:
            # Already logged. Squad sending it again will not change the amount.
            return False
        return completed

    def _complete(self, reference, charge):
        """
        Mark a payment successful and approve what it paid for, exactly once.

        Client verify and the webhook both land here, often within the same
        second, and a webhook can arrive twice. The row lock makes "is it
        already successful?" a question with one answer, so the second caller
        approves nothing and sends no second email.

        Returns `(payment, completed)`; `completed` is False when there was
        nothing left to do.
        """
        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(reference=reference)

            if payment.status == Payment.Status.SUCCESS:
                return payment, False

            if payment.status in (Payment.Status.REFUNDED, Payment.Status.CANCELLED):
                # A replayed success must not revive a refunded payment.
                logger.warning(
                    'Ignoring success for %s payment %s', payment.status, reference)
                return payment, False

            # Squad reports the amount in kobo. A success for a different
            # amount than was asked is not a payment for this ticket.
            expected = int(payment.amount * 100)
            paid = charge.get('amount')
            if paid != expected:
                logger.error(
                    'Payment %s: Squad reports %r kobo, expected %s',
                    reference, paid, expected)
                raise PaymentAmountMismatch(
                    'Amount paid does not match the amount due.')

            payment.mark_as_successful(charge)

            # --- AN EVENT REGISTRATION ---
            # Its own rules, notification and email: see `registrations.py`.
            if payment.registration_id:
                from . import registrations
                after_commit = registrations.settle(payment)
                if after_commit:
                    transaction.on_commit(after_commit)
                return payment, True

            # --- LOGIC FOR SINGLE TICKET ---
            if payment.ticket:
                payment.ticket.approve(payment.ticket.registered_by)

            # --- LOGIC FOR BULK TICKETS ---
            elif payment.metadata and payment.metadata.get('is_bulk'):
                ticket_ids = payment.metadata.get('ticket_ids', [])
                if ticket_ids:
                    # Bulk approve all linked tickets (system auto-approval)
                    Ticket.objects.filter(id__in=ticket_ids).update(
                        status=Ticket.Status.APPROVED,
                        approved_at=timezone.now(),
                        approved_by=None
                    )

            # Only once the payment is safely stored, and never under the lock.
            transaction.on_commit(lambda: self._send_confirmation(payment))
            return payment, True

    @staticmethod
    def _send_confirmation(payment):
        """Send the confirmation email. A failure here must not fail the payment."""
        try:
            from tickets.services import EmailService
            EmailService.send_payment_confirmation(payment)
        except Exception:
            logger.exception(
                'Failed to send payment confirmation email for %s', payment.reference)

    def _get_client_ip(self, request):
        """Extract client IP from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def _get_user_agent(self, request):
        """Extract user agent from request"""
        return request.META.get('HTTP_USER_AGENT', '')
