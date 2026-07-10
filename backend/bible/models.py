"""
The Bible domain — Scripture text and a teen's private engagement with it.

Two layers live here:

1. **Scripture text** (`BibleTranslation` -> `BibleBook` -> `BibleChapter` ->
   `BibleVerse`). Translations are pluggable text sources; nothing assumes a
   single Bible version. No text is imported yet — the schema exists first.
2. **The personal layer** (`Bookmark`, `Highlight`, `Note`, `ReadingHistory`,
   `ReadingProgress`, `ContinueReading`). These rows belong to exactly one user
   and are never exposed to leaders, parents or coordinators
   (`docs/08-bible-experience.md` §3, `docs/13-community.md`).

This app is foundational: it imports nothing from `content`, `identity` or
`events`. `content` depends on `bible` (for the devotional's memory verse), never
the reverse.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from common.models import TimestampMixin, UUIDMixin


class Testament(models.TextChoices):
    OLD = 'old', 'Old Testament'
    NEW = 'new', 'New Testament'


class BibleTranslation(UUIDMixin, TimestampMixin):
    """
    A Bible version (WEB, KJV, ...).

    Translations are *pluggable text sources* (`docs/08-bible-experience.md` §10):
    `LOCAL` translations are self-hosted public-domain texts we may cache offline;
    `REMOTE` translations are fetched from a licensed API and may only be cached
    within their license terms. Adding a translation is content ops, not
    engineering — hence every licensing fact is a field, not a code branch.
    """

    class SourceType(models.TextChoices):
        LOCAL = 'local', 'Local (self-hosted)'
        REMOTE = 'remote', 'Remote (API-fetched)'

    code = models.CharField(max_length=20, unique=True, db_index=True)  # 'WEB'
    name = models.CharField(max_length=100)                             # 'World English Bible'
    full_name = models.CharField(max_length=255, blank=True)

    language_code = models.CharField(max_length=10, default='en', db_index=True)
    language_name = models.CharField(max_length=100, default='English')

    source_type = models.CharField(
        max_length=10, choices=SourceType.choices, default=SourceType.LOCAL
    )

    # Licensing. `copyright_notice` is rendered wherever the license requires it.
    is_public_domain = models.BooleanField(default=False)
    copyright_notice = models.TextField(blank=True)
    license_source = models.CharField(max_length=255, blank=True)
    attribution_required = models.BooleanField(default=False)

    # Licensed texts often forbid offline storage; the reader consults this flag.
    is_offline_capable = models.BooleanField(default=False)

    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'code']
        verbose_name = 'Bible Translation'
        verbose_name_plural = 'Bible Translations'
        constraints = [
            # At most one default translation across the table.
            models.UniqueConstraint(
                fields=['is_default'],
                condition=Q(is_default=True),
                name='bible_single_default_translation',
            ),
        ]
        indexes = [
            models.Index(fields=['is_active', 'sort_order']),
            models.Index(fields=['language_code']),
        ]

    def __str__(self):
        return f'{self.code} — {self.name}'

    @property
    def attribution(self):
        """The line the share-card generator and reader must render."""
        return self.copyright_notice or f'({self.code})'


class BibleBook(UUIDMixin, TimestampMixin):
    """
    One book within one translation.

    Books are per-translation because book *names* are translation- and
    language-specific ("John" / "Johanu"). `osis_code` is the translation-agnostic
    address that lets the reader preserve position when switching translations
    (`docs/08-bible-experience.md` §10) — look up the same `osis_code` in the
    target translation.

    `alternate_names` feeds the fuzzy reference parser, including the common
    Nigerian abbreviations the docs call for (§2).
    """

    translation = models.ForeignKey(
        BibleTranslation, on_delete=models.CASCADE, related_name='books'
    )
    # Canonical, translation-independent identifier, e.g. 'John', '1Cor'.
    osis_code = models.CharField(max_length=20, db_index=True)
    book_number = models.PositiveSmallIntegerField()  # 1..66 in canonical order

    name = models.CharField(max_length=100)
    abbreviation = models.CharField(max_length=20, blank=True)
    alternate_names = models.JSONField(default=list, blank=True)

    testament = models.CharField(
        max_length=3, choices=Testament.choices, db_index=True
    )
    chapter_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['translation', 'book_number']
        verbose_name = 'Bible Book'
        verbose_name_plural = 'Bible Books'
        constraints = [
            models.UniqueConstraint(
                fields=['translation', 'osis_code'], name='bible_uniq_book_osis'
            ),
            models.UniqueConstraint(
                fields=['translation', 'book_number'], name='bible_uniq_book_number'
            ),
        ]
        indexes = [
            models.Index(fields=['translation', 'book_number']),
            models.Index(fields=['translation', 'testament']),
            models.Index(fields=['osis_code']),
        ]

    def __str__(self):
        return f'{self.name} ({self.translation.code})'


class BibleChapter(UUIDMixin, TimestampMixin):
    """A chapter of a book. The unit of reading, history and progress."""

    book = models.ForeignKey(BibleBook, on_delete=models.CASCADE, related_name='chapters')
    number = models.PositiveSmallIntegerField()
    verse_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['book', 'number']
        verbose_name = 'Bible Chapter'
        verbose_name_plural = 'Bible Chapters'
        constraints = [
            models.UniqueConstraint(fields=['book', 'number'], name='bible_uniq_chapter'),
        ]
        indexes = [models.Index(fields=['book', 'number'])]

    def __str__(self):
        return f'{self.book.name} {self.number}'

    @property
    def reference(self):
        return f'{self.book.name} {self.number}'


class BibleVerse(UUIDMixin, TimestampMixin):
    """A single verse. The unit of bookmarking, highlighting and noting."""

    chapter = models.ForeignKey(BibleChapter, on_delete=models.CASCADE, related_name='verses')
    number = models.PositiveSmallIntegerField()
    text = models.TextField()

    class Meta:
        ordering = ['chapter', 'number']
        verbose_name = 'Bible Verse'
        verbose_name_plural = 'Bible Verses'
        constraints = [
            models.UniqueConstraint(fields=['chapter', 'number'], name='bible_uniq_verse'),
        ]
        indexes = [models.Index(fields=['chapter', 'number'])]

    def __str__(self):
        return f'{self.reference} ({self.translation.code})'

    @property
    def translation(self):
        return self.chapter.book.translation

    @property
    def reference(self):
        return f'{self.chapter.book.name} {self.chapter.number}:{self.number}'


# ---------------------------------------------------------------------------
# The personal layer — owner-only rows. See module docstring.
# ---------------------------------------------------------------------------

class Bookmark(UUIDMixin, TimestampMixin):
    """
    A saved verse *or* chapter. Exactly one target is set, enforced in the DB.

    Duplicates are impossible by construction: the two partial unique constraints
    below cover (user, verse) and (user, chapter) separately, because a plain
    `unique_together` would treat every NULL target as distinct and let a user
    bookmark the same verse repeatedly.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bible_bookmarks'
    )
    verse = models.ForeignKey(
        BibleVerse, on_delete=models.CASCADE, related_name='bookmarks', null=True, blank=True
    )
    chapter = models.ForeignKey(
        BibleChapter, on_delete=models.CASCADE, related_name='bookmarks', null=True, blank=True
    )

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(verse__isnull=False, chapter__isnull=True)
                    | Q(verse__isnull=True, chapter__isnull=False)
                ),
                name='bible_bookmark_exactly_one_target',
            ),
            models.UniqueConstraint(
                fields=['user', 'verse'],
                condition=Q(verse__isnull=False),
                name='bible_uniq_bookmark_verse',
            ),
            models.UniqueConstraint(
                fields=['user', 'chapter'],
                condition=Q(chapter__isnull=False),
                name='bible_uniq_bookmark_chapter',
            ),
        ]
        indexes = [models.Index(fields=['user', '-created_at'])]

    def __str__(self):
        return f'{self.user} bookmarked {self.target_reference}'

    def clean(self):
        super().clean()
        if bool(self.verse_id) == bool(self.chapter_id):
            raise ValidationError('A bookmark must target exactly one of verse or chapter.')

    @property
    def target_reference(self):
        target = self.verse or self.chapter
        return target.reference if target else ''


