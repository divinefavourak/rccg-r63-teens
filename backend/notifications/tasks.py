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
    result = ladder.close_out_day()
    logger.info('Reminder day closed: %s', result)
    return result
