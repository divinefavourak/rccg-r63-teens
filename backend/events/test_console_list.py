"""The two things the Console's Events list asks of the events endpoint."""
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from events.models import Event
from identity.authorization import set_membership
from identity.tests.base import build_tree, make_user

_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


def make_event(title, scope_node, days):
    start = timezone.now() + timedelta(days=days)
    return Event.objects.create(
        title=title, slug=title.lower().replace(' ', '-'), description='.',
        start_datetime=start, end_datetime=start + timedelta(hours=3),
        scope_node=scope_node, status=Event.Status.PUBLISHED,
    )


@override_settings(CACHES=_LOCMEM)
class ConsoleEventListTests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        make_event('Next Camp', self.tree['r1'], days=7)
        make_event('Last Camp', self.tree['r1'], days=-30)
        make_event('Open To All', None, days=3)
        teen = make_user('teen')
        set_membership(teen, self.tree['parish_a'], is_primary=True)
        self.client = APIClient()
        self.client.force_authenticate(teen)

    def rows(self, **params):
        res = self.client.get('/api/v1/events/events/', params)
        self.assertEqual(res.status_code, 200)
        return {row['title']: row for row in res.data['results']}

    def test_upcoming_true_is_what_has_not_finished(self):
        self.assertEqual(set(self.rows(upcoming='true')), {'Next Camp', 'Open To All'})

    def test_upcoming_false_is_what_has_finished(self):
        self.assertEqual(set(self.rows(upcoming='false')), {'Last Camp'})

    def test_each_row_names_the_node_that_owns_it(self):
        rows = self.rows()
        self.assertEqual(rows['Next Camp']['scope_node_detail'], {
            'id': str(self.tree['r1'].pk), 'name': 'Region 63', 'node_type': 'region',
        })
        self.assertIsNone(rows['Open To All']['scope_node_detail'])
