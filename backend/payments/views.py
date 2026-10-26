import logging
import uuid

from rest_framework import viewsets, generics, status, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from django.utils import timezone
from decimal import Decimal

from django.db.models import Count, Sum, Q
from django.db.models.functions import Coalesce
from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from urllib.parse import urlsplit

from . import registrations as registration_payments
from .models import Payment, PaymentPlan, PaymentReceipt, TransactionLog
from . import batch_payments, receipts
from .serializers import (
    PaymentSerializer, PaymentPlanSerializer,
    InitializePaymentSerializer, LedgerPaymentSerializer, PaymentReceiptCreateSerializer,
    PaymentReceiptSerializer, ReceiptRejectSerializer, ReceiptVerifySerializer,
)
from .services import PaymentService
from tickets.models import Ticket
from identity.authorization import HasPermission, has_any_permission, scope_queryset
from identity.permissions_registry import Perm
from events import batches
from events.models import Event, EventRegistration, RegistrationBatch
from events.serializers import (
    EventRegistrationDetailSerializer, RegistrationBatchDetailSerializer,
    RegistrationBatchSerializer,
)
from events.views import own_registrations

logger = logging.getLogger(__name__)


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
_RETURN_PATH = '/api/v1/payments/return/'


def _reference_from(request):
    """The payment reference in the address a gateway sent someone back to."""
    for name in ('reference', 'transaction_ref', 'trxref'):
        if request.GET.get(name):
            return request.GET[name]
    return ''


def _api_base(request):
    """This API's address as someone outside opens it, with no slash at the end."""
    return settings.PUBLIC_API_URL or request.build_absolute_uri('/').rstrip('/')


def _absolute(request, path):
    """`path` as an address someone outside can open."""
    return _api_base(request) + path


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
            'pay_link': registration_payments.pay_link(registration, _api_base(request)),
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


def _preview_image(request, event):
    """
    The picture a chat app shows under a shared pay link: the event's flier,
    or the site's own card when it has none. Absolute, as the chat app's
    fetcher needs.
    """
    if event.cover_image:
        try:
            return request.build_absolute_uri(event.cover_image.url)
        except Exception:  # Storage misconfigured: no picture beats a 500.
            logger.exception('No URL for the cover of event %s', event.pk)
    if settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip('/') + '/og-image.jpg'
    return ''


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
            preview_image=_preview_image(request, registration.event),
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
            Payment.objects.select_related('registration__event', 'batch__event')
            .filter(reference=reference)
            .filter(Q(registration__isnull=False) | Q(batch__isnull=False)).first()
        ) if reference else None
        if payment is not None and payment.batch_id:
            return self._group(request, payment)
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

    def _group(self, request, payment):
        """The same page for a coordinator paying for a group."""
        paid = registration_payments.check(payment)
        payment.refresh_from_db()
        batch = RegistrationBatch.objects.select_related('event').get(pk=payment.batch_id)
        shared = {
            'batch': batch,
            'amount': payment.amount,
            'return_to': (payment.metadata or {}).get('return_to', ''),
        }
        if paid:
            message = (
                f'Thank you. Group {batch.reference} is paid for, and every seat is confirmed.'
                if batch.status == RegistrationBatch.Status.PAID else
                f'Thank you. ₦{batch.balance:,.0f} is still to pay for group {batch.reference}.')
            return _page(request, 'Payment received', message, tone='good', **shared)
        if payment.status == Payment.Status.FAILED:
            return _page(
                request, 'The payment did not go through',
                'Nothing was taken. You can try again from the group in the app.', **shared)
        return _page(
            request, 'We are waiting to hear from your bank',
            'This can take a few minutes with a transfer or USSD. The group '
            'updates by itself once the payment arrives; you do not need to pay again.',
            retry=True, **shared)


# =====================
# GROUPS, TRANSFER RECEIPTS AND RECONCILIATION
# =====================

def _batch_for(user, pk):
    """A group `user` may pay for: one they run as a coordinator."""
    batch = RegistrationBatch.objects.select_related('event', 'node', 'created_by').filter(pk=pk).first()
    if batch is None or not batches.can_manage(user, batch):
        return None
    return batch


def _console_return(batch):
    base = (settings.FRONTEND_URL or '').rstrip('/')
    return f'{base}/admin/groups?batch={batch.pk}&paid=1'


