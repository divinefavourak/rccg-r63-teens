"""
Celery configuration for the RCCG R63 Teens backend.

This module configures Celery for async task processing and periodic tasks.
"""
import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('backend')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


# Celery Beat schedule for periodic tasks
app.conf.beat_schedule = {
    'scrape-daily-devotional': {
        'task': 'content.tasks.daily_devotional_scrape',
        'schedule': crontab(hour=0, minute=10),  # Run at 00:10 daily
        'options': {'queue': 'default'},
    },
}

app.conf.timezone = 'Africa/Lagos'


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery."""
    print(f'Request: {self.request!r}')
