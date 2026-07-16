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
from datetime import datetime, time, timedelta
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


def user_timezone(user):
    """
    The timezone that defines a calendar day for this user.

    Per-user timezones are a documented Progress requirement
    (`docs/07-feature-specifications.md` §8 — "Africa/Lagos default, per-user tz
    stored"). Until a stored per-user field lands, every user falls back to the
    single app timezone; this helper is the seam so callers never assume UTC.
    """
    tz_name = getattr(user, 'timezone', None)
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            pass
    return app_timezone()


def user_today(user):
    """Today's date in the user's timezone (falls back to the app timezone)."""
    return timezone.now().astimezone(user_timezone(user)).date()


def day_bounds(day, tz=None):
    """
    The half-open instant range ``[start, end)`` covering ``day`` in ``tz``.

    Use this rather than Django's ``__date`` lookup whenever the day in question is
    an *app* day. ``__date`` extracts the date in ``settings.TIME_ZONE`` — which is
    UTC here, correctly, for storage — so ``created_at__date=app_today()`` quietly
    compares a Lagos date against a UTC date. The two disagree for the hour between
    midnight and 01:00 Lagos, every day: the kind of bug that passes every test run
    in the office and then fires once a night in production.

        Notification.objects.filter(created_at__range=day_bounds(app_today()))
    """
    tz = tz or app_timezone()
    start = datetime.combine(day, time.min, tzinfo=tz)
    return start, start + timedelta(days=1)