class Highlight(UUIDMixin, TimestampMixin):
    """
    A coloured highlight over one verse.

    The docs specify four muted colours with *no imposed meaning* — teens build
    their own systems (`docs/08-bible-experience.md` §3). One highlight per
    (user, verse): recolouring updates the row rather than stacking rows.
    """

    class Color(models.TextChoices):
        YELLOW = 'yellow', 'Yellow'
        GREEN = 'green', 'Green'
        BLUE = 'blue', 'Blue'
        PINK = 'pink', 'Pink'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bible_highlights'
    )
    verse = models.ForeignKey(BibleVerse, on_delete=models.CASCADE, related_name='highlights')
    color = models.CharField(max_length=20, choices=Color.choices, default=Color.YELLOW)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'verse'], name='bible_uniq_highlight'),
        ]
        indexes = [models.Index(fields=['user', '-created_at'])]

    def __str__(self):
        return f'{self.user} highlighted {self.verse.reference} ({self.color})'


class Note(UUIDMixin, TimestampMixin):
    """
    A private note attached to a verse.

    Private *absolutely*: never surfaced to teachers, coordinators, parents or
    admins through any product surface (`docs/08-bible-experience.md` §3). A user
    may keep several notes on one verse, so there is no uniqueness constraint.
    `updated_at` (from TimestampMixin) carries the edit timestamp.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bible_notes'
    )
    verse = models.ForeignKey(BibleVerse, on_delete=models.CASCADE, related_name='notes')
    content = models.TextField()

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['user', 'verse']),
        ]

    def __str__(self):
        return f'Note by {self.user} on {self.verse.reference}'


class ReadingHistory(UUIDMixin):
    """
    Append-only record of a chapter being read.

    This is the raw event stream the Phase 2 Progress engine will fold into
    streaks and Grace Days (`docs/07-feature-specifications.md` §8). Streak logic
    is deliberately *not* implemented here — this phase only captures the data it
    will need. Rows are never updated, so there is no `updated_at`.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bible_reading_history'
    )
    chapter = models.ForeignKey(
        BibleChapter, on_delete=models.CASCADE, related_name='reading_history'
    )
    read_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # The local calendar day the read happened on, for tz-safe day bucketing.
    read_on = models.DateField(db_index=True)

    class Meta:
        ordering = ['-read_at']
        verbose_name = 'Reading History Entry'
        verbose_name_plural = 'Reading History'
        indexes = [
            models.Index(fields=['user', '-read_at']),
            models.Index(fields=['user', 'read_on']),
        ]

    def __str__(self):
        return f'{self.user} read {self.chapter.reference} on {self.read_on}'


