from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from .models import Event, EventRegistration
from .event_serializers import (
    EventSerializer, EventListSerializer,
    EventRegistrationSerializer, EventRegistrationCreateSerializer
)
from users.permissions import CanManageEvents, CanRegisterForEvents, IsAdmin


class EventViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing events.
    
    Endpoints:
    - GET /events/ - List all events
    - GET /events/{id}/ - Get event details
    - POST /events/ - Create event (Admin only)
    - PUT /events/{id}/ - Update event (Admin only)
    - DELETE /events/{id}/ - Delete event (Admin only)
    - GET /events/upcoming/ - Get upcoming events
    - GET /events/featured/ - Get featured events
    - GET /events/{id}/registrations/ - Get event registrations
    - POST /events/{id}/register/ - Register for event
    """
    permission_classes = [IsAuthenticated, CanManageEvents]
    lookup_field = 'pk'
    
    def get_queryset(self):
        queryset = Event.objects.all()
        
        # Non-admin users only see published/open events
        if self.request.user.role != 'admin':
            queryset = queryset.exclude(status=Event.Status.DRAFT)
        
        # Filter by type
        event_type = self.request.query_params.get('type')
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter upcoming
        if self.request.query_params.get('upcoming') == 'true':
            queryset = queryset.filter(start_date__gte=timezone.now())
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return EventListSerializer
        return EventSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events"""
        limit = int(request.query_params.get('limit', 10))
        events = self.get_queryset().filter(
            start_date__gte=timezone.now()
        ).order_by('start_date')[:limit]
        serializer = EventListSerializer(events, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured events"""
        events = self.get_queryset().filter(is_featured=True)
        serializer = EventListSerializer(events, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def registrations(self, request, pk=None):
        """Get registrations for an event"""
        # Only admin and coordinator can view registrations
        if request.user.role not in ['admin', 'coordinator']:
            return Response(
                {'detail': 'You do not have permission to view registrations.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        event = self.get_object()
        registrations = event.registrations.all()
        
        # Coordinators can only see registrations from their province
        if request.user.role == 'coordinator':
            registrations = registrations.filter(
                Q(ticket__province=request.user.province) |
                Q(user__province=request.user.province)
            )
        
        # Filter by status
        reg_status = request.query_params.get('status')
        if reg_status:
            registrations = registrations.filter(status=reg_status)
        
        serializer = EventRegistrationSerializer(registrations, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanRegisterForEvents])
    def register(self, request, pk=None):
        """Register current user for an event"""
        event = self.get_object()
        
        # Check if already registered
        existing = EventRegistration.objects.filter(
            event=event,
            user=request.user
        ).first()
        
        if existing:
            return Response(
                {'detail': 'You are already registered for this event.', 'registration': EventRegistrationSerializer(existing).data},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = EventRegistrationCreateSerializer(
            data={'event': event.id, **request.data},
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        registration = serializer.save()
        
        return Response(
            EventRegistrationSerializer(registration).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['get'])
    def my_registration(self, request, pk=None):
        """Get current user's registration for this event"""
        event = self.get_object()
        registration = EventRegistration.objects.filter(
            event=event,
            user=request.user
        ).first()
        
        if registration:
            return Response(EventRegistrationSerializer(registration).data)
        return Response({'detail': 'Not registered'}, status=status.HTTP_404_NOT_FOUND)


class EventRegistrationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing event registrations.
    
    Endpoints:
    - GET /registrations/ - List registrations (filtered by user/role)
    - GET /registrations/{id}/ - Get registration details
    - POST /registrations/{id}/confirm/ - Confirm registration
    - POST /registrations/{id}/cancel/ - Cancel registration
    - POST /registrations/{id}/check-in/ - Check in registrant
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = EventRegistration.objects.all()
        
        # Teens and individuals can only see their own registrations
        if user.role in ['teen', 'individual']:
            queryset = queryset.filter(user=user)
        # Coordinators can see registrations from their province
        elif user.role == 'coordinator':
            queryset = queryset.filter(
                Q(ticket__province=user.province) |
                Q(user__province=user.province)
            )
        # Admins can see all
        
        # Filter by event
        event_id = self.request.query_params.get('event')
        if event_id:
            queryset = queryset.filter(event_id=event_id)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return EventRegistrationCreateSerializer
        return EventRegistrationSerializer
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a registration (Admin/Coordinator only)"""
        if request.user.role not in ['admin', 'coordinator']:
            return Response(
                {'detail': 'Permission denied.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        registration = self.get_object()
        registration.confirm()
        return Response(EventRegistrationSerializer(registration).data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a registration"""
        registration = self.get_object()
        
        # Users can only cancel their own registrations
        if request.user.role in ['teen', 'individual'] and registration.user != request.user:
            return Response(
                {'detail': 'You can only cancel your own registration.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        registration.cancel()
        return Response(EventRegistrationSerializer(registration).data)
    
    @action(detail=True, methods=['post'], url_path='check-in')
    def check_in(self, request, pk=None):
        """Check in a registrant (Admin/Coordinator only)"""
        if request.user.role not in ['admin', 'coordinator']:
            return Response(
                {'detail': 'Permission denied.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        registration = self.get_object()
        registration.check_in()
        return Response(EventRegistrationSerializer(registration).data)
    
    @action(detail=False, methods=['get'], url_path='my-registrations')
    def my_registrations(self, request):
        """Get current user's registrations"""
        registrations = EventRegistration.objects.filter(user=request.user)
        serializer = EventRegistrationSerializer(registrations, many=True)
        return Response(serializer.data)
