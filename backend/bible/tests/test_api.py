"""API tests for the Bible endpoints, including query-count regressions."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from bible.models import Bookmark, ContinueReading, Highlight, ReadingHistory, ReadingProgress

from .base import make_chapter, make_passage, make_user, make_verse


class ScriptureReadApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.translation, cls.book, cls.chapter, cls.verses = make_passage(
            verse_numbers=(1, 2, 3)
        )

    def test_default_translation_endpoint(self):
        response = self.client.get(reverse('bible-translation-default'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual('WEB', response.data['code'])

    def test_default_translation_404s_when_none_exist(self):
        self.translation.delete()
        response = self.client.get(reverse('bible-translation-default'))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_books_filter_by_translation_code(self):
        response = self.client.get(reverse('bible-book-list'), {'translation_code': 'web'})
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(1, response.data['count'])

    def test_book_chapters_action(self):
        response = self.client.get(reverse('bible-book-chapters', args=[self.book.id]))
        self.assertEqual(status.HTTP_200_OK, response.status_code)

    def test_chapter_detail_embeds_verses_without_n_plus_one(self):
        url = reverse('bible-chapter-detail', args=[self.chapter.id])
        # 1 chapter (joined to book+translation) + 1 prefetch for verses.
        with self.assertNumQueries(2):
            response = self.client.get(url)
        self.assertEqual(3, len(response.data['verses']))

    def test_lookup_requires_book_and_chapter(self):
        response = self.client.get(reverse('bible-lookup'), {'book': 'John'})
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_lookup_rejects_non_integer_chapter(self):
        response = self.client.get(reverse('bible-lookup'), {'book': 'John', 'chapter': 'x'})
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_lookup_returns_whole_chapter_by_default(self):
        response = self.client.get(reverse('bible-lookup'), {'book': 'John', 'chapter': 3})
        self.assertEqual(3, len(response.data['verses']))

    def test_lookup_of_unimported_passage_is_empty_not_404(self):
        response = self.client.get(reverse('bible-lookup'), {'book': 'Rev', 'chapter': 22})
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual([], response.data['verses'])

    def test_inactive_translation_hidden_from_readers(self):
        self.translation.is_active = False
        self.translation.save(update_fields=['is_active'])
        response = self.client.get(reverse('bible-translation-list'))
        self.assertEqual(0, response.data['count'])


class BookmarkApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user()
        _, _, cls.chapter, cls.verses = make_passage()

    def setUp(self):
        self.client.force_authenticate(self.user)

    def test_create_verse_bookmark(self):
        response = self.client.post(
            reverse('bible-bookmark-list'), {'verse': str(self.verses[0].id)}
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)
        self.assertEqual(self.user, Bookmark.objects.get().user)

    def test_create_chapter_bookmark(self):
        response = self.client.post(
            reverse('bible-bookmark-list'), {'chapter': str(self.chapter.id)}
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)

    def test_duplicate_bookmark_is_a_400_not_a_500(self):
        Bookmark.objects.create(user=self.user, verse=self.verses[0])
        response = self.client.post(
            reverse('bible-bookmark-list'), {'verse': str(self.verses[0].id)}
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_bookmark_needs_exactly_one_target(self):
        both = self.client.post(
            reverse('bible-bookmark-list'),
            {'verse': str(self.verses[0].id), 'chapter': str(self.chapter.id)},
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, both.status_code)

        neither = self.client.post(reverse('bible-bookmark-list'), {})
        self.assertEqual(status.HTTP_400_BAD_REQUEST, neither.status_code)

    def test_delete_own_bookmark(self):
        bookmark = Bookmark.objects.create(user=self.user, verse=self.verses[0])
        response = self.client.delete(reverse('bible-bookmark-detail', args=[bookmark.id]))
        self.assertEqual(status.HTTP_204_NO_CONTENT, response.status_code)
        self.assertEqual(0, Bookmark.objects.count())


class HighlightApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user()
        _, _, _, cls.verses = make_passage()

    def setUp(self):
        self.client.force_authenticate(self.user)

    def test_create_highlight_defaults_to_yellow(self):
        response = self.client.post(
            reverse('bible-highlight-list'), {'verse': str(self.verses[0].id)}
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)
        self.assertEqual('yellow', response.data['color'])

    def test_duplicate_highlight_is_a_400(self):
        Highlight.objects.create(user=self.user, verse=self.verses[0])
        response = self.client.post(
            reverse('bible-highlight-list'),
            {'verse': str(self.verses[0].id), 'color': 'blue'},
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_recolour_via_patch(self):
        highlight = Highlight.objects.create(user=self.user, verse=self.verses[0])
        response = self.client.patch(
            reverse('bible-highlight-detail', args=[highlight.id]), {'color': 'pink'}
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual('pink', response.data['color'])

    def test_rejects_unknown_colour(self):
        response = self.client.post(
            reverse('bible-highlight-list'),
            {'verse': str(self.verses[0].id), 'color': 'chartreuse'},
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)


class NoteApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user()
        _, _, _, cls.verses = make_passage()

    def setUp(self):
        self.client.force_authenticate(self.user)

    def test_create_and_edit_a_note(self):
        created = self.client.post(
            reverse('bible-note-list'),
            {'verse': str(self.verses[0].id), 'content': 'first draft'},
        )
        self.assertEqual(status.HTTP_201_CREATED, created.status_code)

        edited = self.client.patch(
            reverse('bible-note-detail', args=[created.data['id']]),
            {'content': 'revised'},
        )
        self.assertEqual(status.HTTP_200_OK, edited.status_code)
        self.assertEqual('revised', edited.data['content'])
        self.assertIn('created_at', edited.data)
        self.assertIn('updated_at', edited.data)

    def test_empty_note_is_rejected(self):
        response = self.client.post(
            reverse('bible-note-list'), {'verse': str(self.verses[0].id), 'content': '   '}
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)


class ReadingApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user()
        _, cls.book, cls.chapter, _ = make_passage()

    def setUp(self):
        self.client.force_authenticate(self.user)

    def test_record_read_creates_history_progress_and_position(self):
        response = self.client.post(
            reverse('bible-reading-history-record'),
            {'chapter': str(self.chapter.id), 'furthest_verse_number': 4, 'completed': True},
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)
        self.assertEqual(1, ReadingHistory.objects.filter(user=self.user).count())

        progress = ReadingProgress.objects.get(user=self.user)
        self.assertEqual(4, progress.furthest_verse_number)
        self.assertTrue(progress.is_completed)
        self.assertEqual(1, ContinueReading.objects.filter(user=self.user).count())

    def test_reading_history_is_read_only(self):
        response = self.client.post(
            reverse('bible-reading-history-list'), {'chapter': str(self.chapter.id)}
        )
        self.assertEqual(status.HTTP_405_METHOD_NOT_ALLOWED, response.status_code)

    def test_reading_progress_is_read_only(self):
        response = self.client.post(
            reverse('bible-reading-progress-list'), {'chapter': str(self.chapter.id)}
        )
        self.assertEqual(status.HTTP_405_METHOD_NOT_ALLOWED, response.status_code)

    def test_continue_reading_404s_before_any_reading(self):
        response = self.client.get(reverse('bible-continue-reading'))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_continue_reading_after_a_read(self):
        self.client.post(
            reverse('bible-reading-history-record'),
            {'chapter': str(self.chapter.id), 'furthest_verse_number': 2},
        )
        response = self.client.get(reverse('bible-continue-reading'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(2, response.data['verse_number'])
        self.assertEqual('WEB', response.data['translation_code'])

    def test_continue_reading_requires_authentication(self):
        self.client.force_authenticate(None)
        response = self.client.get(reverse('bible-continue-reading'))
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_recording_an_unknown_chapter_is_a_400(self):
        response = self.client.post(
            reverse('bible-reading-history-record'),
            {'chapter': '00000000-0000-0000-0000-000000000000'},
        )
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_reading_history_list_avoids_n_plus_one(self):
        other = make_chapter(self.book, number=9)
        make_verse(other, number=1)
        for chapter in (self.chapter, other):
            self.client.post(
                reverse('bible-reading-history-record'), {'chapter': str(chapter.id)}
            )
        # Query count must not grow with the number of history rows.
        with self.assertNumQueries(2):  # count + page (fully joined)
            response = self.client.get(reverse('bible-reading-history-list'))
        self.assertEqual(2, response.data['count'])
