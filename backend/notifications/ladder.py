"""
The habit reminder ladder.

`docs/12-gamification.md` defines it: four rungs, each fired **only if today's
devotional is still incomplete**, and "completing it cancels all remaining rungs
instantly". `docs/07-feature-specifications.md` §10 adds: "Completing the
devotional cancels all remaining rungs within seconds, **including already-queued
ones**."

That last clause is the design constraint, and it drives the whole approach:

**Nothing is queued ahead of time.** The obvious implementation — when a day
begins, schedule four per-user tasks at the rung times — is the one that makes
"cancel already-queued rungs" hard, because you then have to hunt down and revoke
in-flight Celery tasks, and a revoke that loses a race sends a reminder to a teen
who already read their devotional. Instead a single beat task ticks every few
minutes and asks, per user: *is a rung due right now, and is the devotional still
incomplete?* Completion cancels every remaining rung by construction, because
there is nothing to cancel — the next tick simply finds the devotional done and
sends nothing. There is no race to lose.

The cost is a periodic sweep instead of precise scheduling. At the scale of a
region of teens that is a cheap query, and it buys a cancellation guarantee that
is *structurally* true rather than merely usually true.
"""
import logging
import zoneinfo
from datetime import datetime, timedelta

from django.utils import timezone

from .models import (
    LadderRung, Notification, NotificationPreference, NotificationType,
)
from .services import (
    record_reminder_answered, record_reminder_ignored, send,
)

logger = logging.getLogger(__name__)

# How often the beat task runs. A rung fires if its time falls inside the window
# that just elapsed, so the window and the beat interval must match — a wider
# window would double-send (the dedupe key catches it, but noisily), a narrower
# one would drop rungs that fell in the gap.
TICK_MINUTES = 5

# The canonical copy from `docs/12-gamification.md`. Reproduced verbatim: it has
# been through the voice review (`docs/11-content-strategy.md`), and every rung
# passes the "invite, never indict" test. Do not paraphrase these.
RUNG_COPY = {
    LadderRung.MORNING: (
        'Good morning!',
        "Today's devotional and memory verse are ready.",
    ),
    LadderRung.AFTERNOON: (
        'A moment with God?',
        "Have you had a chance to spend time in God's Word today?",
    ),
    LadderRung.EVENING: (
        'Your streak is waiting',
        "Keep your streak alive. Today's devotional is still waiting.",
    ),
    LadderRung.FINAL: (
        'There is still time',
        "There's still time to continue today's journey.",
    ),
}


def dedupe_key(on, rung):
    """One rung, one day, one send — however many times the beat task fires."""
    return f'habit:{on.isoformat()}:{rung}'


def _local_now(preference, now=None):
    now = now or timezone.now()
    try:
        return now.astimezone(zoneinfo.ZoneInfo(preference.timezone))
    except Exception:
        logger.warning('Invalid timezone %r for user %s',
                       preference.timezone, preference.user_id)
        return timezone.localtime(now)


def due_rungs(preference, local_now, window_minutes=TICK_MINUTES):
    """
    The rungs whose scheduled time fell inside the window that just elapsed.

    Half-open on the left, closed on the right — `(now - window, now]` — so a rung
    sitting exactly on a tick boundary belongs to exactly one window and cannot be
    both missed and double-counted.
    """
    window_start = local_now - timedelta(minutes=window_minutes)
    due = []

    for rung in preference.active_rungs():
        rung_at = datetime.combine(
            local_now.date(), preference.rung_time(rung), tzinfo=local_now.tzinfo,
        )
        if window_start < rung_at <= local_now:
            due.append(rung)
    return due


def _devotional_context():
    """
    Today's devotional and its verse — the day's one message, which the reminder
    carries off-app (§10: "the notification is part of One Day. One Verse. One
    Message., not generic app-bait").

    Imported locally so `notifications` does not take a module-level dependency on
    `content`. The notification core is infrastructure; only the ladder — the one
    feature that *is* about the daily devotional — reaches for it, and only when
    it runs. This mirrors how `bible.services` reaches for `progress`.
    """
    from content.services import daily

    devotional = daily.todays_devotional()
    verse = daily.primary_memory_verse(devotional)
    return devotional, verse


