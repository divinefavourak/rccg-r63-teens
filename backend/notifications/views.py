"""
Notification API — the inbox, the preferences screen, push registration.

Every route is owner-scoped. There is deliberately no "send" endpoint: features
send through `notifications.services.send`, never over HTTP, because §10 requires
that the ladder, quiet-hours and cap rules cannot be routed around — and an HTTP
send endpoint is exactly a way to route around them.
"""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Notification
from .serializers import (
    MarkReadSerializer, NotificationPreferenceSerializer, NotificationSerializer,
    PushSubscriptionSerializer,
)


class NotificationViewSet(mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          mixins.DestroyModelMixin,
                          viewsets.GenericViewSet):
    """The in-app inbox. Every push is mirrored here (`docs/07` §10)."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['notification_type', 'rung']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Notification.objects.none()
        # Scoped to the requester, so another user's notification 404s rather than
        # 403s — a 403 would confirm the row exists.
        return services.inbox(self.request.user)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """The badge. Cheap enough to poll."""
        return Response({'unread_count': services.unread_count(request.user)})

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        """Mark the listed notifications read, or all of them if `ids` is omitted."""
        serializer = MarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ids = serializer.validated_data.get('ids')
        updated = services.mark_read(request.user, notification_ids=ids or None)
        return Response({
            'marked_read': updated,
            'unread_count': services.unread_count(request.user),
        })


class NotificationPreferenceView(RetrieveUpdateAPIView):
    """
    Settings → Notifications.

    Created lazily on first read, so a teen who has never opened this screen still
    has the documented defaults (Standard, quiet hours 21:30–06:00) applied to
    every send.
    """

    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return services.preferences_for(self.request.user)


class PushSubscriptionView(APIView):
    """
    Register or drop this browser's push endpoint.

    `POST` is an upsert on `endpoint`: a browser that re-subscribes (as they do
    after a service-worker update) must not accumulate duplicate rows and buzz the
    teen once per stale registration.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = PushSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        subscription = services.subscribe(
            request.user,
            endpoint=serializer.validated_data['endpoint'],
            p256dh=serializer.validated_data['p256dh'],
            auth=serializer.validated_data['auth'],
            user_agent=serializer.validated_data.get('user_agent', ''),
        )
        return Response(
            PushSubscriptionSerializer(subscription).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, *args, **kwargs):
        endpoint = request.data.get('endpoint')
        if not endpoint:
            return Response(
                {'detail': 'endpoint is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        services.unsubscribe(request.user, endpoint)
        return Response(status=status.HTTP_204_NO_CONTENT)
