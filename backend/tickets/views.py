from django.http import HttpResponse
from rest_framework import viewsets, generics, status, filters, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Count, Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.paginator import Paginator
from django.db import transaction
import csv
import io

from .models import Ticket, BulkUpload, TicketAuditLog, CheckInRecord
from .serializers import (
    TicketSerializer, TicketCreateSerializer, TicketUpdateSerializer,
    TicketStatusUpdateSerializer, BulkUploadSerializer,
    BulkUploadCreateSerializer, TicketAuditLogSerializer,
    CheckInRecordSerializer, TicketPaymentUploadSerializer,
    BulkActionSerializer
)
from .permissions import TicketPermission, CanApproveTicket
from .utils import UUIDEncoder, convert_uuid_to_string
from .services import QRCodeService, PDFService, EmailService
from users.permissions import IsAdmin, IsCoordinator, ProvinceAccessPermission

User = get_user_model()

from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class TicketViewSet(viewsets.ModelViewSet):
    """ViewSet for Ticket management"""
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [TicketPermission]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'full_name', 'ticket_id', 'email', 'phone',
        'province', 'zone', 'area', 'parish'
    ]
    ordering_fields = ['registered_at', 'full_name', 'age', 'status']
    ordering = ['-registered_at']

    def get_permissions(self):
        """Allow public access for specific actions"""
        if self.action in ['create', 'verify', 'upload_proof', 'qr_code', 'check_in', 'bulk_create', 'send_bulk_confirmation']:
            return [permissions.AllowAny()]
        return [TicketPermission()]

    def get_authenticators(self):
        """
        Return authenticators for this view.
        
        Skip authentication for public endpoints to avoid 401 errors.
        For ticket creation, we skip auth by default but still try to identify
        coordinators if they provide a valid token (handled via optional auth).
        """
        # For public endpoints, skip auth to avoid 401 on expired/invalid tokens
        if hasattr(self, 'request'):
            path = getattr(self.request, 'path_info', '')
            method = getattr(self.request, 'method', '')
            
            # Check for specific public action paths in URL
            public_path_keywords = ['verify', 'qr_code', 'upload_proof', 'upload_proof_by_ticket_id', 'bulk_create', 'send_bulk_confirmation']
            if any(p in path for p in public_path_keywords):
                return []
            
            # For POST to /api/tickets/ (create action), skip authentication
            if method == 'POST' and path.rstrip('/').endswith('/tickets'):
                return []
        
        # For all other endpoints, use normal authentication
        return super().get_authenticators()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TicketCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TicketUpdateSerializer
        return TicketSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Apply filters from query parameters
        status_filter = self.request.query_params.get('status')
        province_filter = self.request.query_params.get('province')
        category_filter = self.request.query_params.get('category')
        gender_filter = self.request.query_params.get('gender')
        registered_by_filter = self.request.query_params.get('registered_by')
        
        # Allow public access for specific actions
        if self.action in ['upload_proof', 'verify', 'qr_code', 'check_in']:
            queryset = Ticket.objects.all()
        elif not user.is_authenticated:
            return Ticket.objects.none()
        else:
            queryset = Ticket.objects.all()
        
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        if province_filter:
            queryset = queryset.filter(province=province_filter)
        
        if category_filter:
            queryset = queryset.filter(category=category_filter)
        
        if gender_filter:
            queryset = queryset.filter(gender=gender_filter)
            
        if registered_by_filter:
            if registered_by_filter == 'Self':
                 # Self registration means no registered_by user AND parent_relationship is NOT 'Coordinator'
                 queryset = queryset.filter(registered_by__isnull=True).exclude(parent_relationship='Coordinator')
            else:
                 # Strip " (Coordinator)" if present, as the frontend sends the full display name
                 clean_filter = registered_by_filter.replace(' (Coordinator)', '').strip()
                 
                 # Search by coordinator name in parent_name OR by User's display/username
                 queryset = queryset.filter(
                     Q(parent_name__icontains=clean_filter, parent_relationship='Coordinator') |
                     Q(registered_by__first_name__icontains=clean_filter) |
                     Q(registered_by__last_name__icontains=clean_filter)
                 )
        
        # Apply role-based filtering
        if user.is_authenticated and user.role == User.Role.COORDINATOR:
            queryset = queryset.filter(province=user.province)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Create a ticket and return full ticket data"""
        # Use the create serializer for validation
        create_serializer = self.get_serializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        
        # Determine registered_by (None for anonymous/public registrations)
        registered_by = request.user if request.user.is_authenticated else None
        
        # Create the ticket
        ticket = create_serializer.save(
            registered_by=registered_by,
            registered_at=timezone.now()
        )
        
        # Create audit log (only if user is authenticated)
        ticket_data = TicketSerializer(ticket).data
        ticket_data = convert_uuid_to_string(ticket_data)
        
        TicketAuditLog.objects.create(
            user=registered_by,  # Will be None for public registrations
            action=TicketAuditLog.ActionType.CREATE,
            ticket=ticket,
            new_values=ticket_data,
            ip_address=self.get_client_ip(),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # Check if we should skip individual email (for bulk registrations)
        skip_email = request.data.get('skip_email', False)
        
        # Send confirmation email only if not skipped
        # Coordinators doing bulk registration should skip and use the bulk email endpoint
        if not skip_email:
            try:
                # Send email in background thread to prevent SMTP timeouts from blocking the response
                import threading
                email_thread = threading.Thread(
                    target=EmailService.send_ticket_confirmation,
                    args=(ticket,),
                    daemon=True
                )
                email_thread.start()
                # Don't wait for email - ticket registration completes immediately
            except Exception as e:
                # Log error but don't fail the request
                print(f"Failed to queue confirmation email: {e}")

        # Return the full ticket data using the main serializer
        serializer = TicketSerializer(ticket)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request, *args, **kwargs):
        """
        Create multiple tickets in a single transaction.
        Optimized for bulk uploads to avoid rate limiting and HTTP overhead.
        """
        create_serializer = self.get_serializer(data=request.data, many=True)
        create_serializer.is_valid(raise_exception=True)
        
        created_tickets = []
        
        try:
            with transaction.atomic():
                for ticket_data in create_serializer.validated_data:
                    # We manually instantiate and save to trigger the custom ID generation method
                    ticket = Ticket(**ticket_data)
                    ticket.registered_by = request.user
                    ticket.registered_at = timezone.now()
                    ticket.save()
                    created_tickets.append(ticket)
                
                # Create a single audit log for the batch (optional, or per ticket)
                # For now, let's just log the first request IP to avoid spamming logs excessively
                # or we can rely on the fact that they are created.
                
                # If we want to return full data for all, we can.
                response_serializer = TicketSerializer(created_tickets, many=True)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'error': f'Bulk creation failed: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # def perform_create(self, serializer):
    #     """Create a ticket with the current user as registered_by"""
    #     ticket = serializer.save(
    #         registered_by=self.request.user,
    #         registered_at=timezone.now()
    #     )
        
    #     # Create audit log
    #     ticket_data = TicketSerializer(ticket).data
    #     # Convert UUIDs to strings for JSON serialization
    #     ticket_data = convert_uuid_to_string(ticket_data)
        
    #     TicketAuditLog.objects.create(
    #         user=self.request.user,
    #         action=TicketAuditLog.ActionType.CREATE,
    #         ticket=ticket,
    #         new_values=ticket_data,
    #         ip_address=self.get_client_ip(),
    #         user_agent=self.request.META.get('HTTP_USER_AGENT', '')
    #     )

    
    def perform_update(self, serializer):
        """Update ticket with audit logging"""
        old_instance = self.get_object()
        old_values = TicketSerializer(old_instance).data
        old_values = convert_uuid_to_string(old_values)
        
        ticket = serializer.save()
        
        new_values = TicketSerializer(ticket).data
        new_values = convert_uuid_to_string(new_values)
        
        # Create audit log
        TicketAuditLog.objects.create(
            user=self.request.user,
            action=TicketAuditLog.ActionType.UPDATE,
            ticket=ticket,
            old_values=old_values,
            new_values=new_values,
            ip_address=self.get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')
        )
    
    @action(detail=True, methods=['post'], permission_classes=[CanApproveTicket])
    def update_status(self, request, pk=None):
        """Update ticket status"""
        ticket = self.get_object()
        serializer = TicketStatusUpdateSerializer(
            data=request.data,
            context={'ticket': ticket, 'user': request.user}
        )
        
        if serializer.is_valid():
            old_status = ticket.status
            new_status = serializer.validated_data['status']
            
            # Update ticket
            ticket.status = new_status
            if new_status == Ticket.Status.APPROVED:
                ticket.approved_at = timezone.now()
                ticket.approved_by = request.user
            
            if serializer.validated_data.get('notes'):
                ticket.notes = serializer.validated_data['notes']
            
            ticket.save()
            
            # Create audit log
            TicketAuditLog.objects.create(
                user=request.user,
                action=TicketAuditLog.ActionType.STATUS_CHANGE,
                ticket=ticket,
                old_values={'status': old_status},
                new_values={'status': new_status},
                ip_address=self.get_client_ip(),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )
            
            # Send status update email
            try:
                if new_status == Ticket.Status.APPROVED:
                    EmailService.send_ticket_approved(ticket)
                else:
                    EmailService.send_status_update(ticket, old_status, new_status)
            except Exception as e:
                print(f"Failed to send status update email: {e}")
            
            return Response(TicketSerializer(ticket).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[permissions.AllowAny], parser_classes=[MultiPartParser, FormParser])
    def upload_proof(self, request, pk=None):
        """Upload proof of payment"""
        ticket = self.get_object()
        serializer = TicketPaymentUploadSerializer(ticket, data=request.data, partial=True)
        
        if serializer.is_valid():
            ticket = serializer.save()
            ticket.payment_status = Ticket.PaymentStatus.VERIFICATION_PENDING
            ticket.status = Ticket.Status.PENDING # Ensure it's not approved yet
            ticket.save()
            
            # Create audit log
            TicketAuditLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action='update', # Using generic update or could add PAYMENT_UPLOAD
                ticket=ticket,
                new_values={'payment_status': 'verification_pending'},
                ip_address=self.get_client_ip(),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )
            
            return Response(TicketSerializer(ticket).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny], parser_classes=[MultiPartParser, FormParser])
    def upload_proof_by_ticket_id(self, request):
        """Upload proof of payment using ticket_id (for verification page)"""
        ticket_id = request.data.get('ticket_id')
        
        if not ticket_id:
            return Response(
                {'error': 'ticket_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            ticket = Ticket.objects.get(ticket_id=ticket_id)
        except Ticket.DoesNotExist:
            return Response(
                {'error': 'Ticket not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = TicketPaymentUploadSerializer(ticket, data=request.data, partial=True)
        
        if serializer.is_valid():
            ticket = serializer.save()
            ticket.payment_status = Ticket.PaymentStatus.VERIFICATION_PENDING
            ticket.status = Ticket.Status.PENDING
            ticket.save()
            
            # Create audit log
            TicketAuditLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action='update',
                ticket=ticket,
                new_values={'payment_status': 'verification_pending'},
                ip_address=self.get_client_ip(),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )
            
            return Response(TicketSerializer(ticket).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export tickets as CSV"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Create CSV response
        response = Response(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="tickets.csv"'
        
        # Write CSV
        writer = csv.writer(response)
        
        # Write header
        headers = [
            'Ticket ID', 'Full Name', 'Age', 'Category', 'Gender',
            'Phone', 'Email', 'Province', 'Zone', 'Area', 'Parish', 'Department',
            'Status', 'Registered At', 'Registered By'
        ]
        writer.writerow(headers)
        
        # Write data
        for ticket in queryset:
            writer.writerow([
                ticket.ticket_id,
                ticket.full_name,
                ticket.age,
                ticket.get_category_display(),
                ticket.get_gender_display(),
                ticket.phone,
                ticket.email,
                ticket.province,
                ticket.zone,
                ticket.area,
                ticket.parish,
                ticket.department,
                ticket.get_status_display(),
                ticket.registered_at.strftime('%Y-%m-%d %H:%M'),
                ticket.registered_by.get_display_name() if ticket.registered_by else ''
            ])
        
        return response
    
    def get_client_ip(self):
        """Get client IP address"""
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = self.request.META.get('REMOTE_ADDR')
        return ip
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def verify(self, request):
        """Verify ticket status by ticket_id (public endpoint)"""
        ticket_id = request.query_params.get('ticket_id')
        
        if not ticket_id:
            return Response(
                {'error': 'ticket_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            ticket = Ticket.objects.get(ticket_id=ticket_id)
            return Response({
                'valid': True,
                'ticket': TicketSerializer(ticket).data
            })
        except Ticket.DoesNotExist:
            return Response(
                {'valid': False, 'error': 'Ticket not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def qr_code(self, request, pk=None):
        """Get QR code for a ticket"""
        ticket = self.get_object()
        
        # Check permissions
        if not self.request.user.has_perm('tickets.view_ticket', ticket):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Generate QR code if not exists
        if not ticket.qr_code:
            QRCodeService.generate_ticket_qr_code(ticket)
        
        # Return QR code as base64 or URL
        return_type = request.query_params.get('type', 'url')
        
        if return_type == 'base64':
            # Return QR code as base64 string
            qr_base64 = QRCodeService.get_qr_code_base64(ticket)
            return Response({
                'ticket_id': ticket.ticket_id,
                'qr_code': qr_base64,
                'format': 'image/png;base64'
            })
        else:
            # Return QR code URL
            qr_url = request.build_absolute_uri(ticket.qr_code.url) if ticket.qr_code else None
            return Response({
                'ticket_id': ticket.ticket_id,
                'qr_code_url': qr_url,
                'verification_code': f"RCCG-{ticket.ticket_id}"
            })
    
    @action(detail=True, methods=['get'])
    def download_ticket(self, request, pk=None):
        """Download ticket as PDF"""
        ticket = self.get_object()
        
        # Check permissions
        if not self.request.user.has_perm('tickets.view_ticket', ticket):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Generate PDF
        pdf = PDFService.generate_ticket_pdf(ticket)
        
        # Create response
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ticket_{ticket.ticket_id}.pdf"'
        
        return response
    
    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """Export tickets as PDF"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Limit to reasonable number for PDF generation
        if queryset.count() > 100:
            return Response(
                {'error': 'Too many tickets to export. Please filter your results.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate PDF
        pdf = PDFService.generate_bulk_tickets_pdf(queryset)
        
        # Create response
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="tickets_report.pdf"'
        
        return response
    

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """
        Check in a ticket (mark as used/attended)
        Requires authentication - for event staff
        """
        ticket = self.get_object()
        
        # Check if ticket is approved
        if ticket.status != Ticket.Status.APPROVED:
            return Response(
                {'error': 'Cannot check in unapproved ticket'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already checked in (if implementing check-in tracking)
        # For now, we'll create a check-in record
        
        from .models import CheckInRecord
        
        # Check if already checked in today
        today = timezone.now().date()
        already_checked_in = CheckInRecord.objects.filter(
            ticket=ticket,
            checked_in_at__date=today
        ).exists()
        
        if already_checked_in:
            return Response({
                'success': False,
                'message': 'Ticket already checked in today',
                'ticket_id': ticket.ticket_id,
                'full_name': ticket.full_name
            })
        
        # Create check-in record
        check_in_record = CheckInRecord.objects.create(
            ticket=ticket,
            checked_in_by=request.user,
            check_in_method=request.data.get('method', 'manual'),
            notes=request.data.get('notes', ''),
            ip_address=self.get_client_ip(),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # Update ticket metadata if needed
        # ticket.checked_in_at = timezone.now()
        # ticket.save()
        
        return Response({
            'success': True,
            'message': 'Ticket checked in successfully',
            'check_in_id': str(check_in_record.id),
            'check_in_time': check_in_record.checked_in_at.isoformat(),
            'checked_in_by': request.user.get_display_name(),
            'ticket': {
                'ticket_id': ticket.ticket_id,
                'full_name': ticket.full_name,
                'category': ticket.get_category_display(),
                'age': ticket.age
            }
        })


    @action(detail=False, methods=['post'])
    def bulk_action(self, request):
        """Perform bulk actions on tickets"""
        serializer = BulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        ticket_ids = serializer.validated_data['ticket_ids']
        action = serializer.validated_data['action']
        subject = serializer.validated_data.get('subject')
        message = serializer.validated_data.get('message')
        
        # Get tickets
        queryset = self.filter_queryset(self.get_queryset())
        tickets = queryset.filter(id__in=ticket_ids)
        
        results = {
            'successful': [],
            'failed': []
        }
        
        # Group tickets by coordinator/parent email for batch notifications
        updated_tickets_by_coordinator = {} # {email: {'name': name, 'tickets': []}}
        
        for ticket in tickets:
            try:
                ticket_id_str = str(ticket.id)
                
                # Capture initial status for comparison
                email_sent = False
                
                if action == 'approve':
                    old_status = ticket.status
                    ticket.status = Ticket.Status.APPROVED
                    ticket.approved_at = timezone.now()
                    ticket.approved_by = request.user
                    ticket.save()
                    
                    # Add to batch list if has parent/coordinator email
                    if ticket.parent_email:
                        if ticket.parent_email not in updated_tickets_by_coordinator:
                            updated_tickets_by_coordinator[ticket.parent_email] = {
                                'name': ticket.parent_name,
                                'tickets': []
                            }
                        updated_tickets_by_coordinator[ticket.parent_email]['tickets'].append(ticket)
                    else:
                        # Send individual email if no coordinator
                        try:
                            EmailService.send_ticket_approved(ticket)
                        except Exception as e:
                            print(f"Email failed: {e}")
                        
                elif action == 'reject':
                    old_status = ticket.status
                    ticket.status = Ticket.Status.REJECTED
                    ticket.save()
                    
                    # Add to batch list
                    if ticket.parent_email:
                        if ticket.parent_email not in updated_tickets_by_coordinator:
                            updated_tickets_by_coordinator[ticket.parent_email] = {
                                'name': ticket.parent_name,
                                'tickets': []
                            }
                        updated_tickets_by_coordinator[ticket.parent_email]['tickets'].append(ticket)
                    else:
                        try:
                            EmailService.send_status_update(ticket, old_status, Ticket.Status.REJECTED)
                        except Exception as e:
                            print(f"Email failed: {e}")
                    
                elif action == 'send_email':
                    EmailService.send_custom_email(ticket, subject, message)
                
                # Template-based email actions (Still sent individually as they are personalized content)
                elif action == 'welcome_email':
                    try:
                        EmailService.send_welcome_email(ticket)
                    except Exception as e:
                        print(f"Welcome email failed: {e}")
                
                elif action == 'payment_reminder':
                    try:
                        EmailService.send_payment_reminder(ticket)
                    except Exception as e:
                        print(f"Payment reminder failed: {e}")
                
                elif action == 'final_instructions':
                    try:
                        EmailService.send_final_instructions(ticket)
                    except Exception as e:
                        print(f"Final instructions email failed: {e}")
                    
                elif action == 'delete':
                    ticket.delete()
                
                results['successful'].append(ticket_id_str)
                
            except Exception as e:
                results['failed'].append({'id': str(ticket.id), 'error': str(e)})
        
        # Send batch emails for coordinators
        for email, data in updated_tickets_by_coordinator.items():
            try:
                if action in ['approve', 'reject']:
                    EmailService.send_batch_status_update(
                        tickets=data['tickets'],
                        status=action,
                        coordinator_name=data['name'],
                        coordinator_email=email
                    )
            except Exception as e:
                print(f"Batch email to {email} failed: {e}")
        
        return Response(results)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def bulk_create(self, request):
        """
        Create multiple tickets in a single request (optimized for bulk registration).
        Uses bulk_create to avoid N+1 queries.
        """
        tickets_data = request.data.get('tickets', [])
        coordinator_name = request.data.get('coordinator_name', 'Coordinator')
        coordinator_email = request.data.get('coordinator_email')
        
        if not tickets_data:
            return Response(
                {'error': 'No tickets provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not isinstance(tickets_data, list):
            return Response(
                {'error': 'tickets must be an array'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate all data first
        serializer = TicketCreateSerializer(data=tickets_data, many=True)
        if not serializer.is_valid():
             return Response(
                {'error': 'Validation failed', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determine registered_by
        registered_by = request.user if request.user.is_authenticated else None
        registered_at = timezone.now()
        
        tickets_to_create = []
        
        try:
            with transaction.atomic():
                # Calculate Starting Ticket ID (Critical optimization)
                date_prefix = timezone.now().strftime('%Y%m')
                prefix = f'TKT-{date_prefix}-'
                
                # Lock the latest ticket to prevent race conditions
                last_ticket = Ticket.objects.filter(
                    ticket_id__startswith=prefix
                ).select_for_update().order_by('ticket_id').last()

                start_num = 1
                if last_ticket:
                    try:
                        parts = last_ticket.ticket_id.split('-')
                        if len(parts) >= 3:
                            start_num = int(parts[-1]) + 1
                    except (ValueError, IndexError):
                        pass
                
                # Prepare objects
                for index, valid_data in enumerate(serializer.validated_data):
                    current_num = start_num + index
                    new_ticket_id = f'{prefix}{current_num:05d}'
                    
                    ticket = Ticket(
                        ticket_id=new_ticket_id,
                        registered_by=registered_by,
                        registered_at=registered_at,
                        **valid_data
                    )
                    tickets_to_create.append(ticket)
                
                # Bulk Insert
                Ticket.objects.bulk_create(tickets_to_create)
                
                # Create Audit Log (One log for batch)
                if tickets_to_create and registered_by:
                    try:
                        TicketAuditLog.objects.create(
                            user=registered_by,
                            action=TicketAuditLog.ActionType.BULK_UPLOAD,
                            ticket=None, 
                            new_values={
                                'bulk_count': len(tickets_to_create),
                                'start_ticket_id': tickets_to_create[0].ticket_id,
                                'end_ticket_id': tickets_to_create[-1].ticket_id
                            },
                            ip_address=self.get_client_ip(),
                            user_agent=request.META.get('HTTP_USER_AGENT', '')
                        )
                    except Exception as e:
                        print(f"Audit log failed: {e}")

        except Exception as e:
            return Response(
                {'error': f'Failed to create tickets: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Send Consolidated Email
        if tickets_to_create and coordinator_email:
            try:
                EmailService.send_bulk_ticket_confirmation(
                    tickets=tickets_to_create,
                    coordinator_name=coordinator_name,
                    coordinator_email=coordinator_email
                )
            except Exception as e:
                print(f"Failed to send bulk confirmation email: {e}")

        return Response({
            'success': True,
            'created_count': len(tickets_to_create),
            'failed_count': 0,
            'tickets': TicketSerializer(tickets_to_create, many=True).data,
            'failed': []
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def send_bulk_confirmation(self, request):
        """
        Send a single consolidated confirmation email to a coordinator
        containing all their bulk-registered ticket IDs.
        
        Request body:
        {
            "ticket_ids": ["uuid1", "uuid2", ...],
            "coordinator_name": "John Doe",
            "coordinator_email": "john@example.com"
        }
        """
        ticket_ids = request.data.get('ticket_ids', [])
        coordinator_name = request.data.get('coordinator_name', 'Coordinator')
        coordinator_email = request.data.get('coordinator_email')
        
        if not ticket_ids:
            return Response(
                {'error': 'ticket_ids is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not coordinator_email:
            return Response(
                {'error': 'coordinator_email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the tickets
        tickets = Ticket.objects.filter(id__in=ticket_ids)
        
        if not tickets.exists():
            return Response(
                {'error': 'No tickets found with the provided IDs'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Send the bulk confirmation email
        try:
            EmailService.send_bulk_ticket_confirmation(
                tickets=list(tickets),
                coordinator_name=coordinator_name,
                coordinator_email=coordinator_email
            )
            return Response({
                'success': True,
                'message': f'Bulk confirmation email sent to {coordinator_email}',
                'ticket_count': tickets.count()
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to send email: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BulkUploadView(generics.CreateAPIView, generics.ListAPIView):
    """View for bulk upload operations"""
    queryset = BulkUpload.objects.all()
    serializer_class = BulkUploadSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return BulkUploadCreateSerializer
        return BulkUploadSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if not user.is_authenticated:
            return BulkUpload.objects.none()
        
        if user.role == User.Role.ADMIN:
            return BulkUpload.objects.all()
        else:
            return BulkUpload.objects.filter(uploaded_by=user)
    
    def create(self, request, *args, **kwargs):
        """Handle CSV file upload and processing"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        file = serializer.validated_data['file']
        
        # Create bulk upload record
        bulk_upload = BulkUpload.objects.create(
            uploaded_by=request.user,
            filename=file.name,
            file=file,
            status=BulkUpload.Status.PENDING
        )
        
        # Process in background (simplified synchronous processing for now)
        try:
            self.process_csv(bulk_upload)
            bulk_upload.status = BulkUpload.Status.COMPLETED
            bulk_upload.processed_at = timezone.now()
        except Exception as e:
            bulk_upload.status = BulkUpload.Status.FAILED
            bulk_upload.error_log = str(e)
        
        bulk_upload.save()
        
        return Response(
            BulkUploadSerializer(bulk_upload).data,
            status=status.HTTP_201_CREATED
        )
    
    def process_csv(self, bulk_upload):
        """Process CSV file and create tickets"""
        file_content = bulk_upload.file.read().decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(file_content))
        
        successful = 0
        failed = 0
        errors = []
        
        for i, row in enumerate(csv_reader, start=1):
            try:
                # Map CSV columns to ticket fields
                ticket_data = {
                    'full_name': row.get('full_name', ''),
                    'age': int(row.get('age', 0)),
                    'category': row.get('category', ''),
                    'gender': row.get('gender', ''),
                    'phone': row.get('phone', ''),
                    'email': row.get('email', ''),
                    'province': row.get('province', ''),
                    'zone': row.get('zone', ''),
                    'area': row.get('area', ''),
                    'parish': row.get('parish', ''),
                    'department': row.get('department', ''),
                    'medical_conditions': row.get('medical_conditions', ''),
                    'medications': row.get('medications', ''),
                    'dietary_restrictions': row.get('dietary_restrictions', ''),
                    'emergency_contact': row.get('emergency_contact', ''),
                    'emergency_phone': row.get('emergency_phone', ''),
                    'emergency_relationship': row.get('emergency_relationship', ''),
                    'parent_name': row.get('parent_name', ''),
                    'parent_email': row.get('parent_email', ''),
                    'parent_phone': row.get('parent_phone', ''),
                    'parent_relationship': row.get('parent_relationship', ''),
                }
                
                # Create ticket
                serializer = TicketCreateSerializer(data=ticket_data)
                if serializer.is_valid():
                    ticket = serializer.save(
                        registered_by=bulk_upload.uploaded_by,
                        registered_at=timezone.now()
                    )
                    
                    # Create audit log for bulk upload
                    TicketAuditLog.objects.create(
                        user=bulk_upload.uploaded_by,
                        action=TicketAuditLog.ActionType.BULK_UPLOAD,
                        ticket=ticket,
                        bulk_upload=bulk_upload,
                        ip_address=self.get_client_ip(self.request),
                        user_agent=self.request.META.get('HTTP_USER_AGENT', '')
                    )
                    
                    # Send confirmation email
                    try:
                        EmailService.send_ticket_confirmation(ticket)
                    except Exception as e:
                        errors.append(f"Row {i}: Email failed - {str(e)}")
                        # Don't fail the row just because email failed, but log it
                    
                    successful += 1
                else:
                    errors.append(f"Row {i}: {serializer.errors}")
                    failed += 1
                    
            except Exception as e:
                errors.append(f"Row {i}: {str(e)}")
                failed += 1
        
        bulk_upload.total_records = i if 'i' in locals() else 0
        bulk_upload.successful_records = successful
        bulk_upload.failed_records = failed
        
        if successful > 0 and failed > 0:
            bulk_upload.status = BulkUpload.Status.PARTIAL
        elif failed == bulk_upload.total_records:
            bulk_upload.status = BulkUpload.Status.FAILED
        
        bulk_upload.error_log = '\n'.join(errors) if errors else ''
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class DashboardView(APIView):
    """Dashboard statistics view"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        queryset = Ticket.objects.all()
        
        # Apply province filter for coordinators
        if user.role == User.Role.COORDINATOR:
            queryset = queryset.filter(province=user.province)
        
        # Calculate statistics
        total_tickets = queryset.count()
        pending_tickets = queryset.filter(status=Ticket.Status.PENDING).count()
        approved_tickets = queryset.filter(status=Ticket.Status.APPROVED).count()
        rejected_tickets = queryset.filter(status=Ticket.Status.REJECTED).count()
        
        # Category counts
        pre_teens_count = queryset.filter(category=Ticket.Category.PRE_TEENS).count()
        teens_count = queryset.filter(category=Ticket.Category.TEENS).count()
        
        # Gender counts
        male_count = queryset.filter(gender=Ticket.Gender.MALE).count()
        female_count = queryset.filter(gender=Ticket.Gender.FEMALE).count()
        
        # Province statistics (only for admins)
        province_stats = {}
        if user.role == User.Role.ADMIN:
            province_data = queryset.values('province').annotate(
                total=Count('id'),
                pending=Count('id', filter=Q(status=Ticket.Status.PENDING)),
                approved=Count('id', filter=Q(status=Ticket.Status.APPROVED)),
                rejected=Count('id', filter=Q(status=Ticket.Status.REJECTED))
            )
            
            for item in province_data:
                province_stats[item['province']] = {
                    'total': item['total'],
                    'pending': item['pending'],
                    'approved': item['approved'],
                    'rejected': item['rejected']
                }
        
        # Recent tickets (last 10)
        recent_tickets = queryset.order_by('-registered_at')[:10]
        
        # Recent activity (last 10 audit logs)
        if user.role == User.Role.ADMIN:
            recent_activity = TicketAuditLog.objects.all().order_by('-timestamp')[:10]
        else:
            recent_activity = TicketAuditLog.objects.filter(
                Q(user=user) | Q(ticket__in=queryset)
            ).order_by('-timestamp')[:10]
        
        # Serialize data
        data = {
            'total_tickets': total_tickets,
            'pending_tickets': pending_tickets,
            'approved_tickets': approved_tickets,
            'rejected_tickets': rejected_tickets,
            'pre_teens_count': pre_teens_count,
            'teens_count': teens_count,
            'male_count': male_count,
            'female_count': female_count,
            'province_stats': province_stats,
            'recent_tickets': TicketSerializer(recent_tickets, many=True).data,
            'recent_activity': TicketAuditLogSerializer(recent_activity, many=True).data
        }
        
        # Use simple Response instead of serializer to avoid issues
        return Response(data)


class TicketAuditLogView(generics.ListAPIView):
    """View for ticket audit logs"""
    serializer_class = TicketAuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        queryset = TicketAuditLog.objects.all()
        
        # Filter by ticket ID
        ticket_id = self.request.query_params.get('ticket_id')
        if ticket_id:
            queryset = queryset.filter(ticket__ticket_id=ticket_id)
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(timestamp__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__lte=end_date)
        
        return queryset.order_by('-timestamp')
    
    
class CheckInRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing check-in records"""
    queryset = CheckInRecord.objects.all()
    serializer_class = CheckInRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if not user.is_authenticated:
            return CheckInRecord.objects.none()
        
        queryset = CheckInRecord.objects.all()
        
        # Apply filters
        ticket_id = self.request.query_params.get('ticket_id')
        if ticket_id:
            queryset = queryset.filter(ticket__ticket_id=ticket_id)
        
        date = self.request.query_params.get('date')
        if date:
            queryset = queryset.filter(checked_in_at__date=date)
        
        method = self.request.query_params.get('method')
        if method:
            queryset = queryset.filter(check_in_method=method)
        
        # User-based filtering
        if user.role == user.Role.COORDINATOR:
            # Coordinators can see check-ins for tickets from their province
            queryset = queryset.filter(ticket__province=user.province)
        elif user.role == user.Role.ADMIN:
            # Admins see all
            pass
        else:
            # Regular users see only their own check-ins (if they're check-in staff)
            queryset = queryset.filter(checked_in_by=user)
        
        return queryset.order_by('-checked_in_at')


class CheckInDashboardView(APIView):
    """Dashboard for check-in statistics"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        queryset = CheckInRecord.objects.all()
        
        # Apply province filter for coordinators
        if user.role == user.Role.COORDINATOR:
            queryset = queryset.filter(ticket__province=user.province)
        
        # Get today's date
        today = timezone.now().date()
        
        # Calculate statistics
        total_check_ins = queryset.count()
        today_check_ins = queryset.filter(checked_in_at__date=today).count()
        
        # By method
        by_method = queryset.values('check_in_method').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # By hour (for today)
        today_by_hour = queryset.filter(
            checked_in_at__date=today
        ).extra({
            'hour': "EXTRACT(HOUR FROM checked_in_at)"
        }).values('hour').annotate(
            count=Count('id')
        ).order_by('hour')
        
        # Recent check-ins
        recent_check_ins = queryset.select_related('ticket', 'checked_in_by').order_by('-checked_in_at')[:20]
        
        data = {
            'overview': {
                'total_check_ins': total_check_ins,
                'today_check_ins': today_check_ins,
                'unique_tickets_checked_in': queryset.values('ticket').distinct().count(),
            },
            'by_method': list(by_method),
            'today_by_hour': list(today_by_hour),
            'recent_check_ins': CheckInRecordSerializer(recent_check_ins, many=True).data,
        }
        
        return Response(data)