"""
Cache invalidation for the Today screen.

`TodayView` caches the shared half of Today — devotional, Verse of the Day,
Scripture cards, challenge — until midnight in the app timezone. That TTL is
right for the normal case (one editorial decision per day) and wrong for the
case that actually happens on a Sunday morning: an editor publishing or fixing
today's devotional and needing to see it immediately.

These handlers clear the affected day's entries on any write to the content that
feeds Today. Without them a typo fix would sit invisible for up to 24 hours.

Entries are keyed by (day, age group) and the age groups are not enumerable from
here without importing profile config, so invalidation uses django-redis's
pattern delete. It degrades to a no-op on cache backends without that method —
locmem in tests — which is why the tests that care clear the cache themselves.
"""
import logging

from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from common.dates import app_today
from content.models import Devotional, MemoryVerse, ScriptureReference
from profiles.models import DailyChallenge

logger = logging.getLogger(__name__)


def invalidate_today(day=None):
    """Drop every cached Today payload for ``day`` (default: today)."""
    day = day or app_today()
    pattern = f'today:*:{day.isoformat()}:*'
    try:
        # django-redis only. delete_pattern is not part of Django's cache API.
        cache.delete_pattern(pattern)
    except AttributeError:
        logger.debug('Cache backend has no delete_pattern; skipping %s', pattern)
    except Exception as exc:  # pragma: no cover - Redis unreachable
        # IGNORE_EXCEPTIONS covers get/set but not delete_pattern, and a failed
        # invalidation must not turn an editor's save into a 500. The entry
        # expires at midnight regardless.
        logger.warning('Today cache invalidation failed for %s: %s', pattern, exc)


@receiver(post_save, sender=Devotional)
@receiver(post_delete, sender=Devotional)
def _devotional_changed(sender, instance, **kwargs):
    # Invalidate the devotional's own date, not today's: an editor scheduling
    # tomorrow's devotional must not blow away today's cache, and an editor
    # fixing today's must.
    invalidate_today(getattr(instance, 'date', None))


@receiver(post_save, sender=MemoryVerse)
@receiver(post_delete, sender=MemoryVerse)
@receiver(post_save, sender=ScriptureReference)
@receiver(post_delete, sender=ScriptureReference)
def _devotional_child_changed(sender, instance, **kwargs):
    devotional = getattr(instance, 'devotional', None)
    invalidate_today(getattr(devotional, 'date', None) if devotional else None)


@receiver(post_save, sender=DailyChallenge)
@receiver(post_delete, sender=DailyChallenge)
def _challenge_changed(sender, instance, **kwargs):
    invalidate_today(getattr(instance, 'challenge_date', None))
