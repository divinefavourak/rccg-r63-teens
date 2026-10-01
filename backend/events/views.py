"""
Views for the events app (events, registrations, check-ins).
"""
from rest_framework import viewsets, generics, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from decimal import Decimal

from django.db.models import Count, Sum, Q
from django.db.models.functions import Coalesce

from identity.authorization import HasPermission, HasPermissionOrReadOnly, has_any_permission
from identity.permissions_registry import Perm
from content.views import get_age_group_filter
from . import notifications as event_notifications
from . import scoping
from .email_service import EventEmailService
from .models import Event, EventRegistration, BulkUpload, RegistrationAuditLog
from .serializers import (
    EventListSerializer,
    EventDetailSerializer,
    EventCreateUpdateSerializer,
    EventRegistrationListSerializer,
    EventRegistrationDetailSerializer,
    EventRegistrationCreateSerializer,
    EventRegistrationStatusUpdateSerializer,
    EventRegistrationCheckInSerializer,
    EventBulkUploadSerializer,
    EventBulkUploadCreateSerializer,
    RegistrationAuditLogSerializer,
    EventDashboardStatsSerializer,
)


class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for events."""
    
    queryset = Event.objects.all()
    permission_classes = [HasPermissionOrReadOnly(Perm.EVENTS_MANAGE)]
    lookup_field = 'pk'
    filterset_fields = ['status', 'event_type', 'registration_status', 'is_featured']
    search_fields = ['title', 'description', 'venue']
    ordering_fields = ['start_datetime', 'created_at', 'registration_count']
    ordering = ['-start_datetime']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return EventCreateUpdateSerializer
        elif self.action == 'list':
            return EventListSerializer
        return EventDetailSerializer
    
    def get_queryset(self):
        queryset = self.queryset

        # Annotate with live registration counts so the stored counter is never stale
        queryset = queryset.annotate(
            live_registration_count=Count(
                'registrations',
                filter=Q(registrations__status__in=['confirmed', 'checked_in']),
                distinct=True
            )
        )

        is_manager = has_any_permission(self.request.user, Perm.EVENTS_MANAGE)

        if is_manager:
            # A manager sees published events like anyone else, plus the
            # unpublished ones *inside their own subtree* — not every draft in the
            # region. This is the row-level scoping the backend audit (C2) said was
            # blocked until events carried a hierarchy node.
            queryset = queryset.filter(
                Q(status='published')
                | Q(pk__in=scoping.manageable_by(
                    Event.objects.exclude(status='published'), self.request.user,
                ).values('pk'))
            )
        else:
            queryset = queryset.filter(status='published')

        # Published events are scoped to the tree: a teen sees events at or above
        # their position (docs/07 §3). Applied to everyone, managers included —
        # a manager browsing the events list is browsing as a member of their own
        # part of the church.
        queryset = scoping.visible_to(queryset, self.request.user)

        # Non-leaders are additionally filtered to their age group.
        if not has_any_permission(self.request.user, Perm.EVENTS_VIEW):
            queryset = queryset.filter(get_age_group_filter(self.request.user))

        # Filter upcoming
        upcoming = self.request.query_params.get('upcoming')
        if upcoming == 'true':
            queryset = queryset.filter(end_datetime__gt=timezone.now())

        # Narrow to one node's subtree. Note what this *cannot* do: widen access.
        # It filters within what `visible_to` already allowed, so asking for another
        # province's node returns nothing rather than that province's events — which
        # is precisely what the old `?province=` filter got wrong (the client chose
        # whose data to read).
        node_id = self.request.query_params.get('node')
        if node_id:
            queryset = queryset.filter(scope_node__id=node_id)

        return queryset
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.increment_view_count()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events."""
        events = self.get_queryset().filter(
            end_datetime__gt=timezone.now()
        ).order_by('start_datetime')[:10]
        
        serializer = EventListSerializer(events, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured events."""
        events = self.get_queryset().filter(
            is_featured=True,
            end_datetime__gt=timezone.now()
        )[:5]
        
        serializer = EventListSerializer(events, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def register(self, request, pk=None):
        """Register for an event."""
        event = self.get_object()
        
        serializer = EventRegistrationCreateSerializer(
            data={**request.data, 'event': event.id},
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        registration = serializer.save()

        # E-mail is the transactional fallback (docs/07 §10); push + inbox are the
        # primary channel. Both, not either.
        EventEmailService.send_registration_confirmation(registration)
        event_notifications.notify_registration_received(registration)

        return Response(
            EventRegistrationDetailSerializer(registration).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(
        detail=True, 
        methods=['get'], 
        permission_classes=[permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    )
    def registrations(self, request, pk=None):
        """Get registrations for an event (coordinators/admins only)."""
        event = self.get_object()
        registrations = event.registrations.all()
        
        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            registrations = registrations.filter(status=status_filter)
        
        payment_status = request.query_params.get('payment_status')
        if payment_status:
            registrations = registrations.filter(payment_status=payment_status)
        
        search = request.query_params.get('search')
        if search:
            registrations = registrations.filter(
                Q(attendee_name__icontains=search) |
                Q(attendee_email__icontains=search) |
                Q(registration_id__icontains=search)
            )
        
        # Five COUNTs collapsed into one conditional aggregate. This runs
        # alongside the paginator's own COUNT and the page query, so it was six
        # round trips on a screen that shows one table.
        stats = registrations.aggregate(
            total=Count('id'),
            confirmed=Count('id', filter=Q(status='confirmed')),
            pending=Count('id', filter=Q(status='pending')),
            cancelled=Count('id', filter=Q(status='cancelled')),
            checked_in=Count('id', filter=Q(status='checked_in')),
        )

        page = self.paginate_queryset(registrations)
        if page is not None:
            serializer = EventRegistrationListSerializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['stats'] = stats
            return response
        
        serializer = EventRegistrationListSerializer(registrations, many=True)
        return Response({
            'stats': stats,
            'results': serializer.data
        })
    
    @action(
        detail=True,
        methods=['get'],
        permission_classes=[permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    )
    def dashboard(self, request, pk=None):
        """Get dashboard stats for an event."""
        event = self.get_object()

        # One pass over the registrations instead of nine.
        #
        # Each of these was a separate .count() or .aggregate() on the same
        # queryset — nine round trips to compute nine numbers from one table.
        # Conditional aggregation gets them all in a single GROUP-BY-less scan,
        # which matters most on exactly the connection this product runs over.
        stats = event.registrations.aggregate(
            total_registrations=Count('id'),
            confirmed_count=Count('id', filter=Q(status='confirmed')),
            pending_count=Count('id', filter=Q(status='pending')),
            cancelled_count=Count('id', filter=Q(status='cancelled')),
            waitlisted_count=Count('id', filter=Q(status='waitlisted')),
            checked_in_count=Count('id', filter=Q(status='checked_in')),
            paid_count=Count('id', filter=Q(payment_status='paid')),
            unpaid_count=Count('id', filter=Q(payment_status='pending')),
            total_revenue=Coalesce(
                Sum('amount_paid', filter=Q(payment_status='paid')),
                Decimal('0'),
            ),
        )

        serializer = EventDashboardStatsSerializer(stats)
        return Response(serializer.data)


class EventRegistrationViewSet(viewsets.ModelViewSet):
    """ViewSet for event registrations."""
    
    queryset = EventRegistration.objects.select_related('event', 'user', 'profile').all()
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'pk'
    filterset_fields = ['status', 'payment_status', 'event']
    search_fields = ['registration_id', 'attendee_name', 'attendee_email']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return EventRegistrationCreateSerializer
        elif self.action == 'list':
            return EventRegistrationListSerializer
        return EventRegistrationDetailSerializer
    
    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), HasPermission(Perm.EVENTS_MANAGE)()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        registration = serializer.save()
        EventEmailService.send_registration_confirmation(registration)
        event_notifications.notify_registration_received(registration)
    
    def get_queryset(self):
        user = self.request.user
        # Event managers see all registrations; everyone else only their own.
        # (Finer node-scoped visibility follows when EventRegistration carries an
        # organization_node — see phase1-completion notes.)
        if has_any_permission(user, Perm.EVENTS_MANAGE):
            return self.queryset
        return self.queryset.filter(user=user)
    
    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Get current user's registrations."""
        registrations = EventRegistration.objects.filter(
            user=request.user
        ).select_related('event').order_by('-created_at')
        serializer = EventRegistrationDetailSerializer(registrations, many=True)
        return Response(serializer.data)
    
    @action(
        detail=True, 
        methods=['post'], 
        permission_classes=[permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    )
    def update_status(self, request, pk=None):
        """Update registration status."""
        registration = self.get_object()
        
        serializer = EventRegistrationStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        old_status = registration.status
        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')
        
        if new_status == 'confirmed':
            registration.confirm(request.user)
        elif new_status == 'cancelled':
            registration.cancel(request.user, notes)
        else:
            registration.status = new_status
            registration.save()

        # Create audit log
        RegistrationAuditLog.objects.create(
            registration=registration,
            user=request.user,
            action='status_change',
            old_values={'status': old_status},
            new_values={'status': new_status},
        )

        # Send email notification
        if new_status == 'confirmed':
            EventEmailService.send_registration_confirmed(registration)
            event_notifications.notify_registration_confirmed(registration)
        else:
            EventEmailService.send_status_update(registration, old_status, new_status)
            event_notifications.notify_status_changed(
                registration, old_status, new_status)

        return Response(EventRegistrationDetailSerializer(registration).data)
    
    @action(
        detail=True,
        methods=['post'],
        permission_classes=[permissions.IsAuthenticated, HasPermission(Perm.EVENTS_CHECKIN)]
    )
    def check_in(self, request, pk=None):
        """Check in an attendee."""
        registration = self.get_object()
        
        serializer = EventRegistrationCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        registration.check_in(
            user=request.user,
            method=serializer.validated_data.get('method', 'manual'),
            notes=serializer.validated_data.get('notes', '')
        )
        
        # Create audit log
        RegistrationAuditLog.objects.create(
            registration=registration,
            user=request.user,
            action='check_in',
            new_values={
                'checked_in_at': str(registration.checked_in_at),
                'method': registration.check_in_method
            },
        )
        
        return Response(EventRegistrationDetailSerializer(registration).data)
    
    @action(detail=True, methods=['get'])
    def qr_code(self, request, pk=None):
        """Get QR code for registration."""
        registration = self.get_object()
        
        # TODO: Generate QR code if not exists
        
        if registration.qr_code:
            return Response({
                'qr_code': request.build_absolute_uri(registration.qr_code.url)
            })
        
        return Response(
            {'detail': 'QR code not generated yet.'},
            status=status.HTTP_404_NOT_FOUND
        )


class EventBulkUploadViewSet(viewsets.ModelViewSet):
    """ViewSet for event bulk uploads."""
    
    queryset = BulkUpload.objects.select_related('event', 'uploaded_by').all()
    permission_classes = [permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    lookup_field = 'pk'
    filterset_fields = ['status', 'event']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return EventBulkUploadCreateSerializer
        return EventBulkUploadSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if has_any_permission(user, Perm.EVENTS_MANAGE):
            return self.queryset
        # Non-managers see only their own uploads.
        return self.queryset.filter(uploaded_by=user)
    
    def perform_create(self, serializer):
        upload = serializer.save()
        # TODO: Trigger async processing via Celery
        # process_bulk_upload.delay(upload.id)


class RegistrationAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing registration audit logs."""
    
    queryset = RegistrationAuditLog.objects.select_related('registration', 'user').all()
    serializer_class = RegistrationAuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    filterset_fields = ['registration', 'action']
    ordering = ['-timestamp']
    
    def get_queryset(self):
        user = self.request.user
        
        if has_any_permission(user, Perm.EVENTS_MANAGE):
            return self.queryset
        # Audit logs are leader-only.
        return self.queryset.none()
