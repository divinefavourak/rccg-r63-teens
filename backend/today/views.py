"""
The Today API — one call, one screen.

`GET  /api/v1/today/`                  the whole daily experience
`POST /api/v1/today/challenge/complete/` complete today's challenge inline
"""
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .serializers import TodaySerializer


class TodayView(APIView):
    """
    Everything the Today screen renders (`docs/07-feature-specifications.md` §4).

    Public. A guest gets the devotional, the Verse of the Day and the challenge,
    with the personal sections (streak, completion, continue-reading) null —
    Today is the first thing a curious teen sees, and gating it behind signup
    would waste the moment. Their reading position migrates on signup
    (`docs/08-bible-experience.md` §5).

    A pipeline gap (no devotional today) is a 200 with `has_devotional: false`,
    not a 404: the streak, the challenge and continue-reading are all still true,
    and the client renders the empty state from `docs/06-user-flows.md` flow 5.
    """

    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        payload = services.assemble(request.user)
        return Response(TodaySerializer(payload).data)


class CompleteChallengeView(APIView):
    """
    Complete today's challenge inline (`docs/07` §4: "completable inline …
    skippable without penalty").

    Idempotent: completing twice returns 200 with `already_completed: true` and
    logs nothing further. There is no "uncomplete" — and no penalty for skipping,
    so nothing here punishes an untouched challenge.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        challenge = services.todays_challenge(user=request.user)
        if challenge is None:
            return Response(
                {'detail': 'There is no challenge for today.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        _, created = services.complete_challenge(request.user, challenge)
        return Response({
            'challenge': str(challenge.id),
            'completed': True,
            'already_completed': not created,
        })
