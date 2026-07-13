"""
Bible domain services — all Scripture business logic lives here, not in views.

Covers reference resolution (the `ScriptureRef` resolver the docs require as
"one implementation, everywhere") and the reading layer (history, progress,
continue-reading).

Streak calculation is **not** implemented here. `record_chapter_read` captures
every field a future streak engine needs (`read_on`, a tz-safe local day) and
stops there — Phase 2 owns streaks (`docs/07-feature-specifications.md` §8).
"""
from django.db import transaction

from common.dates import app_today

from .models import (
    BibleChapter, BibleTranslation, BibleVerse, ContinueReading, ReadingHistory,
    ReadingProgress,
)


# ---------------------------------------------------------------------------
# Translations & reference resolution
# ---------------------------------------------------------------------------

def default_translation():
    """The translation the reader opens by default (WEB, per docs §11)."""
    return (
        BibleTranslation.objects.filter(is_default=True, is_active=True).first()
        or BibleTranslation.objects.filter(is_active=True).order_by('sort_order', 'code').first()
    )


def resolve_translation(code=None):
    """A translation by code, falling back to the default. None if none exist."""
    if code:
        found = BibleTranslation.objects.filter(code__iexact=code, is_active=True).first()
        if found:
            return found
    return default_translation()


def resolve_reference(translation, book_osis, chapter_number,
                      start_verse_number=None, end_verse_number=None):
    """
    Resolve a translation-agnostic Scripture address to verse rows.

    Returns an ordered `BibleVerse` queryset (possibly empty — Scripture text is
    not imported yet, and a reference to an unimported book is not an error).
    Whole-chapter references pass no verse numbers.
    """
    if translation is None:
        return BibleVerse.objects.none()

    verses = (
        BibleVerse.objects
        .filter(
            chapter__number=chapter_number,
            chapter__book__translation=translation,
            chapter__book__osis_code__iexact=book_osis,
        )
        .select_related('chapter', 'chapter__book', 'chapter__book__translation')
        .order_by('number')
    )
    if start_verse_number:
        verses = verses.filter(number__gte=start_verse_number)
        verses = verses.filter(number__lte=end_verse_number or start_verse_number)
    return verses


def chapter_queryset():
    """Chapters with their book+translation joined — the N+1 guard for readers."""
    return BibleChapter.objects.select_related('book', 'book__translation')


def verse_queryset():
    """Verses with the full address joined, so `verse.reference` costs no query."""
    return BibleVerse.objects.select_related(
        'chapter', 'chapter__book', 'chapter__book__translation'
    )


# ---------------------------------------------------------------------------
# Reading layer
# ---------------------------------------------------------------------------

@transaction.atomic
def record_chapter_read(user, chapter, furthest_verse_number=None, completed=False):
    """
    Record that ``user`` read ``chapter``.

    Writes three things, each with a distinct purpose:
      * a `ReadingHistory` row  — the append-only event stream (feeds streaks later)
      * a `ReadingProgress` row — the high-water mark within this chapter
      * `ContinueReading`       — the single resumable position

    Progress only ever moves forward: a user re-reading verse 3 of a chapter they
    finished does not rewind their high-water mark.
    """
    from django.utils import timezone as dj_timezone

    history = ReadingHistory.objects.create(user=user, chapter=chapter, read_on=app_today())

    progress, _ = ReadingProgress.objects.get_or_create(user=user, chapter=chapter)
    target = furthest_verse_number or progress.furthest_verse_number
    if target > progress.furthest_verse_number:
        progress.furthest_verse_number = target
    if completed and not progress.is_completed:
        progress.is_completed = True
        progress.completed_at = dj_timezone.now()
    progress.save(update_fields=[
        'furthest_verse_number', 'is_completed', 'completed_at', 'updated_at',
    ])

    set_continue_reading(user, chapter, furthest_verse_number or 1)
    return history


def set_continue_reading(user, chapter, verse_number=1):
    """Move the user's single resumable position."""
    position, _ = ContinueReading.objects.update_or_create(
        user=user, defaults={'chapter': chapter, 'verse_number': verse_number},
    )
    return position


def get_continue_reading(user):
    """
    The user's resumable position, or None.

    Falls back to their most recent `ReadingHistory` entry when no explicit
    position exists — a user who read a chapter before this feature shipped still
    gets a Continue Reading card.
    """
    if not user or not user.is_authenticated:
        return None

    position = (
        ContinueReading.objects
        .select_related('chapter', 'chapter__book', 'chapter__book__translation')
        .filter(user=user)
        .first()
    )
    if position:
        return position

    last = (
        ReadingHistory.objects
        .select_related('chapter', 'chapter__book', 'chapter__book__translation')
        .filter(user=user)
        .first()  # ordering = ['-read_at']
    )
    if not last:
        return None
    return ContinueReading(user=user, chapter=last.chapter, verse_number=1)


def reading_history(user):
    """A user's chapter reads, newest first, fully joined."""
    return (
        ReadingHistory.objects
        .filter(user=user)
        .select_related('chapter', 'chapter__book', 'chapter__book__translation')
    )


def reading_stats(user):
    """
    Distinct chapters and books a user has read, counted by their
    translation-agnostic identity (OSIS code + chapter number) so reading the
    same chapter in two translations is not double-counted.

    This is `bible`'s public reading-metric surface: other bounded contexts (the
    Progress API) compose it rather than querying reading tables directly, so
    Bible internals stay owned by Bible.
    """
    progress = ReadingProgress.objects.filter(user=user)
    return {
        'distinct_chapters_read': progress.values(
            'chapter__book__osis_code', 'chapter__number').distinct().count(),
        'distinct_books_read': progress.values(
            'chapter__book__osis_code').distinct().count(),
    }
