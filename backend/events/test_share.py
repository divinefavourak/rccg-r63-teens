"""Sharing an event: the link, the page behind it, and the flier it previews."""
import io
import shutil
import tempfile

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from events import share
from events.models import Event
from events.test_registration_counters import make_event

_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


def big_flier(name='flier.png'):
    """A noisy picture, several MB as a PNG, as a flier straight from a design app."""
    image = Image.effect_noise((2400, 3000), 25).convert('RGB')
    out = io.BytesIO()
    image.save(out, 'PNG')
    return SimpleUploadedFile(name, out.getvalue(), content_type='image/png')


@override_settings(
    CACHES=_LOCMEM,
    PUBLIC_API_URL='https://api.example.com',
    EVENT_LINK_BASE='',
    WEB_APP_URL='https://app.example.com',
    MOBILE_APP_SCHEME='faithtribe',
    ANDROID_APP_PACKAGE='org.example.app',
)
class ShareLinkTests(TestCase):

    def test_the_link_is_on_our_site_when_one_is_set(self):
        event = make_event(title='Teens Camp', slug='teens-camp')
        with self.settings(EVENT_LINK_BASE='https://www.example.com/e'):
            self.assertEqual(share.link(event), 'https://www.example.com/e/teens-camp')

    def test_otherwise_it_is_on_the_api(self):
        event = make_event(title='Teens Camp', slug='teens-camp')
        self.assertEqual(
            share.link(event), 'https://api.example.com/api/v1/events/share/teens-camp/')

    def test_the_api_hands_the_link_out_with_the_event(self):
        event = make_event(title='Teens Camp', slug='teens-camp')
        detail = self.client.get(f'/api/v1/events/events/{event.pk}/').json()
        listed = self.client.get('/api/v1/events/events/').json()
        rows = listed['results'] if isinstance(listed, dict) else listed

        self.assertEqual(detail['share_url'], share.link(event))
        self.assertEqual(rows[0]['share_url'], share.link(event))

    def test_android_opens_the_app_and_falls_back_to_the_web_app(self):
        event = make_event()
        url = share.android_intent_url(event)

        self.assertTrue(url.startswith(f'intent://event/{event.pk}#Intent;scheme=faithtribe;'))
        self.assertIn('package=org.example.app;', url)
        self.assertIn(f'S.browser_fallback_url=https%3A%2F%2Fapp.example.com%2Fevent%2F{event.pk};', url)


@override_settings(
    CACHES=_LOCMEM,
    PUBLIC_API_URL='https://api.example.com',
    EVENT_LINK_BASE='https://www.example.com/e',
    WEB_APP_URL='https://app.example.com',
    FRONTEND_URL='https://www.example.com',
)
class SharePageTests(TestCase):

    def page(self, key):
        return self.client.get(f'/api/v1/events/share/{key}/')

    def test_found_by_slug_or_by_id(self):
        event = make_event(title='Teens Camp', slug='teens-camp')
        self.assertEqual(self.page('teens-camp').status_code, 200)
        self.assertEqual(self.page(event.pk).status_code, 200)

    def test_a_draft_is_not_shown(self):
        make_event(slug='secret', status=Event.Status.DRAFT)
        response = self.page('secret')

        self.assertEqual(response.status_code, 404)
        self.assertContains(response, 'not here any more', status_code=404)
        self.assertContains(response, 'https://app.example.com/tribe', status_code=404)

    def test_the_preview_names_the_event_in_plain_words(self):
        make_event(
            title='Teens Camp', slug='teens-camp', venue='Redemption Camp',
            description='# Come\n**Bring** your *Bible* and [a friend](https://x.example).')
        response = self.page('teens-camp')

        self.assertContains(response, '<meta property="og:title" content="Teens Camp">', html=False)
        self.assertContains(response, 'Bring your Bible and a friend.')
        self.assertNotContains(response, '**')
        self.assertContains(
            response, '<meta property="og:url" content="https://www.example.com/e/teens-camp">')

    def test_a_venue_ending_in_a_full_stop_gets_only_one(self):
        make_event(slug='nylr', venue='New Jerusalem, Redemption City.', description='Come.')
        response = self.page('nylr')

        self.assertContains(response, ' · New Jerusalem, Redemption City. Come.')
        self.assertNotContains(response, 'City..')

    def test_without_a_flier_the_preview_is_the_sites_card(self):
        make_event(slug='teens-camp')
        self.assertContains(
            self.page('teens-camp'),
            '<meta property="og:image" content="https://www.example.com/og-image.jpg">')

    def test_a_person_is_sent_on_to_the_app_or_the_web_app(self):
        event = make_event(slug='teens-camp')
        response = self.page('teens-camp')

        self.assertContains(response, f'https://app.example.com/event/{event.pk}')
        self.assertContains(response, f'intent://event/{event.pk}#Intent')
        self.assertContains(response, 'location.replace(')


