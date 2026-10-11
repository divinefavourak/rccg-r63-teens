"""
The daily experience — today's devotional, today's memory verse, the Verse of
the Day, and the publish-time rule that keeps them consistent.

**The invariant this module exists to protect:** the Verse of the Day *is* the
primary memory verse of today's devotional. There is exactly one resolution path
(`verse_of_the_day` -> `todays_memory_verse` -> `todays_devotional`), so no
feature can define a competing daily verse
(`docs/08-bible-experience.md` §7, `docs/07-feature-specifications.md` §4).

Views call these functions; they never re-derive the day's verse themselves.
"""
from django.core.exceptions import ValidationError

from common.dates import app_today

from ..models import Devotional, MemoryVerse


def _published(queryset):
    return queryset.filter(status=Devotional.Status.PUBLISHED)


def devotional_for_date(target_date, published_only=True):
    """
    The devotional for a given date, with its memory verses prefetched.

    Returns None when the pipeline has a gap — an expected state the client
    renders as the empty state in `docs/06-user-flows.md` flow 5, not an error.
    """
    queryset = Devotional.objects.all()
    if published_only:
        queryset = _published(queryset)
    return (
        queryset
        .prefetch_related(
            'memory_verses__translation',
            'memory_verses__start_verse__chapter__book__translation',
            'memory_verses__end_verse',
        )
        .filter(date=target_date)
        .first()
    )


def todays_devotional(published_only=True):
    """Today's devotional, where "today" is a Lagos calendar day, not a UTC one."""
    return devotional_for_date(app_today(), published_only=published_only)


def primary_memory_verse(devotional):
    """
    A devotional's one primary memory verse, or None.

    Reads from the prefetched `memory_verses` when available so calling this in a
    loop over devotionals costs no extra queries.
    """
    if devotional is None:
        return None
    for verse in devotional.memory_verses.all():
        if verse.is_primary:
            return verse
    return None


def todays_memory_verse(published_only=True):
    """The primary memory verse of today's devotional, or None."""
    return primary_memory_verse(todays_devotional(published_only=published_only))


def verse_of_the_day(published_only=True):
    """
    The Verse of the Day.

    A deliberate one-line delegation: the Verse of the Day has no independent
    existence, no randomness and no separate storage. It is today's memory verse.
    """
    return todays_memory_verse(published_only=published_only)


def ensure_primary_memory_verse(devotional):
    """
    Give a devotional its primary memory verse from the legacy text fields when
    it has none.

    Devotionals that arrive through the scraper or the plain authoring form carry
    their verse only in `memory_verse_passage` / `memory_verse_content`; nothing
    ever wrote a `MemoryVerse` row for them, so the publish gate refused every one
    of them even though the verse is right there. Deriving it here keeps the gate
    strict (no verse, no publish) without making editors re-enter what they
    already typed.

    Returns the primary verse, or None when the legacy fields are empty too.
    """
    existing = primary_memory_verse(devotional)
    if existing is not None:
        return existing

    reference = (devotional.memory_verse_passage or '').strip()
    text = (devotional.memory_verse_content or '').strip()
    if not reference or not text:
        return None

    verse = MemoryVerse.objects.create(
        devotional=devotional,
        is_primary=True,
        reference_display=reference[:255],
        text_override=text,
    )
    # Drop any prefetched (and now stale) `memory_verses` so the gate sees it.
    getattr(devotional, '_prefetched_objects_cache', {}).pop('memory_verses', None)
    return verse


# `DailyChallenge.title` is what the Today card prints, and the column is this wide.
CHALLENGE_TITLE_LENGTH = 200


def ensure_daily_challenge(devotional):
    """
    Give a published devotional's day its challenge, from the Action Point,
    when nobody has written one.

    The Today card shows a `DailyChallenge` row, and those were only ever made
    by hand in the admin, so the card read "None today" every day. Every
    devotional already ends in an Action Point ("Tell three girls around you
    that they are special and loved by God"), which is what
    `docs/12-gamification.md` asks a challenge to be: one small, real thing to
    do, themed with the day's message.

    A challenge someone wrote for that day always stands: this makes one only
    when the day has none at all, active or not, so switching a derived one off
    in the admin is respected too. A draft gets nothing, since its challenge
    would show on Today before its reading does.

    Returns the day's challenge, or None when there is nothing to make one from.
    """
    from profiles.models import DailyChallenge

    if devotional is None or devotional.status != Devotional.Status.PUBLISHED:
        return None

    existing = DailyChallenge.objects.filter(challenge_date=devotional.date)
    if existing.exists():
        return existing.filter(is_active=True).order_by('-created_at').first()

    action = ' '.join((devotional.action_point or '').split())
    if not action:
        return None

    title = action
    if len(title) > CHALLENGE_TITLE_LENGTH:
        # Cut at a word, and say that it was cut. The whole of it is in the
        # description.
        title = title[:CHALLENGE_TITLE_LENGTH - 1].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'
    return DailyChallenge.objects.create(
        title=title, description=action, challenge_date=devotional.date,
    )


def validate_publishable(devotional):
    """
    The publish gate: a devotional without exactly one primary memory verse
    cannot be published, because that verse powers the entire day
    (`docs/07-feature-specifications.md` §5).

    The database already guarantees *at most* one primary (partial unique index
    on `MemoryVerse`); this enforces *at least* one.

    Resolves through `primary_memory_verse` rather than a `.filter().count()` so
    it reads any prefetched `memory_verses` instead of forcing a fresh COUNT per
    devotional — the admin's bulk publish calls this once per selected row.
    """
    if primary_memory_verse(devotional) is None:
        raise ValidationError(
            'A devotional cannot be published without a primary memory verse — '
            'that verse is the Verse of the Day.'
        )
    return True
