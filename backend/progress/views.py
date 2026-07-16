"""
Progress read API — private, owner-only.

Everything here is scoped to `request.user`; there are no leaderboards and no
cross-user visibility (`docs/07-feature-specifications.md` §8). Writes happen via
`services.record_action` from feature apps, not through this API, so these
surfaces are read-only.

`ProgressSummaryView` is the one composition point: it joins Progress-owned
figures with Bible-owned reading stats. It reaches Bible only through
`bible.services` (a public bounded-context interface), never Bible tables — so
the foundational Progress domain stays free of any Bible dependency. This import
lives in the *view* layer, which nothing else imports, so it introduces no cycle
even once Bible later calls `progress.services` to emit actions.
"""
import calendar
import datetime

from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bible import services as bible_services
from common.dates import user_today

from . import services
from .models import ActionType, SpiritualAction
from .permissions import IsOwner
from .serializers import (
    CreatePauseSerializer, ProgressSummarySerializer, SpiritualActionSerializer,
    StreakPauseSerializer, StreakStateSerializer,
)


class StreakView(APIView):
    """The requester's current/longest streak."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        state = services.streak_for(request.user)
        return Response(StreakStateSerializer(state).data)


class ProgressSummaryView(APIView):
    """Composed progress snapshot for the Me → Progress screen."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        state = services.streak_for(user)
        counts = services.action_type_counts(user)
        reading = bible_services.reading_stats(user)

        data = {
            'current_streak': state.current_length,
            'longest_streak': state.longest_length,
            'last_active_on': state.last_active_on,
            'grace_balance': services.grace_balance(user),
            'devotionals_completed': counts.get(ActionType.DEVOTIONAL_COMPLETED, 0),
            'chapters_read': reading['distinct_chapters_read'],
            'books_read': reading['distinct_books_read'],
        }
        return Response(ProgressSummarySerializer(data).data)


class SpiritualActionViewSet(mixins.ListModelMixin,
                             mixins.RetrieveModelMixin,
                             viewsets.GenericViewSet):
    """The requester's spiritual-action history, newest first."""

    serializer_class = SpiritualActionSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filterset_fields = ['action_type', 'occurred_on']

    def get_queryset(self):
        return SpiritualAction.objects.filter(user=self.request.user)


class CalendarView(APIView):
    """
    Active days in a month, for the Progress heat-map. `?month=YYYY-MM`
    (defaults to the user's current month). Returns one entry per *day* the user
    did something, not per action.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        month_param = request.query_params.get('month')
        try:
            anchor = (
                datetime.datetime.strptime(month_param, '%Y-%m').date()
                if month_param else user_today(request.user)
            )
        except ValueError:
            return Response({'detail': 'month must be YYYY-MM.'}, status=400)

        first = anchor.replace(day=1)
        last = first.replace(day=calendar.monthrange(first.year, first.month)[1])
        days = services.active_days(request.user, first, last)
        return Response({'month': first.strftime('%Y-%m'), 'active_days': days})


class PauseStreakView(APIView):
    """Declare a proactive streak pause (Settings → Progress)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreatePauseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pause = services.pause_streak(
                request.user,
                serializer.validated_data['start_on'],
                serializer.validated_data['days'],
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(StreakPauseSerializer(pause).data, status=201)
