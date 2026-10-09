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
from django.db.models import Count
from .models import Payment, TransactionLog
from tickets.models import Ticket

logger = logging.getLogger(__name__)


class PaymentAmountMismatch(Exception):
    """Paystack reported a successful charge for a different amount than was due."""


class PaystackService:
    """Service to handle Paystack payments"""

    # Seconds to wait for Paystack. Without one, a request that Paystack never
    # answers holds a worker until the platform kills it.
    TIMEOUT = 15
    
    def __init__(self):
        self.secret_key = getattr(settings, 'PAYSTACK_SECRET_KEY', '')
        self.public_key = getattr(settings, 'PAYSTACK_PUBLIC_KEY', '')
        self.base_url = 'https://api.paystack.co'
        
        if not self.secret_key or not self.public_key:
            raise ValueError("Paystack keys not configured in settings")
    
    def get_headers(self):
        """Get request headers with authorization"""
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type': 'application/json',
        }
    
    def initialize_payment(self, payment_data):
        """
        Initialize a payment with Paystack
        """
        url = f"{self.base_url}/transaction/initialize"
        
        # Convert amount to kobo if not already
        if 'amount' in payment_data and isinstance(payment_data['amount'], Decimal):
            payment_data['amount'] = int(payment_data['amount'] * 100)
        
        response = requests.post(
            url,
            headers=self.get_headers(),
            json=payment_data,
            timeout=self.TIMEOUT
        )
        
        # Log transaction
        TransactionLog.objects.create(
            transaction_type=TransactionLog.TransactionType.INITIATE,
            request_data=payment_data,
            response_data=response.json() if response.content else None,
            is_successful=response.status_code == 200,
            error_message=response.text if response.status_code != 200 else ''
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Paystack API error: {response.status_code} - {response.text}")
    
    def verify_payment(self, reference):
        """
        Verify a payment with Paystack
        """
        url = f"{self.base_url}/transaction/verify/{reference}"
        
        response = requests.get(url, headers=self.get_headers(), timeout=self.TIMEOUT)
        
        # Log transaction
        TransactionLog.objects.create(
            transaction_type=TransactionLog.TransactionType.VERIFY,
            request_data={'reference': reference},
            response_data=response.json() if response.content else None,
            is_successful=response.status_code == 200,
            error_message=response.text if response.status_code != 200 else ''
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Paystack API error: {response.status_code} - {response.text}")
    
    def create_payment_link(self, payment_data):
        """
        Create a payment link for sharing
        """
        url = f"{self.base_url}/transaction/initialize"
        
        response = requests.post(
            url,
            headers=self.get_headers(),
            json=payment_data,
            timeout=self.TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status'):
                return {
                    'authorization_url': data['data']['authorization_url'],
                    'access_code': data['data']['access_code'],
                    'reference': data['data']['reference']
                }
        
        raise Exception(f"Failed to create payment link: {response.text}")
    
    def refund_payment(self, transaction_reference, amount=None, currency='NGN'):
        """
        Refund a payment
        
        Args:
            transaction_reference: Paystack transaction reference
            amount: Amount to refund (in kobo). None for full refund.
            currency: Currency code
        """
        url = f"{self.base_url}/refund"
        
        refund_data = {
            'transaction': transaction_reference,
            'currency': currency
        }
        
        if amount:
            refund_data['amount'] = amount
        
        response = requests.post(
            url,
            headers=self.get_headers(),
            json=refund_data,
            timeout=self.TIMEOUT
        )
        
        # Log transaction
        TransactionLog.objects.create(
            transaction_type=TransactionLog.TransactionType.REFUND,
            request_data=refund_data,
            response_data=response.json() if response.content else None,
            is_successful=response.status_code == 200,
            error_message=response.text if response.status_code != 200 else ''
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Paystack refund error: {response.status_code} - {response.text}")
    
    def list_transactions(self, per_page=50, page=1):
        """List transactions from Paystack"""
        url = f"{self.base_url}/transaction"
        params = {
            'perPage': per_page,
            'page': page
        }
        
        response = requests.get(
            url, headers=self.get_headers(), params=params, timeout=self.TIMEOUT)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Paystack API error: {response.status_code} - {response.text}")
    
    def generate_reference(self, prefix='RCCG'):
        """Generate unique reference for payment"""
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        return f"{prefix}_{timestamp}_{unique_id}"


class PaymentService:
    """High-level payment service"""
    
    def __init__(self):
        self.paystack = PaystackService()
    
    def create_payment(self, ticket, user, request=None):
        """
        Create a payment record and initialize Paystack payment for a SINGLE ticket
        """
        # Generate reference
        reference = self.paystack.generate_reference()
        
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
        
        # Initialize Paystack payment
        callback_url = f"{settings.FRONTEND_URL}/payment/callback" if hasattr(settings, 'FRONTEND_URL') else ''
        
        paystack_data = {
            'email': user.email,
            'amount': int(amount * 100),  # Convert to kobo
            'reference': reference,
            'callback_url': callback_url,
            'metadata': {
                'payment_id': str(payment.id),
                'ticket_id': str(ticket.id),
                'custom_fields': [
                    {
                        'display_name': "Ticket Holder",
                        'variable_name': "ticket_holder",
                        'value': ticket.full_name
                    },
                    {
                        'display_name': "Ticket ID",
                        'variable_name': "ticket_id",
                        'value': ticket.ticket_id
                    }
                ]
            }
        }
        
        try:
            paystack_response = self.paystack.initialize_payment(paystack_data)
            
            if paystack_response.get('status'):
                # Update payment with Paystack reference
                payment.paystack_reference = paystack_response['data']['reference']
                payment.save()
                
                return payment, paystack_response
            else:
                raise Exception(f"Paystack error: {paystack_response.get('message', 'Unknown error')}")
                
        except Exception as e:
            # Mark payment as failed
            payment.mark_as_failed({'error': str(e)})
            raise

    def create_bulk_payment(self, tickets, user, request=None):
        """
        Create a single payment for MULTIPLE tickets (Bulk Registration)
        """
        reference = self.paystack.generate_reference()
        
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
        
        # Initialize Paystack
        callback_url = f"{settings.FRONTEND_URL}/payment/callback" if hasattr(settings, 'FRONTEND_URL') else ''
        
        paystack_data = {
            'email': user.email,
            'amount': int(total_amount * 100),
            'reference': reference,
            'callback_url': callback_url,
            'metadata': {
                'payment_id': str(payment.id),
                'is_bulk': True,
                'ticket_count': len(tickets),
                'custom_fields': [
                    {
                        'display_name': "Payment Type",
                        'variable_name': "payment_type",
                        'value': "Bulk Registration"
                    },
                    {
                        'display_name': "Quantity",
                        'variable_name': "quantity",
                        'value': len(tickets)
                    }
                ]
            }
        }
        
        try:
            paystack_response = self.paystack.initialize_payment(paystack_data)
            if paystack_response.get('status'):
                payment.paystack_reference = paystack_response['data']['reference']
                payment.save()
                return payment, paystack_response
            else:
                raise Exception(f"Paystack error: {paystack_response.get('message', 'Unknown error')}")
        except Exception as e:
            payment.mark_as_failed({'error': str(e)})
            raise

    def verify_and_complete_payment(self, reference, request=None):
        """
        Verify payment with Paystack and complete the process (Handles both Single and Bulk)
        """
        if not Payment.objects.filter(reference=reference).exists():
            raise Exception(f"Payment not found: {reference}")

        # Ask Paystack before taking the row lock: a slow answer from them must
        # not hold a database row.
        verification = self.paystack.verify_payment(reference)

        if not verification.get('status'):
            raise Exception(f"Verification failed: {verification.get('message')}")

        data = verification['data']

        if data['status'] == 'success':
            payment, _ = self._complete(reference, data)
            return payment

        # Payment failed or abandoned. Only a pending payment may be failed:
        # a late "abandoned" answer must not undo one the webhook completed.
        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(reference=reference)
            if payment.status == Payment.Status.PENDING:
                payment.mark_as_failed(data)
        raise Exception(f"Payment not successful: {data['status']}")

    def verify_webhook_signature(self, raw_body, signature):
        """
        True when `signature` is Paystack's HMAC-SHA512 of the raw request body,
        keyed with our secret key. The webhook is unauthenticated, so this is the
        only thing that says the event came from Paystack.
        """
        if not signature:
            return False
        expected = hmac.new(
            self.paystack.secret_key.encode('utf-8'), raw_body, hashlib.sha512,
        ).hexdigest()
        # As bytes: compare_digest raises on a str with non-ASCII characters,
        # and anyone can send this endpoint any header they like.
        return hmac.compare_digest(
            expected.encode('ascii'), signature.encode('utf-8', 'replace'))

    def handle_webhook(self, raw_body, signature):
        """
        Handle Paystack webhook. `raw_body` is the request body as bytes, exactly
        as received: the signature is over those bytes, not over re-serialised
        JSON.

        Raises PermissionDenied on a bad signature. Returns True when the event
        completed a payment, False when there was nothing to do.
        """
        if not self.verify_webhook_signature(raw_body, signature):
            raise PermissionDenied('Invalid Paystack signature.')

        try:
            payload = json.loads(raw_body)
        except ValueError:
            return False
        if not isinstance(payload, dict):
            return False

        event = payload.get('event')
        data = payload.get('data') or {}

        # Log webhook. No ip_address: the column is an inet, and the 'webhook'
        # placeholder that stood here is not one, so Postgres refused the row.
        TransactionLog.objects.create(
            transaction_type=TransactionLog.TransactionType.WEBHOOK,
            request_data=payload,
            is_successful=True,
            user_agent='paystack_webhook'
        )

        if event != 'charge.success':
            return False

        reference = data.get('reference')
        if not reference:
            return False

        try:
            _, completed = self._complete(reference, data)
        except Payment.DoesNotExist:
            return False
        except PaymentAmountMismatch:
            # Already logged. Paystack retrying will not change the amount.
            return False
        return completed

    def _complete(self, reference, data):
        """
        Mark a payment successful and approve what it paid for, exactly once.

        Client verify and the webhook both land here, often within the same
        second, and Paystack retries webhooks. The row lock makes "is it already
        successful?" a question with one answer, so the second caller approves
        nothing and sends no second email.

        Returns `(payment, completed)`; `completed` is False when there was
        nothing left to do.
        """
        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(reference=reference)

            if payment.status == Payment.Status.SUCCESS:
                return payment, False

            if payment.status in (Payment.Status.REFUNDED, Payment.Status.CANCELLED):
                # A replayed charge.success must not revive a refunded payment.
                logger.warning(
                    'Ignoring success for %s payment %s', payment.status, reference)
                return payment, False

            # Paystack reports the amount in kobo. A success for a different
            # amount than was asked is not a payment for this ticket.
            expected = int(payment.amount * 100)
            paid = data.get('amount')
            if paid != expected:
                logger.error(
                    'Payment %s: Paystack reports %r kobo, expected %s',
                    reference, paid, expected)
                raise PaymentAmountMismatch(
                    'Amount paid does not match the amount due.')

            payment.mark_as_successful(data)

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