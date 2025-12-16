from rest_framework import viewsets, generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from django.utils import timezone
from django.db.models import Count, Sum, Q
from django.conf import settings

from .models import Payment, PaymentPlan, TransactionLog
from .serializers import (
    PaymentSerializer, PaymentPlanSerializer,
    InitializePaymentSerializer, PaystackCallbackSerializer
)
from .services import PaymentService
from tickets.models import Ticket
from users.permissions import IsAdmin


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
        
        # User-based filtering
        if user.role == user.Role.COORDINATOR:
            # Coordinators can see payments for tickets from their province
            # OR payments they made themselves (bulk payments)
            queryset = queryset.filter(
                Q(payer_email=user.email) |  
                Q(ticket__province=user.province)
            )
        elif user.role == user.Role.ADMIN:
            # Admins see all payments
            pass
        else:
            # Regular users see only their own payments
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

                    payment, paystack_response = payment_service.create_bulk_payment(
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
                    
                    payment, paystack_response = payment_service.create_payment(
                        ticket=ticket,
                        user=request.user,
                        request=request
                    )
                
                return Response({
                    'payment': PaymentSerializer(payment).data,
                    'authorization_url': paystack_response['data']['authorization_url'],
                    'reference': payment.reference,
                    'access_code': paystack_response['data']['access_code']
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
            return [permissions.IsAuthenticated(), IsAdmin()]
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
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get(self, request):
        # Calculate statistics
        total_payments = Payment.objects.count()
        successful_payments = Payment.objects.filter(status=Payment.Status.SUCCESS).count()
        pending_payments = Payment.objects.filter(status=Payment.Status.PENDING).count()
        failed_payments = Payment.objects.filter(status=Payment.Status.FAILED).count()
        
        # Revenue calculations
        total_revenue = Payment.objects.filter(status=Payment.Status.SUCCESS).aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        # Recent payments
        recent_payments = Payment.objects.filter(status=Payment.Status.SUCCESS).order_by('-completed_at')[:10]
        
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
                'pending_payments': pending_payments,
                'failed_payments': failed_payments,
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


class PaystackWebhookView(APIView):
    """Handle Paystack webhooks"""
    permission_classes = []  # No authentication for webhooks
    
    def post(self, request):
        # Get signature from header
        signature = request.headers.get('X-Paystack-Signature')
        
        if not signature:
            return Response(
                {'error': 'Missing signature'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify signature (implement proper verification)
        payment_service = PaymentService()
        success = payment_service.handle_webhook(request.data, signature)
        
        if success:
            return Response({'status': 'success'})
        else:
            return Response(
                {'error': 'Webhook processing failed'},
                status=status.HTTP_400_BAD_REQUEST
            )


class PaymentCallbackView(APIView):
    """Handle Paystack payment callback (for frontend redirect)"""
    permission_classes = []  # Public endpoint
    
    def get(self, request):
        reference = request.GET.get('reference')
        trxref = request.GET.get('trxref')
        
        # Use the reference from Paystack
        payment_reference = reference or trxref
        
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