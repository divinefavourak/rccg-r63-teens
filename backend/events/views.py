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
from common.view_counts import count_view
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import ProtectedError

from . import bedspaces
from . import checkin
from . import notifications as event_notifications
from . import scoping
from .email_service import EventEmailService
from .models import Event, EventRegistration, BulkUpload, Hostel, RegistrationAuditLog
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
    HostelSerializer,
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
        # ...and with the places taken, which is what capacity is decided on
        # (`Event.places_taken`): without it `is_full` and `spots_remaining`
        # would each count per event.
        # EventListSerializer names the owning node on every row.
        queryset = queryset.select_related('scope_node').annotate(
            live_registration_count=Count(
                'registrations',
                filter=Q(registrations__status__in=EventRegistration.COUNTED),
                distinct=True
            ),
            live_places_taken=Count(
                'registrations',
                filter=Q(registrations__status__in=EventRegistration.HOLDS_A_PLACE),
                distinct=True
            ),
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
        #
        # A manager also oversees: they see the events owned inside the subtree
        # they manage, wherever they personally belong. Without this a Regional
        # Coordinator who worships in one province could not open another
        # province's events, which is the job.
        if is_manager:
            user = self.request.user
            queryset = queryset.filter(
                Q(pk__in=scoping.visible_to(Event.objects.all(), user).values('pk'))
                | Q(pk__in=scoping.manageable_by(Event.objects.all(), user).values('pk'))
            )
        else:
            queryset = scoping.visible_to(queryset, self.request.user)

        # Non-leaders are additionally filtered to their age group.
        if not has_any_permission(self.request.user, Perm.EVENTS_VIEW):
            queryset = queryset.filter(get_age_group_filter(self.request.user))

        # Filter upcoming
        # `upcoming=true` is everything that has not finished; `upcoming=false`
        # is everything that has, which is the Console's "Past" tab.
        upcoming = self.request.query_params.get('upcoming')
        if upcoming == 'true':
            queryset = queryset.filter(end_datetime__gt=timezone.now())
        elif upcoming == 'false':
            queryset = queryset.filter(end_datetime__lte=timezone.now())

        # Narrow to one node's subtree. Note what this *cannot* do: widen access.
        # It filters within what `visible_to` already allowed, so asking for another
        # province's node returns nothing rather than that province's events — which
        # is precisely what the old `?province=` filter got wrong (the client chose
        # whose data to read).
        node_id = self.request.query_params.get('node')
        if node_id:
            from hierarchy.models import HierarchyNode
            try:
                node = HierarchyNode.objects.filter(pk=node_id).first()
            except (ValueError, DjangoValidationError):
                node = None
            if node is None:
                return queryset.none()
            # The node and everything beneath it, as the comment above says.
            # It used to match the one node only.
            queryset = queryset.filter(scope_node__path__startswith=node.path)

        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        count_view(request, instance)
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
        registrations = event.registrations.select_related('event', 'bed', 'bed__hostel').all()

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
    def bedspaces(self, request, pk=None):
        """Hostels, how full each is, and how many people have no bed."""
        return Response(bedspaces.summary(self.get_object()))

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    )
    def place_waiting(self, request, pk=None):
        """
        Try again for everyone without a bed, oldest registration first: what
        the organiser runs after adding a hostel or releasing reserved beds.
        """
        event = self.get_object()
        placed = bedspaces.place_waiting(event)
        return Response({'placed': placed, **bedspaces.summary(event)})

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


def own_registrations(user):
    """
    The registrations that belong to ``user``: filed under their account, or
    made for their email address.

    Email counts because it is how this app identifies a person. A leader may
    register a teen before the teen has an account, or (before this was fixed)
    the place was filed under the leader's account; either way the teen should
    still find their ticket.
    """
    match = Q(user=user)
    if user.email:
        match |= Q(attendee_email__iexact=user.email)
    return EventRegistration.objects.filter(match)


# What the older check-in route says when `checkin.scan` refuses a ticket.
_CHECK_IN_REFUSALS = {
    checkin.ALREADY_CHECKED_IN: 'This ticket has already been checked in.',
    checkin.CANCELLED: 'This registration was cancelled.',
    checkin.WAITLISTED: 'This registration is on the waitlist.',
    checkin.NOT_PAID: 'This ticket has not been paid for.',
}


