"""
Serializers for the Bible domain.

Personal-layer serializers never expose `user` as a writable field — ownership is
assigned from `request.user` in the view. Accepting a client-supplied owner would
let any teen write rows belonging to another.
"""
from rest_framework import serializers

from .models import (
    BibleBook, BibleChapter, BibleTranslation, BibleVerse, Bookmark,
    ContinueReading, Highlight, Note, ReadingHistory, ReadingProgress,
)


# ---------------------------------------------------------------------------
# Scripture text
# ---------------------------------------------------------------------------

class BibleTranslationSerializer(serializers.ModelSerializer):
    attribution = serializers.CharField(read_only=True)

    class Meta:
        model = BibleTranslation
        fields = [
            'id', 'code', 'name', 'full_name', 'language_code', 'language_name',
            'source_type', 'is_public_domain', 'copyright_notice', 'license_source',
            'attribution_required', 'attribution', 'is_offline_capable',
            'is_default', 'is_active', 'sort_order',
        ]


class BibleBookSerializer(serializers.ModelSerializer):
    translation_code = serializers.CharField(source='translation.code', read_only=True)

    class Meta:
        model = BibleBook
        fields = [
            'id', 'translation', 'translation_code', 'osis_code', 'book_number',
            'name', 'abbreviation', 'alternate_names', 'testament', 'chapter_count',
        ]


class BibleVerseSerializer(serializers.ModelSerializer):
    reference = serializers.CharField(read_only=True)

    class Meta:
        model = BibleVerse
        fields = ['id', 'chapter', 'number', 'text', 'reference']


class BibleChapterSerializer(serializers.ModelSerializer):
    """Chapter metadata, without verse text (list view)."""

    reference = serializers.CharField(read_only=True)
    book_name = serializers.CharField(source='book.name', read_only=True)
    translation_code = serializers.CharField(source='book.translation.code', read_only=True)

    class Meta:
        model = BibleChapter
        fields = [
            'id', 'book', 'book_name', 'translation_code', 'number',
            'verse_count', 'reference',
        ]


class BibleChapterDetailSerializer(BibleChapterSerializer):
    """Chapter with its verses — the reader's payload."""

    verses = BibleVerseSerializer(many=True, read_only=True)

    class Meta(BibleChapterSerializer.Meta):
        fields = BibleChapterSerializer.Meta.fields + ['verses']


class VerseSummarySerializer(serializers.ModelSerializer):
    """Compact verse for embedding in bookmarks/highlights/notes."""

    reference = serializers.CharField(read_only=True)
    translation_code = serializers.CharField(
        source='chapter.book.translation.code', read_only=True
    )

    class Meta:
        model = BibleVerse
        fields = ['id', 'number', 'text', 'reference', 'translation_code']


class ChapterSummarySerializer(serializers.ModelSerializer):
    reference = serializers.CharField(read_only=True)
    translation_code = serializers.CharField(source='book.translation.code', read_only=True)

    class Meta:
        model = BibleChapter
        fields = ['id', 'number', 'reference', 'translation_code']


# ---------------------------------------------------------------------------
# Personal layer
# ---------------------------------------------------------------------------

class BookmarkSerializer(serializers.ModelSerializer):
    verse_detail = VerseSummarySerializer(source='verse', read_only=True)
    chapter_detail = ChapterSummarySerializer(source='chapter', read_only=True)
    target_reference = serializers.CharField(read_only=True)

    class Meta:
        model = Bookmark
        fields = [
            'id', 'verse', 'chapter', 'verse_detail', 'chapter_detail',
            'target_reference', 'created_at',
        ]

    def validate(self, attrs):
        verse = attrs.get('verse')
        chapter = attrs.get('chapter')
        if bool(verse) == bool(chapter):
            raise serializers.ValidationError(
                'Provide exactly one of verse or chapter.'
            )
        # The DB enforces this with a partial unique index, which DRF cannot infer.
        # Check explicitly so a repeat bookmark is a 400, not a 500 IntegrityError.
        user = self.context['request'].user
        duplicate = Bookmark.objects.filter(user=user, verse=verse, chapter=chapter)
        if duplicate.exists():
            raise serializers.ValidationError('You have already bookmarked this.')
        return attrs


