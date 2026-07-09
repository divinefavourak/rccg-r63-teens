"""
Admin for the Bible domain.

Scripture models get a full editing experience. The personal layer is
**view-only**: bookmarks, highlights, notes, history and progress belong to the
teen who created them (`docs/08-bible-experience.md` §3). Staff may inspect them
for support and safeguarding, but no admin may author or alter a teen's private
note, so add/change are disabled throughout.
"""
from django.contrib import admin

from .models import (
    BibleBook, BibleChapter, BibleTranslation, BibleVerse, Bookmark,
    ContinueReading, Highlight, Note, ReadingHistory, ReadingProgress,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    """Inspect-only admin: no create, no edit, no delete."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# Scripture
# ---------------------------------------------------------------------------

@admin.register(BibleTranslation)
class BibleTranslationAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'name', 'language_code', 'source_type', 'is_public_domain',
        'is_offline_capable', 'is_default', 'is_active', 'sort_order',
    )
    list_filter = (
        'source_type', 'is_public_domain', 'is_offline_capable', 'is_active', 'language_code',
    )
    search_fields = ('code', 'name', 'full_name')
    ordering = ('sort_order', 'code')
    fieldsets = (
        (None, {'fields': ('code', 'name', 'full_name', 'sort_order', 'is_active')}),
        ('Language', {'fields': ('language_code', 'language_name')}),
        ('Source & offline', {'fields': ('source_type', 'is_offline_capable', 'is_default')}),
        ('Licensing', {
            'fields': (
                'is_public_domain', 'copyright_notice', 'license_source', 'attribution_required',
            ),
            'description': (
                'Licensed translations must carry their required copyright line. '
                'Many licenses forbid offline storage — untick "offline capable" then.'
            ),
        }),
    )


class BibleChapterInline(admin.TabularInline):
    model = BibleChapter
    extra = 0
    fields = ('number', 'verse_count')
    ordering = ('number',)
    show_change_link = True


@admin.register(BibleBook)
class BibleBookAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'osis_code', 'book_number', 'testament', 'translation', 'chapter_count',
    )
    list_filter = ('translation', 'testament')
    search_fields = ('name', 'abbreviation', 'osis_code')
    ordering = ('translation', 'book_number')
    list_select_related = ('translation',)
    raw_id_fields = ('translation',)
    inlines = [BibleChapterInline]


class BibleVerseInline(admin.TabularInline):
    model = BibleVerse
    extra = 0
    fields = ('number', 'text')
    ordering = ('number',)


@admin.register(BibleChapter)
class BibleChapterAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'number', 'verse_count', 'translation_code')
    list_filter = ('book__translation', 'book__testament')
    search_fields = ('book__name',)
    ordering = ('book', 'number')
    list_select_related = ('book', 'book__translation')
    raw_id_fields = ('book',)
    inlines = [BibleVerseInline]

    @admin.display(description='Translation', ordering='book__translation__code')
    def translation_code(self, obj):
        return obj.book.translation.code


@admin.register(BibleVerse)
class BibleVerseAdmin(admin.ModelAdmin):
    list_display = ('reference', 'translation_code', 'short_text')
    list_filter = ('chapter__book__translation', 'chapter__book__testament')
    search_fields = ('text', 'chapter__book__name')
    ordering = ('chapter', 'number')
    list_select_related = ('chapter', 'chapter__book', 'chapter__book__translation')
    raw_id_fields = ('chapter',)

    @admin.display(description='Reference')
    def reference(self, obj):
        return obj.reference

    @admin.display(description='Translation')
    def translation_code(self, obj):
        return obj.chapter.book.translation.code

    @admin.display(description='Text')
    def short_text(self, obj):
        return obj.text[:80] + ('…' if len(obj.text) > 80 else '')


# ---------------------------------------------------------------------------
# Personal layer — inspect only
# ---------------------------------------------------------------------------

@admin.register(Bookmark)
class BookmarkAdmin(ReadOnlyAdmin):
    list_display = ('user', 'target_reference', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'user__email')
    list_select_related = (
        'user', 'verse__chapter__book', 'chapter__book',
    )
    raw_id_fields = ('user', 'verse', 'chapter')
    date_hierarchy = 'created_at'


@admin.register(Highlight)
class HighlightAdmin(ReadOnlyAdmin):
    list_display = ('user', 'verse_reference', 'color', 'created_at')
    list_filter = ('color', 'created_at')
    search_fields = ('user__username', 'user__email')
    list_select_related = ('user', 'verse__chapter__book')
    raw_id_fields = ('user', 'verse')
    date_hierarchy = 'created_at'

    @admin.display(description='Verse')
    def verse_reference(self, obj):
        return obj.verse.reference


@admin.register(Note)
class NoteAdmin(ReadOnlyAdmin):
    """
    Notes are private absolutely. This admin exists for support and safeguarding
    inspection only — the body is never editable, and nothing here may be used to
    surface a teen's notes to leaders or parents.
    """

    list_display = ('user', 'verse_reference', 'updated_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('user__username', 'user__email')
    list_select_related = ('user', 'verse__chapter__book')
    raw_id_fields = ('user', 'verse')
    date_hierarchy = 'updated_at'

    @admin.display(description='Verse')
    def verse_reference(self, obj):
        return obj.verse.reference


@admin.register(ReadingHistory)
class ReadingHistoryAdmin(ReadOnlyAdmin):
    list_display = ('user', 'chapter_reference', 'read_on', 'read_at')
    list_filter = ('read_on', 'chapter__book__translation')
    search_fields = ('user__username', 'user__email')
    list_select_related = ('user', 'chapter__book', 'chapter__book__translation')
    raw_id_fields = ('user', 'chapter')
    date_hierarchy = 'read_on'

    @admin.display(description='Chapter')
    def chapter_reference(self, obj):
        return obj.chapter.reference


@admin.register(ReadingProgress)
class ReadingProgressAdmin(ReadOnlyAdmin):
    list_display = ('user', 'chapter_reference', 'furthest_verse_number',
                    'is_completed', 'updated_at')
    list_filter = ('is_completed',)
    search_fields = ('user__username', 'user__email')
    list_select_related = ('user', 'chapter__book')
    raw_id_fields = ('user', 'chapter')

    @admin.display(description='Chapter')
    def chapter_reference(self, obj):
        return obj.chapter.reference


@admin.register(ContinueReading)
class ContinueReadingAdmin(ReadOnlyAdmin):
    list_display = ('user', 'chapter_reference', 'verse_number', 'updated_at')
    search_fields = ('user__username', 'user__email')
    list_select_related = ('user', 'chapter__book')
    raw_id_fields = ('user', 'chapter')

    @admin.display(description='Chapter')
    def chapter_reference(self, obj):
        return obj.chapter.reference
