from rest_framework import viewsets, generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from django.utils import timezone
from decimal import Decimal

from django.db.models import Count, Sum, Q
from django.db.models.functions import Coalesce
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from urllib.parse import urlsplit

from . import registrations as registration_payments
from .models import Payment, PaymentPlan, TransactionLog
from .serializers import (
    PaymentSerializer, PaymentPlanSerializer,
    InitializePaymentSerializer
)
from .services import PaymentService
from tickets.models import Ticket
from identity.authorization import HasPermission, has_any_permission
from identity.permissions_registry import Perm
from events.models import EventRegistration
from events.serializers import EventRegistrationDetailSerializer
from events.views import own_registrations


class PaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for Payment management"""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if not user.is_authenticated:
            return Payment.objects.none()
        
        queryset = Payment.objects.all()
        
        # Apply filters
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Date filters
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(initiated_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(initiated_at__lte=end_date)
        
        # Payment viewers/managers see all; everyone else sees only their own.
        # (Node-scoped payment visibility follows the events/registration node work.)
        if not has_any_permission(user, Perm.PAYMENTS_VIEW):
            queryset = queryset.filter(payer_email=user.email)
        
        return queryset.order_by('-initiated_at')
    
    @action(detail=False, methods=['post'])
    def initialize(self, request):
        """Initialize a new payment (Supports Single and Bulk)"""
        serializer = InitializePaymentSerializer(data=request.data)
        if serializer.is_valid():
            try:
                payment_service = PaymentService()
                
                # --- CASE 1: BULK PAYMENT ---
                if serializer.validated_data.get('ticket_ids'):
                    ticket_ids = serializer.validated_data['ticket_ids']
                    tickets = Ticket.objects.filter(id__in=ticket_ids)
                    
                    if len(tickets) != len(ticket_ids):
                        return Response(
                            {'error': 'One or more tickets not found'},
                            status=status.HTTP_404_NOT_FOUND
                        )
                        
                    # Check if any are already approved/paid
                    if any(t.status == Ticket.Status.APPROVED for t in tickets):
                         return Response(
                             {'error': 'One or more tickets are already approved/paid'}, 
                             status=status.HTTP_400_BAD_REQUEST
                         )

                    payment, checkout_url = payment_service.create_bulk_payment(
                        tickets=tickets,
                        user=request.user,
                        request=request
                    )
                
                # --- CASE 2: SINGLE PAYMENT ---
                else:
                    ticket_id = serializer.validated_data['ticket_id']
                    try:
                        ticket = Ticket.objects.get(id=ticket_id)
                    except Ticket.DoesNotExist:
                        return Response(
                            {'error': 'Ticket not found'}, 
                            status=status.HTTP_404_NOT_FOUND
                        )
                    
                    # Check for existing successful payment
                    if ticket.payments.filter(status=Payment.Status.SUCCESS).exists():
                        return Response(
                            {'error': 'Ticket already paid for'}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    payment, checkout_url = payment_service.create_payment(
                        ticket=ticket,
                        user=request.user,
                        request=request
                    )
                
                return Response({
                    'payment': PaymentSerializer(payment).data,
                    'authorization_url': checkout_url,
                    'reference': payment.reference,
                })
                
            except Exception as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='verify')
    def verify_payment(self, request):
        """Verify a payment"""
        reference = request.data.get('reference')
        
        if not reference:
            return Response(
                {'error': 'Reference is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            payment_service = PaymentService()
            payment = payment_service.verify_and_complete_payment(reference, request)
            
            return Response({
                'payment': PaymentSerializer(payment).data,
                'message': 'Payment verified successfully'
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def my_payments(self, request):
        """Get current user's payments"""
        payments = self.get_queryset().filter(payer_email=request.user.email)
        page = self.paginate_queryset(payments)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)