class BatchCheckoutView(APIView):
    """`POST /payments/batches/<id>/checkout/`: open the gateway for what a group owes."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        batch = _batch_for(request.user, pk)
        if batch is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            # From the phone app: back through our own page, which links to
            # the group in the app. From the Console: straight back to it.
            return_to = _safe_return_to(request.data.get('return_to'))
            if return_to:
                payment = batch_payments.start(
                    batch, return_url=_absolute(request, _RETURN_PATH), return_to=return_to)
            else:
                payment = batch_payments.start(batch, callback_url=_console_return(batch))
        except registration_payments.NotPayable as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except registration_payments.BeingPrepared:
            return Response(
                {'detail': 'The payment page is being prepared. Try again in a moment.'},
                status=status.HTTP_409_CONFLICT)
        except registration_payments.Unavailable as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            'reference': payment.reference,
            'authorization_url': payment.authorization_url,
            'amount': str(payment.amount),
        })


class BatchPaymentCheckView(APIView):
    """`POST /payments/batches/<id>/check/`: ask the gateway, for when the coordinator comes back."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        batch = _batch_for(request.user, pk)
        if batch is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        batch_payments.check_batch(batch)
        batch.refresh_from_db()
        return Response(RegistrationBatchDetailSerializer(batch, context={'request': request}).data)


class PaymentReceiptViewSet(viewsets.GenericViewSet):
    """
    Transfer receipts: `payments/receipts.py`.

    `GET` lists the receipts you sent, for groups you run, or in the part of
    the church you reconcile (`?status=submitted` for the ones to check).
    `POST` (multipart) sends one. `verify` and `reject` are for whoever holds
    `payments.reconcile` over it.
    """
    queryset = PaymentReceipt.objects.none()
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'batch', 'registration']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        base = PaymentReceipt.objects.select_related(
            'batch__event', 'batch__node', 'registration__event', 'registration__node',
            'submitted_by', 'reviewed_by')
        mine = Q(submitted_by=user)
        managed_batches = scope_queryset(RegistrationBatch.objects.all(), user, Perm.EVENTS_MANAGE)
        mine |= Q(batch__in=managed_batches)
        reviewed = receipts.scope_receipts(base, user, receipts._code_for(user))
        queryset = base.filter(mine | Q(pk__in=reviewed.values('pk')))
        event = self.request.query_params.get('event')
        if event:
            try:
                event = uuid.UUID(str(event))
            except ValueError:
                raise ValidationError({'event': ['That is not an event id.']})
            queryset = queryset.filter(Q(batch__event_id=event) | Q(registration__event_id=event))
        return queryset

    def get_serializer_class(self):
        return PaymentReceiptSerializer

    def _out(self, receipt):
        receipt = self.get_queryset().get(pk=receipt.pk)
        return PaymentReceiptSerializer(receipt, context={'request': self.request}).data

    def list(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        context = {'request': request}
        if page is not None:
            return self.get_paginated_response(
                PaymentReceiptSerializer(page, many=True, context=context).data)
        return Response(PaymentReceiptSerializer(queryset, many=True, context=context).data)

    def retrieve(self, request, pk=None):
        receipt = self.get_queryset().filter(pk=pk).first()
        if receipt is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self._out(receipt))

    def create(self, request):
        serializer = PaymentReceiptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get('batch'):
            target = RegistrationBatch.objects.select_related('event', 'node').filter(
                pk=data['batch']).first()
        else:
            target = EventRegistration.objects.select_related('event', 'node').filter(
                pk=data['registration']).first()
        if target is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            receipt = receipts.submit(
                request.user, target,
                amount=data['amount'], paid_on=data['paid_on'], file=data['file'],
                payer_name=data.get('payer_name', ''),
                bank_reference=data.get('bank_reference', ''),
            )
        except receipts.ReceiptError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self._out(receipt), status=status.HTTP_201_CREATED)

    def _review(self, request, pk, action):
        receipt = self.get_queryset().filter(pk=pk).first()
        if receipt is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            receipt = action(receipt)
        except receipts.ReceiptError as exc:
            code = (status.HTTP_403_FORBIDDEN
                    if not receipts.can_reconcile(request.user, receipt.node)
                    else status.HTTP_400_BAD_REQUEST)
            return Response({'detail': str(exc)}, status=code)
        return Response(self._out(receipt))

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        serializer = ReceiptVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._review(request, pk, lambda receipt: receipts.verify(
            request.user, receipt,
            amount=serializer.validated_data.get('amount'),
            note=serializer.validated_data.get('note', '')))

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        serializer = ReceiptRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._review(request, pk, lambda receipt: receipts.reject(
            request.user, receipt, reason=serializer.validated_data['reason']))


