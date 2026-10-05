"""
The check-in API: today's events, scan a ticket, find one by name.

Every route needs `events.checkin` and nothing more. See `events/checkin.py` for
why that matters and for the rules; these views only translate HTTP.
"""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from identity.authorization import HasPermission
from identity.permissions_registry import Perm

from . import checkin

_PERMISSIONS = [IsAuthenticated, HasPermission(Perm.EVENTS_CHECKIN)]


def _event_payload(event):
    return {
        'id': str(event.pk),
        'title': event.title,
        'start_datetime': event.start_datetime,
        'end_datetime': event.end_datetime,
        'venue': event.venue,
        'city': event.city,
        'is_free': event.is_free,
        'max_attendees': event.max_attendees,
        **checkin.counts_for(event),
    }


def _event_for(request, event_id):
    """
    The event being checked in to, or 404.

    404 rather than 403 for an event outside the caller's reach, so the endpoint
    does not confirm which event ids exist.
    """
    return get_object_or_404(checkin.checkable_events(request.user), pk=event_id)


class CheckInTodayView(APIView):
    """Today's events for the "Check in" card. Empty means "No event today"."""

    permission_classes = _PERMISSIONS

    def get(self, request):
        events = checkin.events_today(request.user)
        return Response({'events': [_event_payload(event) for event in events]})


class CheckInScanView(APIView):
    """
    Scan (or type) one ticket code.

    Always 200 with an `outcome`: a cancelled or unpaid ticket is an answer for
    the volunteer, not a failed request. `counts` rides along so the counter on
    the scanner stays right without a second round trip on a slow connection.
    """

    permission_classes = _PERMISSIONS

    def post(self, request):
        event_id = request.data.get('event')
        if not event_id:
            return Response(
                {'detail': 'event is required.'}, status=status.HTTP_400_BAD_REQUEST)
        event = _event_for(request, event_id)

        method = request.data.get('method') or 'qr_scan'
        if method not in ('qr_scan', 'manual'):
            method = 'manual'

        result = checkin.scan(event, request.data.get('code'), request.user, method=method)
        result['counts'] = checkin.counts_for(event)
        return Response(result)


class CheckInSearchView(APIView):
    """Look a ticket up by name or number when there is no QR code to scan."""

    permission_classes = _PERMISSIONS

    def get(self, request):
        event_id = request.query_params.get('event')
        if not event_id:
            return Response(
                {'detail': 'event is required.'}, status=status.HTTP_400_BAD_REQUEST)
        event = _event_for(request, event_id)

        matches = checkin.search(event, request.query_params.get('q'))
        return Response({'results': [checkin.attendee(r) for r in matches]})
