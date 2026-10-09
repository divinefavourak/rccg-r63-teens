"""Celery tasks for payments."""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='payments.tasks.expire_unpaid_registrations', ignore_result=True)
def expire_unpaid_registrations():
    """
    Give up the places on paid events that were not paid for in time.

    Idempotent: a place already given up is no longer pending, so a re-run or
    an overlapping run finds nothing to do for it.
    """
    from .registrations import expire_unpaid

    released = expire_unpaid()
    logger.info('Unpaid registrations: %s place(s) released.', released)
    return released
