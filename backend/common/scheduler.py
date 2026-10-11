"""
The scheduled tasks, run by an outside timer instead of Celery beat.

Reminders, the end-of-day close-out, event reminders and the rest are Celery
beat tasks (`backend/celery.py`), which needs a worker and a beat process
running beside the web service. On a host where that costs money the product
had no clock at all: nothing was ever sent on time, and nothing said so.

`tick` is the same clock driven from outside. A timer service calls it every
few minutes; it works out which entries of the beat schedule came due since
the last call and runs them here, in the web process. The schedule itself
stays in one place, so a deployment can move between this and a real worker
without the two drifting apart.

A late or missed call is absorbed rather than lost: the window runs from the
previous call to this one, so a task whose minute fell in the gap still runs.
Every scheduled task is already safe to run twice (each dedupes its own
sends), which is what makes that, and two overlapping calls, harmless.

Off unless `SCHEDULER_SECRET` is set. See docs/ops/10-scheduler-without-a-worker.md.
"""
import hmac
import logging
import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from celery.schedules import crontab
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import Http404, JsonResponse
from django.utils import timezone
from django.utils.module_loading import import_string
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from backend.celery import app as celery_app

logger = logging.getLogger(__name__)

LAST_TICK_KEY = 'scheduler:last_tick'
# What a call covers when nothing remembers the one before it: the interval the
# timer is meant to be set to, which is also the ladder's own tick.
DEFAULT_WINDOW_MINUTES = 5
# A timer that was down all night must not wake up and replay the whole night.
MAX_WINDOW_MINUTES = 180

LADDER_TASK = 'notifications.tasks.dispatch_habit_ladder'
# The ladder takes its window from here rather than from its own schedule, and
# a shorter cap than the rest: a "good morning" that is three hours late is
# worse than none, where a daily tidy-up three hours late is just late.
MAX_LADDER_WINDOW_MINUTES = 30


def _fires_at(schedule, moment):
    """Does this crontab fire in the minute `moment` falls in? (Local time.)"""
    return (
        moment.minute in schedule.minute
        and moment.hour in schedule.hour
        and moment.day in schedule.day_of_month
        and moment.month in schedule.month_of_year
        # crontab counts Sunday as 0; isoweekday counts it as 7.
        and moment.isoweekday() % 7 in schedule.day_of_week
    )


def due_tasks(start, end):
    """
    The names of the beat entries that came due in `(start, end]`.

    Half-open on the left, like the ladder's own window, so a task sitting
    exactly on the boundary between two calls belongs to one of them.
    """
    zone = ZoneInfo(settings.CELERY_TIMEZONE)
    minute = start.astimezone(zone).replace(second=0, microsecond=0) + timedelta(minutes=1)
    last = end.astimezone(zone)
    minutes = []
    while minute <= last:
        minutes.append(minute)
        minute += timedelta(minutes=1)

    due = []
    for entry in celery_app.conf.beat_schedule.values():
        schedule = entry['schedule']
        if not isinstance(schedule, crontab):
            continue
        if any(_fires_at(schedule, m) for m in minutes):
            due.append(entry['task'])
    return due


def claim_window(now=None):
    """
    The stretch of time this call answers for, and mark it answered.

    Remembered in the cache. If the cache has forgotten (or is down, which
    reads as forgotten), the call covers one normal interval.
    """
    now = now or timezone.now()
    previous = cache.get(LAST_TICK_KEY)
    start = now - timedelta(minutes=DEFAULT_WINDOW_MINUTES)
    if previous:
        try:
            start = max(
                datetime.fromisoformat(previous),
                now - timedelta(minutes=MAX_WINDOW_MINUTES),
            )
        except (TypeError, ValueError):
            pass
    if start >= now:
        start = now - timedelta(minutes=1)
    cache.set(LAST_TICK_KEY, now.isoformat(), 24 * 60 * 60)
    return start, now


def run(names, window_minutes):
    """Run each task here and now. One failing must not stop the others."""
    results = {}
    for name in names:
        try:
            if name == LADDER_TASK:
                from notifications import ladder
                sent = ladder.dispatch(
                    window_minutes=min(window_minutes, MAX_LADDER_WINDOW_MINUTES))
                results[name] = f'{sent} sent'
            else:
                outcome = import_string(name).apply(throw=False)
                if outcome.failed():
                    raise outcome.result
                results[name] = 'ok'
        except Exception:
            logger.exception('Scheduled task %s failed', name)
            results[name] = 'failed'
    logger.info('Scheduler tick ran: %s', results or 'nothing due')
    return results


def _run_in_background(names, window_minutes):
    """
    Off the request thread, so the timer gets its answer straight away: timer
    services give up after a few seconds, and a sweep of every teen's reminder
    settings can take longer than that.
    """
    def work():
        try:
            run(names, window_minutes)
        finally:
            # The thread opened its own database connection; nothing else will
            # close it.
            connection.close()

    threading.Thread(target=work, daemon=True, name='scheduler-tick').start()


@csrf_exempt
@require_POST
def tick(request):
    """
    `POST /api/v1/scheduler/tick/` with `Authorization: Bearer <SCHEDULER_SECRET>`.

    Answers 202 with what was due. The work carries on after the answer.
    """
    secret = getattr(settings, 'SCHEDULER_SECRET', '')
    if not secret:
        # Not configured: there is nothing here, to anyone.
        raise Http404
    given = request.headers.get('Authorization', '')
    if not hmac.compare_digest(given.encode(), f'Bearer {secret}'.encode()):
        return JsonResponse({'detail': 'Not allowed.'}, status=403)

    start, end = claim_window()
    names = due_tasks(start, end)
    window_minutes = max(1, round((end - start).total_seconds() / 60))
    if names:
        _run_in_background(names, window_minutes)
    return JsonResponse(
        {'due': names, 'since': start.isoformat(), 'until': end.isoformat()},
        status=202,
    )
