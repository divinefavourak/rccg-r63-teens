"""Tests for verse sharing (`bible/sharing.py`) — the growth loop and the licence boundary."""
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from bible import sharing
from bible.importers import import_translation
from bible.models import BibleTranslation

JOHN_3 = [
    'There was a man of the Pharisees named Nicodemus.',
    'He came to Jesus by night.',
    'Jesus answered him, "Most certainly I tell you."',
]


def import_web():
    import_translation({
        'translation': {'code': 'WEB', 'name': 'World English Bible',
                        'is_public_domain': True, 'is_default': True},
        'books': [{'osis_code': 'John', 'chapters': [JOHN_3]}],
    })
    return BibleTranslation.objects.get(code='WEB')


def import_licensed(code='NIV', **overrides):
    """A licensed translation with a copyright line and a consecutive-verse cap."""
    meta = {
        'code': code, 'name': 'Licensed Version', 'source_type': 'remote',
        'is_public_domain': False, 'attribution_required': True,
        'copyright_notice': 'Scripture quotations taken from the Licensed Version. '
                            'Copyright © 2020. Used by permission.',
        'is_offline_capable': False,
    }
    meta.update(overrides)
    import_translation({
        'translation': meta,
        'books': [{'osis_code': 'John', 'chapters': [JOHN_3]}],
    })
    translation = BibleTranslation.objects.get(code=code)
    return translation


@override_settings(FRONTEND_URL='https://faithtribe.app', APP_NAME='Faith Tribe')
class SharePayloadTests(TestCase):

    def setUp(self):
        self.translation = import_web()

    def test_single_verse_share_text_matches_the_documented_format(self):
        payload = sharing.share_payload(self.translation, 'John', 1, 1)

        self.assertEqual(
            payload['share_text'],
            '"There was a man of the Pharisees named Nicodemus." — John 1:1 (WEB), '
            'via Faith Tribe\nhttps://faithtribe.app/bible/John/1?verse=1',
        )

    def test_copy_text_omits_the_link(self):
        """Copy (§3) is for pasting a verse elsewhere — our URL does not belong in it."""
        payload = sharing.share_payload(self.translation, 'John', 1, 1)

        self.assertNotIn('faithtribe.app', payload['copy_text'])
        self.assertEqual(
            payload['copy_text'],
            '"There was a man of the Pharisees named Nicodemus." — John 1:1 (WEB)',
        )

    def test_a_range_joins_the_verses_and_renders_the_range_reference(self):
        payload = sharing.share_payload(self.translation, 'John', 1, 1, 2)

        self.assertEqual(payload['reference'], 'John 1:1-2')
        self.assertEqual(payload['text'], f'{JOHN_3[0]} {JOHN_3[1]}')
        self.assertIn('end=2', payload['deep_link'])

    def test_a_range_running_past_the_chapter_is_attributed_to_what_exists(self):
        """Asking for 1-9 in a three-verse chapter must not claim to be 1:1-9."""
        payload = sharing.share_payload(self.translation, 'John', 1, 1, 9)

        self.assertEqual(payload['reference'], 'John 1:1-3')
        self.assertEqual(payload['end_verse'], 3)

    def test_whole_chapter_share(self):
        payload = sharing.share_payload(self.translation, 'John', 1)

        self.assertEqual(payload['reference'], 'John 1')
        self.assertIsNone(payload['start_verse'])

    def test_a_public_domain_translation_gets_a_simple_tag(self):
        payload = sharing.share_payload(self.translation, 'John', 1, 1)

        self.assertEqual(payload['attribution'], '(WEB)')
        self.assertFalse(payload['attribution_required'])

    def test_deep_link_uses_osis_and_numbers_not_database_ids(self):
        """The link must survive a re-import and resolve in any translation."""
        payload = sharing.share_payload(self.translation, 'John', 1, 1)

        self.assertEqual(payload['deep_link'],
                         'https://faithtribe.app/bible/John/1?verse=1')

    def test_sharing_an_unimported_passage_is_an_error_not_an_empty_card(self):
        with self.assertRaises(LookupError):
            sharing.share_payload(self.translation, 'John', 99, 1)


@override_settings(FRONTEND_URL='https://faithtribe.app')
class LicensedTranslationTests(TestCase):
    """docs/08-bible-experience.md §11, operating rules 2 and 3."""

    def test_a_licensed_verse_carries_its_copyright_line(self):
        translation = import_licensed()

        payload = sharing.share_payload(translation, 'John', 1, 1)

        self.assertTrue(payload['attribution_required'])
        self.assertIn('Used by permission.', payload['share_text'])
        self.assertIn('Copyright', payload['attribution'])

    def test_a_share_within_the_licence_cap_is_allowed(self):
        translation = import_licensed(max_consecutive_verses=2)

        payload = sharing.share_payload(translation, 'John', 1, 1, 2)

        self.assertEqual(payload['reference'], 'John 1:1-2')

    def test_a_share_past_the_licence_cap_is_refused(self):
        translation = import_licensed(max_consecutive_verses=2)

        with self.assertRaises(sharing.ShareLimitExceeded):
            sharing.share_payload(translation, 'John', 1, 1, 3)

    def test_the_cap_counts_verses_actually_returned(self):
        """A whole-chapter share of a 3-verse chapter breaches a 2-verse cap."""
        translation = import_licensed(max_consecutive_verses=2)

        with self.assertRaises(sharing.ShareLimitExceeded):
            sharing.share_payload(translation, 'John', 1)

    def test_no_cap_means_no_limit(self):
        translation = import_licensed()   # max_consecutive_verses is NULL

        payload = sharing.share_payload(translation, 'John', 1)

        self.assertEqual(payload['reference'], 'John 1')


@override_settings(FRONTEND_URL='https://faithtribe.app')
class ShareEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.translation = import_web()
        self.url = reverse('bible-share')

    def test_free_text_share(self):
        response = self.client.get(self.url, {'q': 'jn 1:1'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['reference'], 'John 1:1')
        self.assertIn('via Faith Tribe', response.data['share_text'])

    def test_structured_share(self):
        response = self.client.get(
            self.url, {'book': 'John', 'chapter': 1, 'start_verse': 1, 'end_verse': 2})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['reference'], 'John 1:1-2')

    def test_sharing_is_public(self):
        """A verse card is how a stranger first meets the product."""
        self.assertEqual(self.client.get(self.url, {'q': 'jn 1:1'}).status_code, 200)

    def test_a_licence_breach_is_a_403(self):
        import_licensed(code='NIV', max_consecutive_verses=1, is_default=False)

        response = self.client.get(
            self.url, {'q': 'jn 1:1-3', 'translation': 'NIV'})

        self.assertEqual(response.status_code, 403)
        self.assertIn('at most 1', response.data['detail'])

    def test_an_unimported_passage_is_a_404(self):
        response = self.client.get(self.url, {'q': 'jn 99:1'})
        self.assertEqual(response.status_code, 404)

    def test_a_non_reference_query_is_a_400(self):
        response = self.client.get(self.url, {'q': 'verses about fear'})
        self.assertEqual(response.status_code, 400)
