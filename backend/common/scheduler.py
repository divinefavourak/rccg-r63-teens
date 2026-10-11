"""
The scheduled tasks, run by an outside timer instead of Celery beat.

Reminders, the end-of-day close-out, event reminders and the rest are Celery
beat tasks (`backend/celery.py`), which needs a worker and a beat process
running beside the web service. On a host where that costs money the product
had no clock at all: nothing was ever sent on time, and nothing said so.

`tick` is the same clock driven from outside. A timer service calls it every
few minutes; it works out which entries of the beat schedule came due since
the last call that finished its work, and runs them here, in the web process.
The schedule itself stays in one place, so a deployment can move between this
and a real worker without the two drifting apart.

A late or missed call is absorbed rather than lost: the window runs from the
last finished call to this one, so a task whose minute fell in the gap still
runs. The window is only moved on once the work is done, so a web process that
is restarted halfway through leaves it where it was and the next call tries
again. Every scheduled task is already safe to run twice (each dedupes its own
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

# Closes "today". Run late, after midnight, it has to be told which day it was
# meant for, or it closes the new one and yesterday is never counted.
CLOSE_OUT_TASK = 'notifications.tasks.close_out_reminder_day'

# One run at a time in this process. A second call that arrives while the
# first is still working would only repeat it.
_running = threading.Lock()


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
    The beat entries that came due in `(start, end]`, as `{task name: when}`.

    `when` is the last minute the task was scheduled for inside the window, in
    the schedule's own timezone. Half-open on the left, like the ladder's own
    window, so a task sitting exactly on the boundary between two calls belongs
    to one of them.
    """
    zone = ZoneInfo(settings.CELERY_TIMEZONE)
    minute = start.astimezone(zone).replace(second=0, microsecond=0) + timedelta(minutes=1)
    last = end.astimezone(zone)
    minutes = []
    while minute <= last:
        minutes.append(minute)
        minute += timedelta(minutes=1)

    due = {}
    for entry in celery_app.conf.beat_schedule.values():
        schedule = entry['schedule']
        if not isinstance(schedule, crontab):
            continue
        fired = [m for m in minutes if _fires_at(schedule, m)]
        if fired:
            due[entry['task']] = fired[-1]
    return due


def open_window(now=None):
    """
    The stretch of time this call answers for: from the last call that
    finished, to now.

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
    return start, now


def close_window(end):
    """Everything up to `end` has been dealt with; the next call starts there."""
    cache.set(LAST_TICK_KEY, end.isoformat(), 24 * 60 * 60)


def run(due, window_minutes):
    """
    Run each task in `due` (`{name: when it was scheduled for}`) here and now.
    One failing must not stop the others.
    """
    results = {}
    for name, scheduled_for in due.items():
        try:
            if name == LADDER_TASK:
                from notifications import ladder
                sent = ladder.dispatch(
                    window_minutes=min(window_minutes, MAX_LADDER_WINDOW_MINUTES))
                results[name] = f'{sent} sent'
                continue
            kwargs = {}
            if name == CLOSE_OUT_TASK:
                kwargs['on'] = scheduled_for.date().isoformat()
            outcome = import_string(name).apply(kwargs=kwargs, throw=False)
            if outcome.failed():
                raise outcome.result
            results[name] = 'ok'
        except Exception:
            logger.exception('Scheduled task %s failed', name)
            results[name] = 'failed'
    logger.info('Scheduler tick ran: %s', results or 'nothing due')
    return results


def _run_in_background(due, window_minutes, end):
    """
    Off the request thread, so the timer gets its answer straight away: timer
    services give up after a few seconds, and a sweep of every teen's reminder
    settings can take longer than that.

    The caller holds `_running`; this lets it go. The window is closed only
    after the work, so a process killed in the middle of it leaves the window
    open and the next call does the work again.
    """
    def work():
        try:
            run(due, window_minutes)
            close_window(end)
        finally:
            _running.release()
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

    if not _running.acquire(blocking=False):
        # The last call is still working. It has not closed its window, so
        # whatever is due now is still due when the next call comes.
        return JsonResponse({'due': [], 'busy': True}, status=202)

    try:
        start, end = open_window()
        due = due_tasks(start, end)
        window_minutes = max(1, round((end - start).total_seconds() / 60))
        if due:
            _run_in_background(due, window_minutes, end)
        else:
            close_window(end)
            _running.release()
    except Exception:
        _running.release()
        raise
    return JsonResponse(
        {'due': list(due), 'since': start.isoformat(), 'until': end.isoformat()},
        status=202,
    )