@override_settings(CACHES=_LOCMEM, PUBLIC_API_URL='https://api.example.com')
class FlierTests(TestCase):

    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        storage = self.settings(
            MEDIA_ROOT=self.media,
            STORAGES={
                **settings.STORAGES,
                'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
            },
        )
        storage.enable()
        self.addCleanup(storage.disable)

    def test_a_big_flier_is_made_small_enough_for_whatsapp(self):
        flier = big_flier()
        self.assertGreater(flier.size, 2 * share.FLIER_BUDGET)
        event = make_event(slug='teens-camp', cover_image=flier)

        response = self.client.get('/api/v1/events/share/teens-camp/flier.jpg')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'image/jpeg')
        self.assertLessEqual(len(response.content), share.FLIER_BUDGET)
        image = Image.open(io.BytesIO(response.content))
        self.assertLessEqual(max(image.size), share.FLIER_EDGE)
        # Upright, and in the flier's own shape.
        self.assertAlmostEqual(image.size[0] * 3000 / 2400, image.size[1], delta=1)
        self.assertIn('/flier.jpg?v=', share.preview_image_url(event))

    def test_the_page_names_the_small_flier(self):
        make_event(slug='teens-camp', cover_image=big_flier())
        page = self.client.get('/api/v1/events/share/teens-camp/')
        self.assertContains(
            page, 'content="https://api.example.com/api/v1/events/share/teens-camp/flier.jpg?v=')

    def test_a_flier_already_fit_to_send_is_sent_as_it_is(self):
        # As fliers arrive from WhatsApp: a small JPEG. Encoding it again
        # made a 98 KB flier 142 KB in production.
        out = io.BytesIO()
        Image.linear_gradient('L').resize((980, 1281)).convert('RGB').save(out, 'JPEG', quality=60)
        original = out.getvalue()
        self.assertLess(len(original), share.FLIER_BUDGET)
        make_event(
            slug='teens-camp',
            cover_image=SimpleUploadedFile('flier.jpg', original, content_type='image/jpeg'))

        response = self.client.get('/api/v1/events/share/teens-camp/flier.jpg')

        self.assertEqual(response.content, original)

    def test_no_flier_no_picture(self):
        make_event(slug='teens-camp')
        response = self.client.get('/api/v1/events/share/teens-camp/flier.jpg')
        self.assertEqual(response.status_code, 404)


class PlainTextTests(TestCase):

    def test_marks_come_off(self):
        self.assertEqual(
            share.plain_text(
                '## Day one\n- **Worship** at *9am*\n- ~~Lunch~~ Snacks\n> Iron sharpens iron\n---\n'
                'Read [the plan](https://x.example), keep snake_case_name and 2*3*4.'),
            'Day one Worship at 9am Lunch Snacks Iron sharpens iron '
            'Read the plan, keep snake_case_name and 2*3*4.')

    def test_cut_at_a_word(self):
        self.assertEqual(share.plain_text('one two three four', limit=10), 'one two…')
