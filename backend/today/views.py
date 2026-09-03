"""
The Today API — one call, one screen.

`GET  /api/v1/today/`                  the whole daily experience
`POST /api/v1/today/challenge/complete/` complete today's challenge inline
"""
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone as dj_timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.dates import app_timezone, app_today, day_bounds

from . import services
from .serializers import TodayPersonalSerializer, TodaySharedSerializer


def _seconds_until_midnight():
    """TTL that expires exactly when the content it holds stops being today's.

    A fixed TTL would either serve yesterday's devotional past midnight or expire
    pointlessly early. day_bounds is the app-timezone helper, so the rollover is a
    Lagos midnight, not a UTC one — the same distinction common/dates.py exists
    to enforce.
    """
    _, end = day_bounds(app_today())
    remaining = (end - dj_timezone.now()).total_seconds()
    # Floor at a minute so a request landing a hair before midnight cannot write
    # a zero or negative TTL.
    return max(60, int(remaining))


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
        user = request.user
        on = app_today()
        now = dj_timezone.now().astimezone(app_timezone())

        # The shared half — devotional, Verse of the Day, Scripture cards,
        # challenge — is one editorial decision per day, per age group. It was
        # being rebuilt from scratch on every request to the busiest endpoint in
        # the product. Cached under (day, age group), which is a handful of
        # entries serving every teen in the region.
        #
        # Cache reads fail open: CACHES sets IGNORE_EXCEPTIONS, so an unreachable
        # Redis returns None here and the payload is simply rebuilt.
        age_group = services.age_group_for(user) or 'all'
        key = f'today:v{settings.CACHE_VERSION}:{on.isoformat()}:{age_group}'

        shared = cache.get(key)
        if shared is None:
            shared = TodaySharedSerializer(services.shared_payload(user, on=on)).data
            cache.set(key, shared, _seconds_until_midnight())

        # The completion checks need only the two primary keys, and the cached
        # payload already carries them — so a cache hit rebuilds nothing.
        personal = services.personal_payload(
            user,
            challenge_id=(shared.get('challenge') or {}).get('id'),
            devotional_id=(shared.get('devotional') or {}).get('id'),
            on=on,
        )

        return Response({
            **shared,
            'greeting': services.greeting_for(now.hour),
            **TodayPersonalSerializer(personal).data,
        })


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
