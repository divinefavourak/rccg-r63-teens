"""Celery tasks for events."""
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# Reminders go to events starting within this window. It matches the daily run
# interval: an event further out is picked up by a later run, and one closer has
# already been reminded (the per-registration dedupe key makes the overlap free).
REMINDER_WINDOW = timedelta(hours=24)


@shared_task(name='events.tasks.send_event_reminders', ignore_result=True)
def send_event_reminders():
    """
    Remind confirmed attendees of events starting within the next 24 hours.

    Idempotent: each registration carries a `dedupe_key` scoped to itself, so a
    re-run — or an overlapping window after a delayed beat — cannot remind the
    same teen twice.
    """
    from .models import Event
    from .notifications import notify_event_reminder

    now = timezone.now()
    events = Event.objects.filter(
        status=Event.Status.PUBLISHED,
        start_datetime__gte=now,
        start_datetime__lte=now + REMINDER_WINDOW,
    )

    sent = 0
    for event in events.iterator():
        sent += notify_event_reminder(event)

    logger.info('Event reminders: %s notification(s) sent.', sent)
    return sent
