import requests
import json
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
import uuid
from .models import Payment, TransactionLog
from tickets.models import Ticket


class PaystackService:
    """Service to handle Paystack payments"""
    
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
            json=payment_data
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
        
        response = requests.get(url, headers=self.get_headers())
        
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
            json=payment_data
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
            json=refund_data
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
        
        response = requests.get(url, headers=self.get_headers(), params=params)
        
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
        try:
            # Get payment
            payment = Payment.objects.get(reference=reference)
            
            # Verify with Paystack
            verification = self.paystack.verify_payment(reference)
            
            if verification.get('status'):
                data = verification['data']
                
                if data['status'] == 'success':
                    # Mark payment as successful
                    payment.mark_as_successful(data)
                    
                    # --- LOGIC FOR SINGLE TICKET ---
                    if payment.ticket:
                        payment.ticket.approve(payment.ticket.registered_by)
                    
                    # --- LOGIC FOR BULK TICKETS ---
                    elif payment.metadata and payment.metadata.get('is_bulk'):
                        ticket_ids = payment.metadata.get('ticket_ids', [])
                        if ticket_ids:
                            # Bulk approve all linked tickets
                            # We use system auto-approval (None) or the payment user
                            # Using update() for efficiency
                            Ticket.objects.filter(id__in=ticket_ids).update(
                                status=Ticket.Status.APPROVED,
                                approved_at=timezone.now(),
                                approved_by=None 
                            )
                    
                    return payment
                else:
                    # Payment failed or abandoned
                    payment.mark_as_failed(data)
                    raise Exception(f"Payment not successful: {data['status']}")
            else:
                raise Exception(f"Verification failed: {verification.get('message')}")
                
        except Payment.DoesNotExist:
            raise Exception(f"Payment not found: {reference}")
        except Exception as e:
            raise
    
    def handle_webhook(self, payload, signature):
        """
        Handle Paystack webhook
        """
        event = payload.get('event')
        data = payload.get('data', {})
        
        # Log webhook
        TransactionLog.objects.create(
            transaction_type=TransactionLog.TransactionType.WEBHOOK,
            request_data=payload,
            is_successful=True,
            ip_address='webhook',
            user_agent='paystack_webhook'
        )
        
        if event == 'charge.success':
            reference = data.get('reference')
            if reference:
                try:
                    payment = Payment.objects.get(reference=reference)
                    payment.mark_as_successful(data)
                    
                    # Handle ticket approval same as verify
                    if payment.ticket:
                        payment.ticket.approve(payment.ticket.registered_by)
                    elif payment.metadata and payment.metadata.get('is_bulk'):
                        ticket_ids = payment.metadata.get('ticket_ids', [])
                        if ticket_ids:
                            Ticket.objects.filter(id__in=ticket_ids).update(
                                status=Ticket.Status.APPROVED,
                                approved_at=timezone.now()
                            )
                    return True
                except Payment.DoesNotExist:
                    pass
        
        return False
    
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