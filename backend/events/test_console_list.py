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


@override_settings(CACHES=_LOCMEM)
class ConsoleEventOversightTests(TestCase):
    """A manager sees the events of the subtree they manage; `?node=` is a subtree."""

    def setUp(self):
        from events.test_scoping import grant
        self.tree = build_tree()
        make_event('Area B Hangout', self.tree['area_b'], days=5)
        make_event('Area A Hangout', self.tree['area_a'], days=6)
        make_event('Other Region Camp', self.tree['r2'], days=7)
        # Belongs to a parish in Area A, coordinates the whole of Region 63.
        self.coord = make_user('coord')
        set_membership(self.coord, self.tree['parish_a'], is_primary=True)
        grant(self.coord, self.tree['r1'], 'events.view', 'events.manage')
        self.client = APIClient()
        self.client.force_authenticate(self.coord)

    def titles(self, **params):
        res = self.client.get('/api/v1/events/events/', params)
        self.assertEqual(res.status_code, 200)
        return {row['title'] for row in res.data['results']}

    def test_a_manager_sees_events_anywhere_in_the_subtree_they_manage(self):
        self.assertEqual(self.titles(), {'Area A Hangout', 'Area B Hangout'})

    def test_node_narrows_to_that_node_and_everything_beneath_it(self):
        self.assertEqual(self.titles(node=str(self.tree['zone'].pk)),
                         {'Area A Hangout', 'Area B Hangout'})
        self.assertEqual(self.titles(node=str(self.tree['area_b'].pk)), {'Area B Hangout'})

    def test_node_cannot_reach_outside_what_the_caller_may_see(self):
        self.assertEqual(self.titles(node=str(self.tree['r2'].pk)), set())

    def test_a_node_that_is_not_an_id_returns_nothing(self):
        self.assertEqual(self.titles(node='zone-1'), set())
