from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import Ticket, BulkUpload
from .serializers import (
    TicketSerializer, TicketStatusUpdateSerializer,
    BulkUploadSerializer, CSVUploadSerializer
)
from .permissions import IsAdminOrCoordinatorForProvince
from .filters import TicketFilter
from .services import TicketService, BulkUploadService, DashboardService

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated, IsAdminOrCoordinatorForProvince]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TicketFilter
    search_fields = ['full_name', 'phone', 'email', 'ticket_id']
    ordering_fields = ['registered_at', 'full_name', 'age']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if user.is_coordinator:
            queryset = queryset.filter(province=user.province)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(registered_by=self.request.user)
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update ticket status."""
        ticket = self.get_object()
        serializer = TicketStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check permissions
        if not (request.user.is_admin or 
                (request.user.is_coordinator and ticket.province == request.user.province)):
            return Response(
                {"detail": "You do not have permission to update this ticket."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update status using service
        ticket = TicketService.update_ticket_status(
            ticket,
            serializer.validated_data['status'],
            request.user,
            serializer.validated_data.get('rejection_reason')
        )
        
        return Response(TicketSerializer(ticket).data)
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Bulk create tickets from CSV."""
        if not request.user.is_coordinator:
            return Response(
                {"detail": "Only coordinators can perform bulk uploads."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = CSVUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        file = serializer.validated_data['file']
        
        try:
            # Process CSV file
            result = BulkUploadService.process_csv_file(file, request.user)
            
            # Create bulk upload record
            bulk_upload = BulkUpload.objects.create(
                file=file,
                uploaded_by=request.user,
                total_records=result['total'],
                successful_records=result['successful'],
                failed_records=result['failed'],
                errors=result['errors'],
                status='completed'
            )
            
            return Response({
                'message': 'Bulk upload processed successfully',
                'stats': {
                    'total': result['total'],
                    'successful': result['successful'],
                    'failed': result['failed']
                },
                'bulk_upload': BulkUploadSerializer(bulk_upload).data
            })
            
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class DashboardView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        if user.is_admin:
            stats = DashboardService.get_admin_stats()
            stats['recent_tickets'] = TicketSerializer(
                Ticket.objects.order_by('-registered_at')[:10],
                many=True
            ).data
        elif user.is_coordinator:
            stats = DashboardService.get_coordinator_stats(user)
            stats['recent_tickets'] = TicketSerializer(
                Ticket.objects.filter(province=user.province).order_by('-registered_at')[:10],
                many=True
            ).data
        else:
            return Response(
                {"detail": "You don't have access to dashboard."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return Response(stats)


class BulkUploadViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BulkUploadSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return BulkUpload.objects.filter(uploaded_by=self.request.user)