def _has_completed(user, devotional):
    from content.models import UserReadLog

    if devotional is None:
        return False
    return UserReadLog.objects.filter(user=user, devotional=devotional).exists()


def send_rung(user, rung, devotional, verse, local_now):
    """Send one rung. Idempotent for the (user, day, rung)."""
    title, body = RUNG_COPY[rung]

    data = {}
    deep_link = '/today'
    if devotional is not None:
        deep_link = f'/devotionals/{devotional.id}'
        data['devotional_id'] = str(devotional.id)
        data['devotional_title'] = devotional.title
    if verse is not None:
        data['memory_verse'] = verse.reference_display

    return send(
        user,
        NotificationType.HABIT_REMINDER,
        title,
        body,
        deep_link=deep_link,
        data=data,
        rung=rung,
        dedupe_key=dedupe_key(local_now.date(), rung),
        # Quiet hours are judged against the local moment this rung is *for*, not
        # against whenever the worker happened to wake up. A rung is scheduled to
        # sit outside quiet hours (the final one at 20:45 against a 21:30 start);
        # judging it by the worker's clock could suppress a rung that is correctly
        # timed simply because the queue was running late.
        at=local_now.time(),
    )


def dispatch(now=None, window_minutes=TICK_MINUTES):
    """
    One tick of the ladder. Returns the number of rungs actually sent.

    A rung is sent only when *all* of these hold, checked in cheapest-first order:
      1. the teen has habit reminders enabled;
      2. a rung of their preset is due in this window, in their own timezone;
      3. today's devotional exists and they have not completed it.

    (3) is what makes the ladder completion-aware. It is evaluated *now*, at fire
    time, not when the day began — so a teen who read their devotional at 07:00
    gets nothing at 13:30, with no cancellation machinery involved.
    """
    now = now or timezone.now()

    # No devotional today means no reminder. Nagging a teen toward a devotional
    # that does not exist would be the purest form of app-bait, and would also
    # send them to an empty screen.
    devotional, verse = _devotional_context()
    if devotional is None:
        logger.info('Habit ladder: no devotional today, nothing to remind about.')
        return 0

    sent = 0
    preferences = (
        NotificationPreference.objects
        .filter(habit_reminders_enabled=True)
        .select_related('user')
    )

    for preference in preferences.iterator():
        local_now = _local_now(preference, now)
        rungs = due_rungs(preference, local_now, window_minutes)
        if not rungs:
            continue

        if _has_completed(preference.user, devotional):
            continue

        for rung in rungs:
            if send_rung(preference.user, rung, devotional, verse, local_now):
                sent += 1

    return sent


def close_out_day(on=None):
    """
    End-of-day accounting for the step-down (`docs/12-gamification.md`).

    A day counts as *ignored* only if we actually reminded them and they did not
    complete. A teen who received no reminder cannot have ignored one, and
    counting that day toward a step-down would quietly punish someone for our own
    empty pipeline.

    Run after quiet hours begin, when no further rung can fire.
    """
    from common.dates import app_today

    on = on or app_today()
    devotional, _ = _devotional_context()

    reminded_user_ids = set(
        Notification.objects
        .filter(
            notification_type=NotificationType.HABIT_REMINDER,
            created_at__date=on,
            pushed_at__isnull=False,     # it actually reached them
        )
        .values_list('user_id', flat=True)
    )
    if not reminded_user_ids:
        return {'answered': 0, 'ignored': 0}

    preferences = (
        NotificationPreference.objects
        .filter(user_id__in=reminded_user_ids)
        .select_related('user')
    )

    answered = ignored = 0
    for preference in preferences.iterator():
        if _has_completed(preference.user, devotional):
            record_reminder_answered(preference.user)
            answered += 1
        else:
            record_reminder_ignored(preference.user)
            ignored += 1

    return {'answered': answered, 'ignored': ignored}
