"""
Aggregate counts for the Console's Analytics screen.

Why this lives in `identity` rather than its own app: every figure is scoped by
the caller's authority, and the scoping rules are `identity.authorization`'s. An
`analytics` app would import identity for scoping and each domain app for
models, which is a dependency knot for one endpoint.

**Aggregated in the database, never in Python.** The point of this endpoint is
that a Regional Coordinator can ask "how many registrations across my region"
without downloading every row — which is exactly what the Console was doing
client-side before it existed.

Every section is gated on the permission for the data it reports, and simply
omitted when the caller lacks it. A partial answer is honest; a zero where the
caller has no visibility is a lie.
"""
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import authorization as authz
from .models import Membership
from .permissions_registry import Perm


class ConsoleStatsView(APIView):
    """
    `GET /api/v1/identity/stats/`

    Optional `?days=30` bounds the time-bounded figures. Counts reflect the
    caller's scope: two coordinators asking the same question at different nodes
    get different, equally correct answers.
    """
    permission_classes = [IsAuthenticated]

    # Short TTL rather than event-driven invalidation. These are trend figures on
    # a dashboard someone leaves open, not a record anyone acts on to the second,
    # and the alternative — invalidating on every registration, membership and
    # content write — would cost more than it saves. A minute of staleness is
    # invisible; 16 uncached queries per poll over a ~184ms link is not.
    CACHE_TTL = 60

    def get(self, request):
        user = request.user
        try:
            days = max(1, min(365, int(request.query_params.get('days', 30))))
        except (TypeError, ValueError):
            days = 30

        # Keyed by user, because every figure is scoped to the caller's authority
        # — two coordinators must never see each other's numbers — and by the
        # authority version, so a role change re-scopes the cached answer rather
        # than serving one computed under the old authority.
        cache_key = (
            f'console-stats:v{settings.CACHE_VERSION}'
            f':a{authz.authz_version()}:u{user.pk}:d{days}'
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        since = timezone.now() - timedelta(days=days)

        payload = {'days': days, 'scope': None, 'sections': {}}

        # Name the scope so the client can caption the numbers. Without this a
        # count of 40 is unreadable — 40 out of where?
        node = _primary_node(user)
        if node:
            payload['scope'] = {'id': str(node.id), 'name': node.name,
                                'node_type': node.node_type}

        if authz.has_any_permission(user, Perm.MEMBERSHIPS_VIEW):
            payload['sections']['people'] = self._people(user)

        if authz.has_any_permission(user, Perm.EVENTS_VIEW):
            payload['sections']['events'] = self._events(user, since)

        if authz.has_any_permission(user, Perm.CONTENT_VIEW):
            payload['sections']['content'] = self._content(user)

        cache.set(cache_key, payload, self.CACHE_TTL)
        return Response(payload)

    # -- sections ----------------------------------------------------------

    def _people(self, user):
        qs = authz.scope_queryset(
            Membership.objects.filter(is_active=True), user,
            Perm.MEMBERSHIPS_VIEW, node_field='organization_node',
        )
        by_node = list(
            qs.values('organization_node__name', 'organization_node__node_type')
              .annotate(count=Count('id'))
              .order_by('-count')[:10]
        )
        return {
            'total': qs.count(),
            'by_node': [
                {'name': r['organization_node__name'],
                 'node_type': r['organization_node__node_type'],
                 'count': r['count']}
                for r in by_node
            ],
        }

    def _events(self, user, since):
        from events.models import Event, EventRegistration
        from events.scoping import visible_to

        events = visible_to(Event.objects.all(), user)
        regs = EventRegistration.objects.filter(event__in=events)

        totals = regs.aggregate(
            total=Count('id'),
            checked_in=Count('id', filter=Q(status='checked_in')),
            pending=Count('id', filter=Q(status='pending')),
            confirmed=Count('id', filter=Q(status='confirmed')),
            # Folded in from a separate .count() call.
            recent=Count('id', filter=Q(created_at__gte=since)),
        )
        total = totals['total'] or 0
        recent_count = totals.pop('recent')

        # `events_upcoming` previously counted `status='upcoming'`, which is not
        # one of PublishableMixin.Status's values (draft / in_review / approved /
        # scheduled / published / archived) — so it matched nothing and the
        # dashboard reported 0 upcoming events forever. "Upcoming" means the
        # event has not started yet, which is a date question, not a status one.
        event_totals = events.aggregate(
            events_total=Count('id'),
            events_upcoming=Count('id', filter=Q(start_datetime__gte=timezone.now())),
        )

        return {
            **event_totals,
            'registrations': totals,
            'registrations_recent': recent_count,
            # None, not 0: with no registrations there is no rate to report,
            # and 0% would read as "nobody turned up".
            'check_in_rate': (
                round(totals['checked_in'] / total * 100) if total else None
            ),
        }

    def _content(self, user):
        from content.models import Devotional

        qs = Devotional.objects.all()
        counts = qs.aggregate(
            total=Count('id'),
            published=Count('id', filter=Q(status='published')),
            in_review=Count('id', filter=Q(status='in_review')),
            draft=Count('id', filter=Q(status='draft')),
            approved=Count('id', filter=Q(status='approved')),
            scheduled=Count('id', filter=Q(status='scheduled')),
        )

        # Coverage of the next fortnight — the figure the Overview banner needs.
        today = timezone.localdate()
        horizon = today + timedelta(days=14)
        covered = set(
            qs.filter(date__gte=today, date__lt=horizon,
                      status__in=['approved', 'scheduled', 'published'])
              .values_list('date', flat=True)
        )
        gaps = [
            (today + timedelta(days=i)).isoformat()
            for i in range(14)
            if (today + timedelta(days=i)) not in covered
        ]
        counts['coverage_next_14'] = {'covered': 14 - len(gaps), 'gaps': gaps}
        return counts


def _primary_node(user):
    membership = (
        Membership.objects
        .filter(user=user, is_primary=True, is_active=True)
        .select_related('organization_node')
        .first()
    )
    return membership.organization_node if membership else None
