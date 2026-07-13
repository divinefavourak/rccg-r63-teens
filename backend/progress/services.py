"""
Progress business logic. Views and feature apps call these; they never write
`SpiritualAction`/`StreakState` directly, so the streak stays consistent with
the stream that produced it.

This module is the *only* writer of `StreakState`. Grace-Day handling is layered
into `_advance_streak` in a later step; today a gap simply resets the run.
"""
from datetime import timedelta

from django.db import transaction

from common.dates import user_today

from .models import ActionType, SpiritualAction, StreakState


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
    parallel requests cannot both increment. Only a day strictly after
    `last_active_on` changes the streak: a same-day repeat is a no-op, and a
    backfilled earlier day is recorded in the stream but never rewrites history.
    """
    state, created = StreakState.objects.select_for_update().get_or_create(user=user)
    last = state.last_active_on

    if last is None:
        state.current_length = 1
        state.started_on = day
        state.last_active_on = day
    elif day <= last:
        # Same day (repeat action) or an out-of-order backfill: no forward move.
        return state
    elif day == last + timedelta(days=1):
        state.current_length += 1
        state.last_active_on = day
    else:
        # A gap the streak can't bridge yet — reset with fresh-start framing.
        # (Grace Days will intercept this branch in the next step.)
        state.current_length = 1
        state.started_on = day
        state.last_active_on = day

    if state.current_length > state.longest_length:
        state.longest_length = state.current_length
    state.save()
    return state


def streak_for(user):
    """The user's streak state, created lazily so a first read never 404s."""
    state, _ = StreakState.objects.get_or_create(user=user)
    return state
