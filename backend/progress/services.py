"""
Progress business logic. Views and feature apps call these; they never write
`SpiritualAction`/`StreakState`/`GraceDayLedger` directly, so the streak stays
consistent with the stream that produced it.

This module is the *only* writer of `StreakState` and the Grace-Day ledger.
"""
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Count, Sum

from common.dates import user_today

from .models import (
    ActionType, GraceDayLedger, GraceReason, SpiritualAction, StreakState,
)

# Grace-Day policy (docs/12-gamification.md "Grace Days").
GRACE_CAP = 4                    # a teen holds at most this many at once
MONTHLY_GRACE_ALLOCATION = 2     # granted on the 1st of each calendar month
MAX_CONSECUTIVE_GRACE_COVER = 2  # grace bridges at most 2 consecutive misses
DAYS_PER_EARNED_WEEK = 7         # +1 Grace Day per 7 genuinely-active days


@transaction.atomic
def record_action(user, action_type, *, occurred_on=None, source_reference='', metadata=None):
    """
    Append one spiritual action and advance the user's streak.

    `occurred_on` defaults to the user's *local* today. Recording the same
    action twice in a day appends both to the stream (it is a faithful log) but
    only the first advances the streak — the streak counts *days*, not actions.
    """
    if action_type not in ActionType.values:
        raise ValueError(f'Unknown action_type: {action_type!r}')

    occurred_on = occurred_on or user_today(user)
    action = SpiritualAction.objects.create(
        user=user,
        action_type=action_type,
        occurred_on=occurred_on,
        source_reference=source_reference,
        metadata=metadata or {},
    )
    _advance_streak(user, occurred_on)
    return action


def _advance_streak(user, day):
    """
    Move the materialized streak forward for a qualifying action on `day`.

    Locks the row (`select_for_update`) so two same-day actions racing in
    parallel requests cannot both increment — and, because the lock is taken
    before reading the Grace balance, grace consumption is serialized per user.

    Cases relative to `last_active_on`: first-ever starts at 1; same day or an
    out-of-order backfill is a no-op; the next day extends by 1; a gap is offered
    to Grace Days before it resets.
    """
    state, created = StreakState.objects.select_for_update().get_or_create(user=user)
    last = state.last_active_on

    if last is None:
        state.current_length = 1
        state.started_on = day
        state.last_active_on = day
        state.active_days_this_week = 1
    elif day <= last:
        # Same day (repeat action) or an out-of-order backfill: no forward move.
        return state
    elif day == last + timedelta(days=1):
        state.current_length += 1
        state.last_active_on = day
        state.active_days_this_week += 1
    elif _try_cover_gap(user, last, day):
        # Grace bridged the missed days; the run is continuous through `day`, but
        # the covered days were not active, so the active-week run restarts.
        state.current_length += (day - last).days
        state.last_active_on = day
        state.active_days_this_week = 1
    else:
        # An unbridgeable gap — reset with fresh-start framing.
        state.current_length = 1
        state.started_on = day
        state.last_active_on = day
        state.active_days_this_week = 1

    if state.current_length > state.longest_length:
        state.longest_length = state.current_length

    # A completed 7-active-day week funds one Grace Day (capped; excess doesn't
    # accrue). The week is consumed either way, so the counter resets.
    if state.active_days_this_week >= DAYS_PER_EARNED_WEEK:
        grant_grace(user, 1, GraceReason.WEEKLY_EARNED)
        state.active_days_this_week = 0

    state.save()
    return state


def _try_cover_gap(user, last_active_on, day):
    """
    Attempt to spend Grace Days on the missed days between `last_active_on` and
    `day`. Returns True and writes the cover entries if the whole gap is bridged;
    returns False (spending nothing) otherwise.

    Grace bridges **at most two consecutive** missed days, and only if the
    balance covers every one of them — grace preserves a habit through
    interruptions, it must never become a 4-days-a-month app
    (`docs/12-gamification.md` anti-loophole).
    """
    missed_days = [last_active_on + timedelta(days=n)
                   for n in range(1, (day - last_active_on).days)]
    if not (1 <= len(missed_days) <= MAX_CONSECUTIVE_GRACE_COVER):
        return False
    if grace_balance(user) < len(missed_days):
        return False

    GraceDayLedger.objects.bulk_create([
        GraceDayLedger(user=user, delta=-1, reason=GraceReason.STREAK_COVER,
                       covered_on=missed)
        for missed in missed_days
    ])
    return True


def grace_balance(user):
    """A user's current Grace-Day balance: the sum of their ledger."""
    return GraceDayLedger.objects.filter(user=user).aggregate(
        total=Sum('delta'))['total'] or 0


def _lock_user_grace(user):
    """
    Per-user mutex for Grace mutations. Locking the user's `StreakState` row
    (the same row `_advance_streak` locks, so covers and grants serialize on one
    mutex) makes read-balance-then-write atomic — without it two concurrent
    grants can both see room and push the ledger past the cap.
    """
    StreakState.objects.get_or_create(user=user)
    StreakState.objects.select_for_update().get(user=user)


@transaction.atomic
def grant_grace(user, amount, reason, *, effective_month=None):
    """
    Grant up to `amount` Grace Days, honoring the held cap of 4. Returns the
    number actually granted; excess simply isn't written (no hoarding economy).
    """
    _lock_user_grace(user)
    grantable = min(amount, GRACE_CAP - grace_balance(user))
    if grantable <= 0:
        return 0
    GraceDayLedger.objects.create(
        user=user, delta=grantable, reason=reason, effective_month=effective_month,
    )
    return grantable


@transaction.atomic
def grant_monthly_allocation(user, month=None):
    """
    Grant the month's base allocation, once. Idempotent: always writes exactly one
    MONTHLY_ALLOCATION row per user per month — reserving the slot even when the
    balance is already capped (delta 0) so a later run, after grace has been
    spent, can't grant the month a second time. The per-user lock makes the
    check-then-insert atomic; the partial unique index is the backstop.
    """
    month = (month or user_today(user)).replace(day=1)
    _lock_user_grace(user)
    if GraceDayLedger.objects.filter(
        user=user, reason=GraceReason.MONTHLY_ALLOCATION, effective_month=month,
    ).exists():
        return 0
    grantable = max(0, min(MONTHLY_GRACE_ALLOCATION, GRACE_CAP - grace_balance(user)))
    GraceDayLedger.objects.create(
        user=user, delta=grantable, reason=GraceReason.MONTHLY_ALLOCATION,
        effective_month=month,
    )
    return grantable


def streak_for(user):
    """The user's streak state, created lazily so a first read never 404s."""
    state, _ = StreakState.objects.get_or_create(user=user)
    return state


def action_type_counts(user):
    """How many actions of each type the user has logged, e.g. for stats tiles."""
    rows = (
        SpiritualAction.objects
        .filter(user=user)
        .values('action_type')
        .annotate(total=Count('id'))
    )
    return {row['action_type']: row['total'] for row in rows}


def active_days(user, start, end):
    """
    The distinct local days (inclusive range) the user did something — the raw
    material for a monthly heat-map. One row per active day, not per action.
    """
    return list(
        SpiritualAction.objects
        .filter(user=user, occurred_on__range=(start, end))
        .values_list('occurred_on', flat=True)
        .distinct()
        .order_by('occurred_on')
    )
