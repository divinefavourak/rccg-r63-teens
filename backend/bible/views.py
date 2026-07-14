"""
Bible API.

Scripture endpoints are public and read-mostly; writes require `bible.manage`.
Personal-layer endpoints are owner-scoped twice over: `get_queryset` filters to
`request.user` (so a foreign object 404s rather than 403s, leaking nothing), and
`IsOwner` guards object access. Business logic lives in `bible.services`.
"""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from identity.authorization import HasPermissionOrReadOnly, has_any_permission
from identity.permissions_registry import Perm

from . import references, services
from .models import (
    BibleBook, BibleChapter, BibleTranslation, BibleVerse, Bookmark,
    Highlight, Note, ReadingHistory, ReadingProgress,
)
from .permissions import IsOwner
from .serializers import (
    BibleBookSerializer, BibleChapterDetailSerializer, BibleChapterSerializer,
    BibleTranslationSerializer, BibleVerseSerializer, BookmarkSerializer,
    ContinueReadingSerializer, HighlightSerializer, NoteSerializer,
    ReadingHistorySerializer, ReadingProgressSerializer, RecordReadSerializer,
)


# ---------------------------------------------------------------------------
# Scripture — public read, `bible.manage` write
# ---------------------------------------------------------------------------

class BibleTranslationViewSet(viewsets.ModelViewSet):
    queryset = BibleTranslation.objects.all()
    serializer_class = BibleTranslationSerializer
    permission_classes = [HasPermissionOrReadOnly(Perm.BIBLE_MANAGE)]
    filterset_fields = ['language_code', 'is_active', 'is_offline_capable']
    search_fields = ['code', 'name', 'full_name']
    ordering = ['sort_order', 'code']

    def get_queryset(self):
        queryset = super().get_queryset()
        # Readers only ever see active translations; managers see everything,
        # including on reads — otherwise they could create a translation and
        # then be unable to read it back.
        if not has_any_permission(self.request.user, Perm.BIBLE_MANAGE):
            queryset = queryset.filter(is_active=True)
        return queryset

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def default(self, request):
        """The translation the reader opens by default."""
        translation = services.default_translation()
        if not translation:
            return Response(
                {'detail': 'No translation is available yet.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(BibleTranslationSerializer(translation).data)


class BibleBookViewSet(viewsets.ModelViewSet):
    queryset = BibleBook.objects.select_related('translation')
    serializer_class = BibleBookSerializer
    permission_classes = [HasPermissionOrReadOnly(Perm.BIBLE_MANAGE)]
    filterset_fields = ['translation', 'testament', 'osis_code']
    search_fields = ['name', 'abbreviation', 'osis_code']
    ordering = ['translation', 'book_number']

    def get_queryset(self):
        queryset = super().get_queryset()
        # `?translation=WEB` (code) is friendlier than a UUID for clients.
        code = self.request.query_params.get('translation_code')
        if code:
            queryset = queryset.filter(translation__code__iexact=code)
        return queryset

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def chapters(self, request, pk=None):
        book = self.get_object()
        chapters = book.chapters.select_related('book', 'book__translation').order_by('number')
        page = self.paginate_queryset(chapters)
        if page is not None:
            return self.get_paginated_response(
                BibleChapterSerializer(page, many=True).data
            )
        return Response(BibleChapterSerializer(chapters, many=True).data)


class BibleChapterViewSet(viewsets.ModelViewSet):
    queryset = BibleChapter.objects.select_related('book', 'book__translation')
    permission_classes = [HasPermissionOrReadOnly(Perm.BIBLE_MANAGE)]
    filterset_fields = ['book', 'number']
    ordering = ['book', 'number']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BibleChapterDetailSerializer
        return BibleChapterSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'retrieve':
            # One query for the chapter + one for its verses, never one per verse.
            queryset = queryset.prefetch_related('verses')
        return queryset


class BibleVerseViewSet(viewsets.ModelViewSet):
    queryset = BibleVerse.objects.select_related(
        'chapter', 'chapter__book', 'chapter__book__translation'
    )
    serializer_class = BibleVerseSerializer
    permission_classes = [HasPermissionOrReadOnly(Perm.BIBLE_MANAGE)]
    filterset_fields = ['chapter', 'number']
    search_fields = ['text']
    ordering = ['chapter', 'number']


class ScriptureLookupView(APIView):
    """
    Resolve a reference: the `ScriptureRef` read path.

    Two input shapes, one output shape:

    * **Free text** — `?q=jn 3:16`, `?q=1 cor 13`, `?q=ps 23`. What the reader's
      search field and any content-side reference detection send. Parsed by
      `bible.references`, the one parser (`docs/08-bible-experience.md` §12).
    * **Structured** — `?book=John&chapter=3&start_verse=16`. What a caller that
      already holds an address sends (a devotional's stored anchor Scripture).

    Omitting `translation` uses the default. Omitting the verse numbers returns
    the whole chapter. An unimported passage yields an empty `verses` list, not a
    404 — the address is valid even before the text lands.
    """

    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        translation = services.resolve_translation(request.query_params.get('translation'))
        if translation is None:
            return Response(
                {'detail': 'No translation is available yet.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        query = (request.query_params.get('q') or '').strip()
        if query:
            parsed = references.parse_reference(query, translation)
            if parsed is None:
                # Not a reference. A 404 would imply the passage is missing; this
                # is a shape problem, and the caller (search) needs to tell the two
                # apart so it can fall through to keyword search.
                return Response(
                    {'detail': f'{query!r} is not a Scripture reference.',
                     'parsed': False},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            book_osis = parsed['osis_code']
            book_name = parsed['book'].name
            chapter_number = parsed['chapter']
            start_verse = parsed['start_verse']
            end_verse = parsed['end_verse']
        else:
            book_osis = request.query_params.get('book')
            chapter = request.query_params.get('chapter')
            if not book_osis or not chapter:
                return Response(
                    {'detail': 'Provide either q, or book and chapter.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                chapter_number = int(chapter)
                start = request.query_params.get('start_verse')
                end = request.query_params.get('end_verse')
                start_verse = int(start) if start else None
                end_verse = int(end) if end else None
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'chapter, start_verse and end_verse must be integers.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            resolved = references.resolve_book(translation, book_osis)
            book_name = resolved.name if resolved else book_osis

        verses = services.resolve_reference(
            translation=translation,
            book_osis=book_osis,
            chapter_number=chapter_number,
            start_verse_number=start_verse,
            end_verse_number=end_verse,
        )
        return Response({
            'translation': BibleTranslationSerializer(translation).data,
            'book': book_osis,
            'book_name': book_name,
            'chapter': chapter_number,
            'start_verse': start_verse,
            'end_verse': end_verse,
            # The canonical rendering of the address — every surface that displays
            # a reference uses this, so they cannot drift apart.
            'reference': references.format_reference(
                book_name, chapter_number, start_verse, end_verse),
            'verses': BibleVerseSerializer(verses, many=True).data,
        })


# ---------------------------------------------------------------------------
# Personal layer — owner-only
# ---------------------------------------------------------------------------

class OwnedViewSetMixin:
    """Scopes every queryset to the requester and stamps ownership on create."""

    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BookmarkViewSet(OwnedViewSetMixin,
                      mixins.CreateModelMixin,
                      mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      mixins.DestroyModelMixin,
                      viewsets.GenericViewSet):
    """
    A bookmark has no mutable field — you either have one or you don't — so it is
    created and destroyed, never updated.
    """

    queryset = Bookmark.objects.select_related(
        'verse__chapter__book__translation', 'chapter__book__translation'
    )
    serializer_class = BookmarkSerializer
    ordering = ['-created_at']


class HighlightViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = Highlight.objects.select_related('verse__chapter__book__translation')
    serializer_class = HighlightSerializer
    filterset_fields = ['color']
    ordering = ['-created_at']


class NoteViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = Note.objects.select_related('verse__chapter__book__translation')
    serializer_class = NoteSerializer
    filterset_fields = ['verse']
    ordering = ['-updated_at']


class ReadingProgressViewSet(OwnedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ReadingProgress.objects.select_related('chapter__book__translation')
    serializer_class = ReadingProgressSerializer
    filterset_fields = ['is_completed']
    ordering = ['-updated_at']


class ReadingHistoryViewSet(OwnedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only: history is an append-only stream written through `record`, never
    edited. It is the substrate a future streak engine folds over.
    """

    queryset = ReadingHistory.objects.select_related('chapter__book__translation')
    serializer_class = ReadingHistorySerializer
    ordering = ['-read_at']

    @action(detail=False, methods=['post'])
    def record(self, request):
        """Record a chapter read; updates progress and continue-reading too."""
        serializer = RecordReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        history = services.record_chapter_read(
            user=request.user,
            chapter=serializer.validated_data['chapter'],
            furthest_verse_number=serializer.validated_data.get('furthest_verse_number'),
            completed=serializer.validated_data.get('completed', False),
        )
        return Response(
            ReadingHistorySerializer(history).data, status=status.HTTP_201_CREATED
        )


class ContinueReadingView(RetrieveAPIView):
    """The single resumable position — the Today screen's Continue Reading card."""

    serializer_class = ContinueReadingSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        position = services.get_continue_reading(request.user)
        if position is None:
            return Response(
                {'detail': 'Nothing to continue yet.'}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(ContinueReadingSerializer(position).data)
