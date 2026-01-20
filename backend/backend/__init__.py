"""
This module configures Celery to be loaded when Django starts.
"""

# This will make sure the app is always imported when Django starts
from .celery import app as celery_app

__all__ = ('celery_app',)
