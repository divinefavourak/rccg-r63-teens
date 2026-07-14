"""
The devotional calendar and its gap detection.

`docs/07-feature-specifications.md` §5: "Devotional calendar view with gap
detection and alerts (no-devotional-scheduled-within-48h pages the admin)."

The reason this matters more than it looks: `docs/02-roadmap.md` warns that
"software without content is an empty shell" and asks for a 60-day content buffer
before launch. A gap in the pipeline is not a cosmetic problem — it is a day on
which every teen who opens the app finds nothing, and a streak they cannot
continue. Gaps must be visible *before* they arrive, not discovered on the day.

A date is **covered** if a devotional exists for it in a state that will be live
on the day: published, scheduled, or approved-and-waiting. A draft does not cover
a date — an unreviewed devotional is not content, it is an intention.
"""
from datetime import timedelta

from common.dates import app_today
from common.models import PublishableMixin

from ..models import Devotional

Status = PublishableMixin.Status

# States that will render on the day. APPROVED counts: it has passed the review
# gate and needs only a publish. DRAFT and IN_REVIEW do not — a devotional nobody
# has approved may never go out.
COVERING_STATES = {Status.PUBLISHED, Status.SCHEDULED, Status.APPROVED}

# "no-devotional-scheduled-within-48h pages the admin" (§5).
ALERT_HORIZON_DAYS = 2


def _date_range(start, end):
    day, days = start, []
    while day <= end:
        days.append(day)
        day += timedelta(days=1)
    return days


def calendar(start, end):
    """
    Day-by-day pipeline state for the console's calendar view.

    Returns a list of `{date, devotional, status, is_covered}`, one entry per day
    in the inclusive range — including the empty ones, because the empty ones are
    the entire point of the view.
    """
    if end < start:
        raise ValueError('end must not precede start.')

    devotionals = {
        devotional.date: devotional
        for devotional in Devotional.objects.filter(date__range=(start, end))
    }

    entries = []
    for day in _date_range(start, end):
        devotional = devotionals.get(day)
        status = devotional.status if devotional else None
        entries.append({
            'date': day,
            'devotional': devotional,
            'status': status,
            'is_covered': status in COVERING_STATES if status else False,
        })
    return entries


def gaps(start, end):
    """The days in the range with no devotional that will be live on them."""
    return [entry['date'] for entry in calendar(start, end) if not entry['is_covered']]


def imminent_gaps(horizon_days=ALERT_HORIZON_DAYS, today=None):
    """
    Uncovered days between today and the horizon — what pages the admin.

    Inclusive of today: a gap *today* is the most urgent kind there is, and a
    check that only looked forward would stay silent on the one day it matters
    most.
    """
    today = today or app_today()
    return gaps(today, today + timedelta(days=horizon_days))


def buffer_days(today=None, lookahead=90):
    """
    How many consecutive covered days start from today — the "content buffer" the
    roadmap asks the editorial team to hold at 60 before launch.

    Counts *consecutive* days, not total: 60 devotionals with a hole on day 3 is a
    3-day buffer, and reporting it as 60 would hide exactly the thing that hurts.
    """
    today = today or app_today()
    entries = calendar(today, today + timedelta(days=lookahead))

    count = 0
    for entry in entries:
        if not entry['is_covered']:
            break
        count += 1
    return count