class PaymentPlanViewSet(viewsets.ModelViewSet):
    """ViewSet for PaymentPlan management"""
    queryset = PaymentPlan.objects.filter(is_active=True)
    serializer_class = PaymentPlanSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), HasPermission(Perm.PAYMENTS_MANAGE)()]
        return [permissions.AllowAny()]
    
    def get_queryset(self):
        queryset = PaymentPlan.objects.filter(is_active=True)
        
        # Filter by ticket category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(
                Q(ticket_category=category) | Q(ticket_category='')
            )
        
        # Only show valid plans
        now = timezone.now()
        queryset = queryset.filter(valid_from__lte=now, valid_to__gte=now)
        
        return queryset.order_by('amount')


class PaymentDashboardView(APIView):
    """Payment dashboard statistics"""
    permission_classes = [permissions.IsAuthenticated, HasPermission(Perm.PAYMENTS_MANAGE)]
    
    def get(self, request):
        # Four counts and the revenue sum in one scan, rather than five separate
        # unscoped passes over the whole payments table.
        overview = Payment.objects.aggregate(
            total_payments=Count('id'),
            successful_payments=Count('id', filter=Q(status=Payment.Status.SUCCESS)),
            pending_payments=Count('id', filter=Q(status=Payment.Status.PENDING)),
            failed_payments=Count('id', filter=Q(status=Payment.Status.FAILED)),
            total_revenue=Coalesce(
                Sum('amount', filter=Q(status=Payment.Status.SUCCESS)),
                Decimal('0'),
            ),
        )
        total_payments = overview['total_payments']
        successful_payments = overview['successful_payments']
        total_revenue = overview['total_revenue']

        # Recent payments
        # PaymentSerializer nests TicketSerializer, which in turn resolves
        # registered_by/approved_by display names — so this needs the two-level
        # join, not just select_related('ticket').
        recent_payments = (
            Payment.objects
            .filter(status=Payment.Status.SUCCESS)
            .select_related('ticket', 'ticket__registered_by', 'ticket__approved_by')
            .order_by('-completed_at')[:10]
        )
        
        # Payment method breakdown
        payment_methods = Payment.objects.filter(status=Payment.Status.SUCCESS).values(
            'payment_method'
        ).annotate(
            count=Count('id'),
            total=Sum('amount')
        ).order_by('-total')
        
        data = {
            'overview': {
                'total_payments': total_payments,
                'successful_payments': successful_payments,
                'pending_payments': overview['pending_payments'],
                'failed_payments': overview['failed_payments'],
                'success_rate': (successful_payments / total_payments * 100) if total_payments > 0 else 0,
            },
            'revenue': {
                'total': float(total_revenue),
                'formatted_total': f"₦{total_revenue:,.2f}",
            },
            'payment_methods': list(payment_methods),
            'recent_payments': PaymentSerializer(recent_payments, many=True).data,
        }
        
        return Response(data)


