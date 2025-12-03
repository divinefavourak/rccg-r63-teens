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

from .models import Ticket, BulkUpload, TicketAuditLog
from .serializers import (
    TicketSerializer, TicketCreateSerializer, TicketUpdateSerializer,
    TicketStatusUpdateSerializer, BulkUploadSerializer,
    BulkUploadCreateSerializer, TicketAuditLogSerializer,
)
from .permissions import TicketPermission, CanApproveTicket
from .utils import UUIDEncoder, convert_uuid_to_string
from users.permissions import IsAdmin, IsCoordinator, ProvinceAccessPermission

User = get_user_model()

class TicketViewSet(viewsets.ModelViewSet):
    """ViewSet for Ticket management"""
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [TicketPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'full_name', 'ticket_id', 'email', 'phone',
        'province', 'zone', 'area', 'parish'
    ]
    ordering_fields = ['registered_at', 'full_name', 'age', 'status']
    ordering = ['-registered_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TicketCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TicketUpdateSerializer
        return TicketSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if not user.is_authenticated:
            return Ticket.objects.none()
        
        queryset = Ticket.objects.all()
        
        # Apply filters from query parameters
        status_filter = self.request.query_params.get('status')
        province_filter = self.request.query_params.get('province')
        category_filter = self.request.query_params.get('category')
        gender_filter = self.request.query_params.get('gender')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        if province_filter:
            queryset = queryset.filter(province=province_filter)
        
        if category_filter:
            queryset = queryset.filter(category=category_filter)
        
        if gender_filter:
            queryset = queryset.filter(gender=gender_filter)
        
        # Apply role-based filtering
        if user.role == User.Role.COORDINATOR:
            queryset = queryset.filter(province=user.province)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Create a ticket and return full ticket data"""
        # Use the create serializer for validation
        create_serializer = self.get_serializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        
        # Create the ticket
        ticket = create_serializer.save(
            registered_by=request.user,
            registered_at=timezone.now()
        )
        
        # Create audit log
        ticket_data = TicketSerializer(ticket).data
        ticket_data = convert_uuid_to_string(ticket_data)
        
        TicketAuditLog.objects.create(
            user=request.user,
            action=TicketAuditLog.ActionType.CREATE,
            ticket=ticket,
            new_values=ticket_data,
            ip_address=self.get_client_ip(),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # Return the full ticket data using the main serializer
        serializer = TicketSerializer(ticket)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
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