class EventRegistrationViewSet(viewsets.ModelViewSet):
    """ViewSet for event registrations."""

    queryset = EventRegistration.objects.select_related(
        'event', 'event__scope_node', 'user', 'profile', 'bed', 'bed__hostel').all()
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
            queryset = self.queryset
            # `?person=<user id>`: everything one person registered for, or was
            # registered for under their email. For the Console's member panel.
            person = self.request.query_params.get('person')
            if person:
                from django.contrib.auth import get_user_model
                try:
                    owner = get_user_model().objects.filter(pk=person).first()
                except (ValueError, DjangoValidationError):
                    owner = None
                if owner is None:
                    return queryset.none()
                queryset = queryset.filter(pk__in=own_registrations(owner).values('pk'))
            return queryset
        return self.queryset.filter(pk__in=own_registrations(user).values('pk'))

    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Get current user's registrations."""
        registrations = own_registrations(request.user).select_related(
            'event', 'event__scope_node'
        ).order_by('-created_at')
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

        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')

        if new_status == 'confirmed':
            old_status = registration.confirm(request.user)
        elif new_status == 'cancelled':
            old_status = registration.cancel(request.user, notes)
        else:
            old_status = registration.set_status(new_status)

        if old_status is None:
            # Already there: a double tap, or two leaders at once. Nothing
            # changed, so there is nothing to log and nobody to tell again.
            return Response(EventRegistrationDetailSerializer(registration).data)

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

        # Through the same door as the scanner, so both apply one set of rules
        # under one row lock: a ticket cannot be checked in twice, and a
        # cancelled, waitlisted or unpaid one is refused. `scan` also writes the
        # audit row and tells the teen.
        result = checkin.scan(
            registration.event,
            registration.registration_id,
            request.user,
            method=serializer.validated_data.get('method', 'manual'),
            notes=serializer.validated_data.get('notes', ''),
        )

        if result['outcome'] != checkin.CHECKED_IN:
            return Response(
                {
                    'detail': _CHECK_IN_REFUSALS.get(
                        result['outcome'], 'This ticket cannot be checked in.'),
                    'outcome': result['outcome'],
                },
                status=status.HTTP_409_CONFLICT,
            )

        registration.refresh_from_db()
        return Response(EventRegistrationDetailSerializer(registration).data)

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    )
    def assign_bed(self, request, pk=None):
        """Place this person in a named hostel, giving up any bed they had."""
        registration = self.get_object()
        hostel = Hostel.objects.filter(
            pk=request.data.get('hostel'), event_id=registration.event_id).first()
        if hostel is None:
            return Response({'hostel': ['Choose one of this event\'s hostels.']},
                            status=status.HTTP_400_BAD_REQUEST)
        if registration.status not in EventRegistration.HOLDS_A_PLACE:
            return Response(
                {'detail': 'Only someone who holds a place at the event can be given a bed.'},
                status=status.HTTP_400_BAD_REQUEST)
        try:
            bedspaces.move(registration, hostel, assigned_by=request.user)
        except DjangoValidationError as exc:
            return Response({'detail': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        registration = self.get_queryset().get(pk=registration.pk)
        return Response(EventRegistrationDetailSerializer(registration).data)

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    )
    def release_bed(self, request, pk=None):
        """Take this person's bed back. They keep their place at the event."""
        registration = self.get_object()
        bedspaces.release(registration)
        registration = self.get_queryset().get(pk=registration.pk)
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


class HostelViewSet(viewsets.ModelViewSet):
    """
    The hostels of an event, for the people who manage it.

    `GET /events/hostels/?event=<id>`. Only hostels of events the caller may
    manage are visible, and a new one can only be added to such an event.
    """

    serializer_class = HostelSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission(Perm.EVENTS_MANAGE)]
    filterset_fields = ['event', 'gender']
    pagination_class = None

    def _manageable_events(self):
        user = self.request.user
        if user.is_superuser:
            return Event.objects.all()
        # Unscoped (legacy) events belong to nobody's subtree; whoever manages
        # events anywhere may set them up, as they may edit them.
        return Event.objects.filter(
            Q(pk__in=scoping.manageable_by(Event.objects.all(), user).values('pk'))
            | Q(scope_node__isnull=True)
        )

    def get_queryset(self):
        return (
            Hostel.objects.filter(event__in=self._manageable_events())
            .select_related('event').order_by('code')
        )

    def perform_create(self, serializer):
        event = serializer.validated_data['event']
        if not self._manageable_events().filter(pk=event.pk).exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You cannot set up hostels for this event.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': 'People are placed in this hostel. Move them out before removing it.'},
                status=status.HTTP_409_CONFLICT,
            )