class SquadWebhookView(APIView):
    """Handle Squad webhooks"""
    permission_classes = []  # No authentication for webhooks
    
    def post(self, request):
        # The signature is over the raw bytes, so read request.body and never
        # request.data: DRF would parse the body and the bytes would be gone.
        signature = request.headers.get('x-squad-encrypted-body', '')

        try:
            PaymentService().handle_webhook(request.body, signature)
        except PermissionDenied:
            return Response(
                {'error': 'Invalid signature'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # A genuine event is acknowledged whether or not it changed anything.
        # Sending it again cannot help with an event we do not handle or a
        # payment already completed.
        return Response({'status': 'success'})


class PaymentCallbackView(APIView):
    """Handle Squad payment callback (for frontend redirect)"""
    permission_classes = []  # Public endpoint
    
    def get(self, request):
        payment_reference = _reference_from(request)
        
        if not payment_reference:
            return Response(
                {'error': 'Missing payment reference'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Verify the payment
            payment_service = PaymentService()
            payment = payment_service.verify_and_complete_payment(payment_reference, request)
            
            # Redirect to frontend with success message
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            
            # Note: The frontend handles the redirect logic now via the PaymentCallback page,
            # but if you use this endpoint for direct browser redirects:
            redirect_url = f"{frontend_url}/payment/callback?reference={payment.reference}"
            
            return Response({
                'success': True,
                'redirect_url': redirect_url,
                'payment': PaymentSerializer(payment).data
            })
            
        except Exception as e:
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            # redirect_url = f"{frontend_url}/payment/failed?error={str(e)}"
            
            return Response({
                'success': False,
                'error': str(e)
            })


# =====================
# EVENT REGISTRATIONS
# =====================
# The rules live in `registrations.py`. What is here is who may ask, and what
# the answer looks like.

# `payments.urls` is mounted twice (`api/v1/payments/` and the older
# `api/payments/`), so `reverse` cannot be trusted to pick this one.
_PAY_LINK_PATH = '/api/v1/payments/pay/{token}/'
_RETURN_PATH = '/api/v1/payments/return/'


def _reference_from(request):
    """The payment reference in the address a gateway sent someone back to."""
    for name in ('reference', 'transaction_ref', 'trxref'):
        if request.GET.get(name):
            return request.GET[name]
    return ''


def _absolute(request, path):
    """`path` as an address someone outside can open."""
    base = settings.PUBLIC_API_URL or request.build_absolute_uri('/').rstrip('/')
    return base + path


def _safe_return_to(value):
    """
    Where the payer's app asked to be sent back to, if that is somewhere of
    ours: the phone app's own link scheme, or one of our sites. Anything else
    is dropped, so the page after payment can never be made to link elsewhere.
    """
    if not isinstance(value, str) or not value or len(value) > 500:
        return ''
    parts = urlsplit(value)
    if parts.scheme == settings.MOBILE_APP_SCHEME:
        return value
    # Expo Go and a local web build, which have no fixed address.
    if settings.DEBUG and parts.scheme in ('exp', 'http', 'https'):
        return value
    ours = {origin.rstrip('/') for origin in getattr(settings, 'CORS_ALLOWED_ORIGINS', [])}
    if settings.FRONTEND_URL:
        ours.add(settings.FRONTEND_URL.rstrip('/'))
    if parts.scheme == 'https' and f'{parts.scheme}://{parts.netloc}' in ours:
        return value
    return ''


def _payable_registration(user, pk):
    """A registration `user` may pay for: their own, or any if they manage events."""
    queryset = EventRegistration.objects.select_related('event')
    if not has_any_permission(user, Perm.EVENTS_MANAGE):
        queryset = queryset.filter(pk__in=own_registrations(user).values('pk'))
    return queryset.filter(pk=pk).first()


class RegistrationCheckoutView(APIView):
    """
    `POST /payments/registrations/<id>/checkout/`

    Opens Squad's checkout for a registration, or hands back the one that
    is already open. The phone sends the payer to `authorization_url`;
    `pay_link` is the address to send to a parent instead.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        registration = _payable_registration(request.user, pk)
        if registration is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = registration_payments.start(
                registration,
                return_url=_absolute(request, _RETURN_PATH),
                return_to=_safe_return_to(request.data.get('return_to')),
            )
        except registration_payments.NotPayable as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except registration_payments.BeingPrepared:
            return Response(
                {'detail': 'Your payment page is being prepared. Try again in a moment.'},
                status=status.HTTP_409_CONFLICT)
        except registration_payments.Unavailable as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            'reference': payment.reference,
            'authorization_url': payment.authorization_url,
            'amount': str(payment.amount),
            'pay_link': _absolute(request, _PAY_LINK_PATH.format(
                token=registration_payments.pay_token(registration))),
        })


class RegistrationPaymentCheckView(APIView):
    """
    `POST /payments/registrations/<id>/check/`

    Asks Squad about the registration's open checkouts and returns the
    registration as it now stands. For the phone to call when the payer comes
    back to it, in case the webhook has not arrived yet.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        registration = _payable_registration(request.user, pk)
        if registration is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if registration.payment_status != EventRegistration.PaymentStatus.PAID:
            registration_payments.check_registration(registration)
            registration = EventRegistration.objects.select_related('event').get(pk=registration.pk)
        return Response(EventRegistrationDetailSerializer(registration).data)


def _page(request, heading, message, status_code=200, **context):
    # Where they will sleep, on an event with bedspaces: the parent paying is
    # the person most likely to ask.
    registration = context.get('registration')
    if registration is not None and registration.event.bedspaces_enabled:
        from events import bedspaces
        context['bed'] = bedspaces.bed_of(registration)
        context['bed_firm'] = bedspaces.is_firm(registration)
    return render(
        request, 'payments/page.html',
        {'heading': heading, 'message': message, **context}, status=status_code)


@method_decorator(csrf_exempt, name='dispatch')
class RegistrationPayLinkView(View):
    """
    `/payments/pay/<token>/`: the link a teen sends to a parent.

    No login: the token is the permission. Opening it shows what is being paid
    for and by when; pressing Pay goes to Squad. It is two steps on purpose.
    A chat app fetches any link pasted into it to draw a preview, and that
    must not open a checkout.

    Exempt from CSRF because there is no session to ride on: the form does
    nothing the link itself does not already allow.
    """

    def _missing(self, request):
        return _page(
            request, 'This link does not work',
            'Ask for the payment link to be sent to you again.', status_code=404)

    def _refused(self, request, registration, why):
        paid = registration.payment_status == EventRegistration.PaymentStatus.PAID
        return _page(
            request,
            'Already paid' if paid else 'This cannot be paid for',
            'Thank you. Nothing more is needed.' if paid else why,
            registration=registration,
            tone='good' if paid else '',
        )

    def get(self, request, token):
        registration = registration_payments.from_pay_token(token)
        if registration is None:
            return self._missing(request)

        why = registration_payments.refusal(registration)
        if why:
            return self._refused(request, registration, why)
        return _page(
            request,
            'Pay for an event',
            f'{registration.attendee_name} has a place held at this event. '
            f'It is confirmed as soon as it is paid for.',
            registration=registration,
            amount=registration.amount_due,
            pay_by=registration_payments.pay_by(registration),
            can_pay=True,
        )

    def post(self, request, token):
        registration = registration_payments.from_pay_token(token)
        if registration is None:
            return self._missing(request)

        try:
            payment = registration_payments.start(
                registration, return_url=_absolute(request, _RETURN_PATH))
        except registration_payments.NotPayable as exc:
            return self._refused(request, registration, str(exc))
        except registration_payments.BeingPrepared:
            return _page(
                request, 'One moment',
                'The payment page is being prepared. Go back and press Pay again.',
                status_code=409, registration=registration)
        except registration_payments.Unavailable as exc:
            return _page(
                request, 'We could not open the payment page', str(exc),
                status_code=503, registration=registration)
        return HttpResponseRedirect(payment.authorization_url)


class PaymentReturnView(View):
    """
    `/payments/return/<reference>/`: where Squad sends a payer afterwards.

    Asks Squad what happened rather than believing the address, then says
    so. Someone who paid from the app is offered the way back to it.
    """

    def get(self, request, reference=''):
        reference = reference or _reference_from(request)
        payment = (
            Payment.objects.select_related('registration__event')
            .filter(reference=reference, registration__isnull=False).first()
        ) if reference else None
        if payment is None:
            return _page(
                request, 'We could not find that payment',
                'If you paid, your ticket will update by itself in a few minutes.',
                status_code=404)

        paid = registration_payments.check(payment)
        payment.refresh_from_db()
        registration = EventRegistration.objects.select_related('event').get(
            pk=payment.registration_id)
        shared = {
            'registration': registration,
            'amount': payment.amount,
            'return_to': (payment.metadata or {}).get('return_to', ''),
        }

        if paid and registration.status == EventRegistration.Status.CANCELLED:
            return _page(
                request, 'Payment received, but the event is full',
                'This place had already been released and the event is now full. '
                'An organiser will contact you about a refund.', **shared)
        if paid:
            return _page(
                request, 'Payment received',
                f'Thank you. {registration.attendee_name}’s place is confirmed '
                f'and the ticket is ready in the app.', tone='good', **shared)
        if payment.status == Payment.Status.FAILED:
            return _page(
                request, 'The payment did not go through',
                'Nothing was taken. You can try again from the ticket in the app, '
                'or from the payment link.', **shared)
        return _page(
            request, 'We are waiting to hear from your bank',
            'This can take a few minutes with a transfer or USSD. The ticket '
            'updates by itself once the payment arrives; you do not need to pay again.',
            retry=True, **shared)