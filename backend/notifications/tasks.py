"""
Celery tasks for notifications.

Both tasks are thin: they exist to be scheduled, and delegate immediately to
`notifications.ladder` so the logic is testable without a broker.
"""
import logging

from celery import shared_task

from . import ladder

logger = logging.getLogger(__name__)


@shared_task(name='notifications.tasks.dispatch_habit_ladder', ignore_result=True)
def dispatch_habit_ladder():
    """
    One tick of the habit ladder. Scheduled every `ladder.TICK_MINUTES` minutes.

    Safe to run twice: every rung carries a per-(user, day, rung) dedupe key, so a
    duplicated beat or a retried worker cannot buzz a teen twice.
    """
    sent = ladder.dispatch()
    logger.info('Habit ladder tick: %s reminder(s) sent.', sent)
    return sent


@shared_task(name='notifications.tasks.close_out_reminder_day', ignore_result=True)
def close_out_reminder_day():
    """
    End-of-day step-down accounting. Runs once, after quiet hours begin, when no
    further rung can fire.
    """
    from django.core.cache import cache

    from common.dates import app_today

    # Closing a day adds one to each teen's run of ignored days, so doing it
    # twice (a duplicated beat, a retried worker) steps a teen down early.
    # `add` only succeeds for the first caller of the day.
    day = app_today()
    if not cache.add(f'notifications:closed_out:{day.isoformat()}', 1, 36 * 60 * 60):
        logger.info('Reminder day %s was already closed; nothing done.', day)
        return None

    result = ladder.close_out_day(on=day)
    logger.info('Reminder day closed: %s', result)
    return result