class ReadingProgress(UUIDMixin, TimestampMixin):
    """
    A user's furthest position within one chapter (one row per user+chapter).

    Distinct from ReadingHistory: history is *every* read event, progress is the
    current high-water mark used to render "you're 60% through Psalm 119".
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bible_reading_progress'
    )
    chapter = models.ForeignKey(
        BibleChapter, on_delete=models.CASCADE, related_name='reading_progress'
    )
    furthest_verse_number = models.PositiveSmallIntegerField(default=0)
    is_completed = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Reading Progress'
        verbose_name_plural = 'Reading Progress'
        constraints = [
            models.UniqueConstraint(fields=['user', 'chapter'], name='bible_uniq_progress'),
        ]
        indexes = [
            models.Index(fields=['user', 'is_completed']),
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return f'{self.user} @ {self.chapter.reference} v{self.furthest_verse_number}'


class ContinueReading(UUIDMixin, TimestampMixin):
    """
    The single resumable position per user — "the most valuable card on Today"
    (`docs/08-bible-experience.md` §5).

    Materialised as its own row rather than derived from ReadingHistory because it
    must be a cheap, single-row read on the Today screen and must sync across
    devices. One row per user.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bible_continue_reading'
    )
    chapter = models.ForeignKey(
        BibleChapter, on_delete=models.CASCADE, related_name='continue_reading_entries'
    )
    verse_number = models.PositiveSmallIntegerField(default=1)

    class Meta:
        verbose_name = 'Continue Reading Position'
        verbose_name_plural = 'Continue Reading Positions'

    def __str__(self):
        return f'{self.user} @ {self.chapter.reference}:{self.verse_number}'

    @property
    def translation(self):
        return self.chapter.book.translation