class HighlightSerializer(serializers.ModelSerializer):
    verse_detail = VerseSummarySerializer(source='verse', read_only=True)

    class Meta:
        model = Highlight
        fields = ['id', 'verse', 'verse_detail', 'color', 'created_at', 'updated_at']

    def validate(self, attrs):
        verse = attrs.get('verse')
        if not verse:
            return attrs
        # One highlight per (user, verse): recolouring is an update, not a new row.
        # Enforced by a unique constraint; checked here so a repeat is a 400, and
        # excluding self so moving a highlight onto a free verse still works.
        clashing = Highlight.objects.filter(user=self.context['request'].user, verse=verse)
        if self.instance is not None:
            clashing = clashing.exclude(pk=self.instance.pk)
        if clashing.exists():
            raise serializers.ValidationError(
                'This verse is already highlighted; update that highlight to recolour it.'
            )
        return attrs


class NoteSerializer(serializers.ModelSerializer):
    verse_detail = VerseSummarySerializer(source='verse', read_only=True)

    class Meta:
        model = Note
        fields = ['id', 'verse', 'verse_detail', 'content', 'created_at', 'updated_at']

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError('A note cannot be empty.')
        return value


class ReadingHistorySerializer(serializers.ModelSerializer):
    chapter_detail = ChapterSummarySerializer(source='chapter', read_only=True)

    class Meta:
        model = ReadingHistory
        fields = ['id', 'chapter', 'chapter_detail', 'read_at', 'read_on']
        read_only_fields = ['read_at', 'read_on']


class ReadingProgressSerializer(serializers.ModelSerializer):
    chapter_detail = ChapterSummarySerializer(source='chapter', read_only=True)

    class Meta:
        model = ReadingProgress
        fields = [
            'id', 'chapter', 'chapter_detail', 'furthest_verse_number',
            'is_completed', 'completed_at', 'updated_at',
        ]
        read_only_fields = ['is_completed', 'completed_at', 'updated_at']


class ContinueReadingSerializer(serializers.ModelSerializer):
    chapter_detail = ChapterSummarySerializer(source='chapter', read_only=True)
    translation_code = serializers.CharField(
        source='chapter.book.translation.code', read_only=True
    )

    class Meta:
        model = ContinueReading
        fields = [
            'id', 'chapter', 'chapter_detail', 'translation_code',
            'verse_number', 'updated_at',
        ]


class RecordReadSerializer(serializers.Serializer):
    """Input for `POST /reading-history/record/` — records a chapter read."""

    chapter = serializers.PrimaryKeyRelatedField(queryset=BibleChapter.objects.all())
    furthest_verse_number = serializers.IntegerField(required=False, min_value=1)
    completed = serializers.BooleanField(required=False, default=False)


class ScriptureSearchGroupSerializer(serializers.Serializer):
    """
    One book's worth of keyword hits (`bible.search.group_by_book`).

    Read-only projection of a plain dict, not a model — the group is a shape the
    search service builds, and nothing persists it.
    """

    osis_code = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    testament = serializers.CharField(read_only=True)
    verses = BibleVerseSerializer(many=True, read_only=True)


class VerseShareSerializer(serializers.Serializer):
    """
    The share payload (`bible.sharing.share_payload`).

    A read-only projection of a dict, not a model. `attribution` is always
    present, never conditional — a client cannot render a share card without it
    and cannot be trusted to remember to ask.
    """

    reference = serializers.CharField(read_only=True)
    book = serializers.CharField(read_only=True)
    chapter = serializers.IntegerField(read_only=True)
    start_verse = serializers.IntegerField(read_only=True, allow_null=True)
    end_verse = serializers.IntegerField(read_only=True, allow_null=True)
    text = serializers.CharField(read_only=True)
    verses = BibleVerseSerializer(many=True, read_only=True)
    translation_code = serializers.CharField(read_only=True)
    attribution = serializers.CharField(read_only=True)
    attribution_required = serializers.BooleanField(read_only=True)
    deep_link = serializers.CharField(read_only=True)
    share_text = serializers.CharField(read_only=True)
    copy_text = serializers.CharField(read_only=True)
