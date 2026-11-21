"""
The devotional view counter: who is counted, and where the Console reads it.

A reader opening a devotional counts once per window (common/view_counts.py).
The Console's preview and editor send ?count=0, so an editor checking a
devotional does not add to the views the Console then shows.
"""
import datetime

from django.test import override_settings
from rest_framework.test import APITestCase

from content.models import Devotional

LOCAL_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


@override_settings(CACHES=LOCAL_CACHE)
class DevotionalViewCounterTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.devotional = Devotional.objects.create(
            date=datetime.date(2026, 7, 9),
            title='Faith that moves mountains',
            content='Message body.',
            status=Devotional.Status.PUBLISHED,
        )
        self.url = f'/api/v1/content/devotionals/{self.devotional.id}/'

    def views(self):
        self.devotional.refresh_from_db()
        return self.devotional.view_count

    def test_a_reader_is_counted(self):
        self.assertEqual(200, self.client.get(self.url).status_code)
        self.assertEqual(1, self.views())

    def test_the_console_preview_is_not_counted(self):
        self.assertEqual(200, self.client.get(self.url, {'count': '0'}).status_code)
        self.assertEqual(0, self.views())

    def test_any_other_count_value_still_counts(self):
        self.client.get(self.url, {'count': '1'})
        self.assertEqual(1, self.views())

    def test_the_list_carries_views_and_reads(self):
        Devotional.objects.filter(pk=self.devotional.pk).update(view_count=10, read_count=4)

        response = self.client.get('/api/v1/content/devotionals/', {'status': 'published'})

        self.assertEqual(200, response.status_code)
        body = response.json()
        row = next(r for r in body.get('results', body) if r['id'] == str(self.devotional.id))
        self.assertEqual(10, row['view_count'])
        self.assertEqual(4, row['read_count'])