class ReceiptFileView(APIView):
    """
    `GET /payments/receipts/<id>/file/`: the receipt itself, streamed from
    private storage to someone allowed to see it. Never cached.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from django.http import FileResponse
        receipt = PaymentReceipt.objects.select_related(
            'batch__node', 'registration__node', 'batch__event').filter(pk=pk).first()
        if receipt is None or not receipts.can_see(request.user, receipt):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            handle = receipt.file.open('rb')
        except Exception:
            logger.exception('Could not open receipt %s', receipt.pk)
            return Response({'detail': 'The file could not be opened.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        # A type we checked is shown in the browser; anything else (a row from
        # before the type was checked) is only ever downloaded.
        safe = receipt.file_type in receipts.SAFE_TYPES.values()
        response = FileResponse(
            handle, content_type=receipt.file_type if safe else 'application/octet-stream',
            filename=receipt.file_name or 'receipt', as_attachment=not safe)
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class ReconciliationView(APIView):
    """
    `GET /payments/reconciliation/?event=<id>`: what an event expects and
    what has come in, in the part of the church you reconcile, with the
    ledger of payments and the groups that still owe. `&export=csv` for the
    ledger as a spreadsheet (not `format`, which DRF keeps for renderers).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):

        user = request.user
        if not (has_any_permission(user, Perm.PAYMENTS_RECONCILE)
                or has_any_permission(user, Perm.PAYMENTS_VIEW)):
            return Response({'detail': 'You cannot see payments.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            event = Event.objects.filter(pk=request.query_params.get('event')).first()
        except (ValueError, DjangoValidationError):
            event = None
        if event is None:
            return Response({'event': ['Choose an event.']}, status=status.HTTP_400_BAD_REQUEST)

        code = receipts._code_for(user)
        ledger = receipts.scope_payments(
            Payment.objects.select_related('batch__node', 'registration__node').filter(
                Q(batch__event=event) | Q(registration__event=event),
                status=Payment.Status.SUCCESS,
            ), user, code).order_by('-completed_at')
        owing = receipts.scope_batches(
            RegistrationBatch.objects.select_related('node', 'event', 'created_by').filter(
                event=event).exclude(status__in=[
                    RegistrationBatch.Status.PAID, RegistrationBatch.Status.CANCELLED]),
            user, code).order_by('node__name')

        if request.query_params.get('export') == 'csv':
            return self._csv(event, ledger)

        summary = receipts.summary(event, user)
        return Response({
            'event': {'id': str(event.pk), 'title': event.title,
                      'payment_method': event.payment_method},
            'summary': {key: (str(value) if isinstance(value, Decimal) else value)
                        for key, value in summary.items()},
            'ledger': LedgerPaymentSerializer(ledger[:500], many=True).data,
            'owing': RegistrationBatchSerializer(owing, many=True).data,
            'can_reconcile': receipts.can_reconcile_anywhere(user),
        })

    @staticmethod
    def _csv(event, ledger):
        import csv
        from django.http import HttpResponse

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="payments-{event.slug}.csv"'
        response.write('﻿')
        writer = csv.writer(response)
        writer.writerow(['Date', 'Reference', 'For', 'Where', 'Kind', 'Amount', 'Payer',
                         'Bank reference'])

        def cell(value):
            # A spreadsheet runs a cell that starts like a formula.
            text = '' if value is None else str(value)
            return f"'{text}" if text[:1] in ('=', '+', '-', '@') else text

        for row in LedgerPaymentSerializer(ledger, many=True).data:
            writer.writerow([cell(v) for v in (
                row['completed_at'], row['reference'], row['for_reference'], row['node'],
                row['kind'], row['amount'], row['payer_name'], row['bank_reference'])])
        return response
