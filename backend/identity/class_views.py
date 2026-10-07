"""
My Class: the teens a leader looks after, and how their week of reading is going.

`docs/CONSOLE-FIGMA-PROMPT.md` C12 calls this "the smallest Console": a Teacher
holds four permissions, and `profiles.view` at their parish or area is the one
that makes this screen possible. Nothing here is a Teacher special case, though.
The roster is "the teens whose home node sits inside a subtree where you hold
`profiles.view`", so a parish leader sees a parish and a coordinator sees
whatever they coordinate, from the same query.

What a leader is shown is deliberately small: a name, an age, which days this
week had any reading, and one guardian to call. Not what was read, not a streak
to compare, not a ranking. `docs/12-gamification.md` forbids shaming, and a
class list sorted by performance is a leaderboard by another name, so the order
is alphabetical and stays that way.
"""
from datetime import timedelta

from django.db.models import Max, Q
from django.http import Http404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.dates import app_today
from progress.models import ActionType, SpiritualAction

from . import authorization as authz
from .authorization import HasPermission
from .models import Membership, RoleAssignment
from .permissions_registry import Perm

# Roles that do not make someone a leader. Anyone holding only these is a teen
# for the purposes of a class list.
_NOT_LEADERSHIP = ('teen', 'parent')

# Reading, as a teacher means it: the day's devotional or a Bible chapter.
_READING = (ActionType.DEVOTIONAL_COMPLETED, ActionType.CHAPTER_READ)

# A class is a room of people. A coordinator's subtree can hold thousands, and a
# phone on a slow connection should not be sent all of them.
ROSTER_LIMIT = 300


def _class_memberships(user):
    """
    Home memberships of the teens inside the caller's `profiles.view` subtrees.

    Home (primary) only, so a teen who also attends a second parish appears in
    one class, not two. Leaders are left out, including the caller: a parish's
    other teachers are colleagues, not pupils.
    """
    today = timezone.localdate()
    leaders = (
        RoleAssignment.objects
        .filter(is_active=True, start_date__lte=today)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        .exclude(role__code__in=_NOT_LEADERSHIP)
        .values('user_id')
    )
    memberships = (
        Membership.objects
        .filter(is_active=True, is_primary=True, user__is_active=True,
                user__teen_profile__isnull=False)
        .exclude(user=user)
        .exclude(user_id__in=leaders)
        .select_related('user', 'user__teen_profile', 'organization_node')
    )
    return authz.scope_queryset(
        memberships, user, Perm.PROFILES_VIEW, node_field='organization_node')


def _week(today):
    """Monday to Sunday of the week containing `today`, as seven dates."""
    monday = today - timedelta(days=today.weekday())
    return [monday + timedelta(days=offset) for offset in range(7)]


def _reading_days(user_ids, start, end):
    """`{user_id: {date, ...}}` for the days each teen read, in one query."""
    days = {}
    rows = (
        SpiritualAction.objects
        .filter(user_id__in=user_ids, action_type__in=_READING,
                occurred_on__range=(start, end))
        .values_list('user_id', 'occurred_on')
        .distinct()
    )
    for user_id, day in rows:
        days.setdefault(user_id, set()).add(day)
    return days


def _last_read(user_ids):
    """`{user_id: date}` of each teen's most recent day of reading."""
    rows = (
        SpiritualAction.objects
        .filter(user_id__in=user_ids, action_type__in=_READING)
        .values('user_id')
        .annotate(last=Max('occurred_on'))
    )
    return {row['user_id']: row['last'] for row in rows}


def _photo(user):
    profile = getattr(user, 'teen_profile', None)
    if profile is not None and profile.avatar:
        return profile.avatar.url
    picture = getattr(user, 'profile_picture', None)
    return picture.url if picture else None


def _member(membership, week, today, read_days, last_read):
    user = membership.user
    profile = user.teen_profile
    days = read_days.get(user.pk, set())
    return {
        'id': str(user.pk),
        'name': user.get_full_name() or user.username,
        # `TeenProfile.age` assumes a date of birth; plenty of profiles have none.
        'age': profile.age if profile.date_of_birth else None,
        'photo': _photo(user),
        'parish': membership.organization_node.name,
        # Monday first. Days still to come are simply false, never "missed".
        'week': [day in days for day in week],
        'days_this_week': len(days),
        'read_today': today in days,
        'last_read_on': last_read.get(user.pk),
    }


class ClassRosterView(APIView):
    """The class list, with this week's reading as seven dots per teen."""

    permission_classes = [IsAuthenticated, HasPermission(Perm.PROFILES_VIEW)]

    def get(self, request):
        today = app_today()
        week = _week(today)

        memberships = _class_memberships(request.user)
        total = memberships.count()
        page = list(memberships.order_by('user__first_name', 'user__last_name')[:ROSTER_LIMIT])

        user_ids = [m.user_id for m in page]
        read_days = _reading_days(user_ids, week[0], week[-1])
        last_read = _last_read(user_ids)
        members = [_member(m, week, today, read_days, last_read) for m in page]

        return Response({
            'today': today,
            'week_start': week[0],
            'total': total,
            'read_today': sum(1 for member in members if member['read_today']),
            'members': members,
        })


class ClassMemberView(APIView):
    """
    One teen, read-only: their week, and a guardian to call.

    Resolved through the same scoped queryset as the list, so a teen in another
    parish 404s. Guardian contact is here because a teacher who notices a teen
    has gone quiet needs a way to reach the family; nothing medical is, because
    that belongs to event registration and the people running the event.
    """

    permission_classes = [IsAuthenticated, HasPermission(Perm.PROFILES_VIEW)]

    def get(self, request, user_id):
        membership = _class_memberships(request.user).filter(user_id=user_id).first()
        if membership is None:
            raise Http404

        today = app_today()
        week = _week(today)
        read_days = _reading_days([membership.user_id], week[0], week[-1])
        last_read = _last_read([membership.user_id])

        profile = membership.user.teen_profile
        return Response({
            **_member(membership, week, today, read_days, last_read),
            'today': today,
            'guardian_name': profile.guardian_name,
            'guardian_phone': profile.guardian_phone,
            'guardian_relationship': profile.guardian_relationship,
        })
