"""
Permission tests.

Two rules under test:
  * Scripture is readable by everyone, writable only with `bible.manage`.
  * The personal layer is owner-only — not "owner or admin". Notes, highlights,
    bookmarks and reading data are private absolutely
    (`docs/08-bible-experience.md` §3).
"""
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from bible.models import Bookmark, Highlight, Note
from hierarchy import services as hierarchy_services
from identity.authorization import assign_role
from identity.models import Role

from .base import make_passage, make_user


class ScripturePermissionTests(APITestCase):
    """Everyone can read Scripture; only `bible.manage` may write it."""

    @classmethod
    def setUpTestData(cls):
        call_command('seed_rbac', verbosity=0)
        cls.national = hierarchy_services.create_root('RCCG National')
        cls.translation, cls.book, cls.chapter, cls.verses = make_passage()

    def test_anonymous_user_can_list_translations(self):
        response = self.client.get(reverse('bible-translation-list'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)

    def test_anonymous_user_can_read_a_chapter_with_verses(self):
        url = reverse('bible-chapter-detail', args=[self.chapter.id])
        response = self.client.get(url)
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(2, len(response.data['verses']))

    def test_anonymous_user_can_look_up_a_reference(self):
        response = self.client.get(
            reverse('bible-lookup'), {'book': 'John', 'chapter': 3, 'start_verse': 16}
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(1, len(response.data['verses']))

    def test_anonymous_user_cannot_create_a_translation(self):
        response = self.client.post(
            reverse('bible-translation-list'), {'code': 'XXX', 'name': 'Nope'}
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_ordinary_teen_cannot_create_a_translation(self):
        self.client.force_authenticate(make_user('teen'))
        response = self.client.post(
            reverse('bible-translation-list'), {'code': 'XXX', 'name': 'Nope'}
        )
        self.assertEqual(status.HTTP_403_FORBIDDEN, response.status_code)

    def test_national_coordinator_can_create_a_translation(self):
        coordinator = make_user('coordinator')
        assign_role(
            coordinator,
            Role.objects.get(code='national_coordinator'),
            self.national,
            enforce_escalation=False,
        )
        self.client.force_authenticate(coordinator)
        response = self.client.post(
            reverse('bible-translation-list'),
            {'code': 'KJV', 'name': 'King James Version'},
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)


class PersonalLayerPrivacyTests(APITestCase):
    """
    The privacy invariant: one teen's Scripture life is invisible to every other
    user, including privileged ones. A foreign object 404s (never 403s), so the
    API does not even confirm the row exists.
    """

    @classmethod
    def setUpTestData(cls):
        call_command('seed_rbac', verbosity=0)
        cls.national = hierarchy_services.create_root('RCCG National')
        cls.owner = make_user('owner')
        cls.intruder = make_user('intruder')

        cls.superuser = make_user('root')
        cls.superuser.is_superuser = True
        cls.superuser.is_staff = True
        cls.superuser.save(update_fields=['is_superuser', 'is_staff'])

        cls.coordinator = make_user('coordinator')
        assign_role(
            cls.coordinator,
            Role.objects.get(code='national_coordinator'),
            cls.national,
            enforce_escalation=False,
        )

        _, _, cls.chapter, cls.verses = make_passage()

    def setUp(self):
        self.note = Note.objects.create(
            user=self.owner, verse=self.verses[0], content='private thoughts'
        )
        self.bookmark = Bookmark.objects.create(user=self.owner, verse=self.verses[0])
        self.highlight = Highlight.objects.create(user=self.owner, verse=self.verses[0])

    # --- owner sees their own ------------------------------------------------

    def test_owner_can_read_their_note(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(reverse('bible-note-detail', args=[self.note.id]))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual('private thoughts', response.data['content'])

    def test_owner_note_list_contains_only_their_own(self):
        Note.objects.create(user=self.intruder, verse=self.verses[0], content='theirs')
        self.client.force_authenticate(self.owner)
        response = self.client.get(reverse('bible-note-list'))
        self.assertEqual(1, response.data['count'])
        self.assertEqual('private thoughts', response.data['results'][0]['content'])

    # --- nobody else does ----------------------------------------------------

    def test_another_teen_cannot_read_a_note(self):
        self.client.force_authenticate(self.intruder)
        response = self.client.get(reverse('bible-note-detail', args=[self.note.id]))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_another_teen_cannot_edit_a_note(self):
        self.client.force_authenticate(self.intruder)
        response = self.client.patch(
            reverse('bible-note-detail', args=[self.note.id]), {'content': 'hacked'}
        )
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)
        self.note.refresh_from_db()
        self.assertEqual('private thoughts', self.note.content)

    def test_another_teen_cannot_delete_a_note(self):
        self.client.force_authenticate(self.intruder)
        response = self.client.delete(reverse('bible-note-detail', args=[self.note.id]))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)
        self.assertTrue(Note.objects.filter(pk=self.note.pk).exists())

    def test_a_coordinator_cannot_read_a_teens_note(self):
        """No role unlocks private notes — not even a national coordinator."""
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(reverse('bible-note-detail', args=[self.note.id]))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_a_coordinator_sees_an_empty_note_list(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(reverse('bible-note-list'))
        self.assertEqual(0, response.data['count'])

    def test_a_superuser_does_not_read_notes_through_the_api(self):
        """
        Superusers bypass `HasPermission*`, but the personal layer has no
        permission to bypass — the queryset is owner-scoped.
        """
        self.client.force_authenticate(self.superuser)
        response = self.client.get(reverse('bible-note-detail', args=[self.note.id]))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_highlights_and_bookmarks_are_equally_private(self):
        self.client.force_authenticate(self.intruder)
        for name, obj in (
            ('bible-highlight-detail', self.highlight),
            ('bible-bookmark-detail', self.bookmark),
        ):
            response = self.client.get(reverse(name, args=[obj.id]))
            self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code, name)

    def test_anonymous_user_cannot_touch_the_personal_layer(self):
        response = self.client.get(reverse('bible-note-list'))
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )


class OwnershipAssignmentTests(APITestCase):
    """Ownership comes from the session, never from the request body."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user('owner')
        cls.intruder = make_user('intruder')
        _, _, _, cls.verses = make_passage()

    def test_note_is_owned_by_the_requester_not_the_posted_user(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse('bible-note-list'),
            {'verse': str(self.verses[0].id), 'content': 'mine',
             'user': str(self.intruder.id)},
        )
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)
        note = Note.objects.get(pk=response.data['id'])
        self.assertEqual(self.owner, note.user)
