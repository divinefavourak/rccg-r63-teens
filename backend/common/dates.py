"""
Timezone-safe calendar-day helpers.

`settings.TIME_ZONE` is UTC (correct for storage), but the product's day boundary
is a *Nigerian* day boundary: "today's devotional" must roll over at midnight in
Africa/Lagos, not at 1am Lagos time when UTC rolls over
(`docs/07-feature-specifications.md` §8 — "Timezone-safe day boundaries
(Africa/Lagos default, per-user tz stored)").

Per-user timezones arrive with the Phase 2 Progress engine; until then every
caller resolves "today" against the single app timezone below.
"""
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone

DEFAULT_APP_TIMEZONE = 'Africa/Lagos'


def app_timezone():
    """The tz that defines a calendar day for daily content."""
    return ZoneInfo(getattr(settings, 'SCRIPTURE_TIMEZONE', DEFAULT_APP_TIMEZONE))


def app_today():
    """Today's date in the app timezone."""
    return timezone.now().astimezone(app_timezone()).date()
