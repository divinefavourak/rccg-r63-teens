"""
Tests for event hierarchy scoping (backend audit, C2).

Two separable questions, tested separately:
  * `visible_to`   — who may *see* an event (docs/07 §3: "at or above their position")
  * `manageable_by`— who may *edit* it (subtree-scoped `events.manage`)
"""
from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from events import scoping
from events.models import Event
from identity.authorization import set_membership
from identity.tests.base import build_tree, make_user


def grant(user, node, *codes):
    from identity.models import Permission, Role, RoleAssignment, RolePermission

    role, _ = Role.objects.get_or_create(
        code=f'test-{user.username}', defaults={'label': 'Test role'})
    for code in codes:
        permission, _ = Permission.objects.get_or_create(
            code=code, defaults={'label': code})
        RolePermission.objects.get_or_create(role=role, permission=permission)
    RoleAssignment.objects.get_or_create(user=user, role=role, node=node)


def make_event(title, scope_node=None, status=Event.Status.PUBLISHED):
    return Event.objects.create(
        title=title,
        slug=title.lower().replace(' ', '-'),
        description='.',
        start_datetime=timezone.now() + timedelta(days=7),
        end_datetime=timezone.now() + timedelta(days=8),
        scope_node=scope_node,
        status=status,
    )


class VisibilityTests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        self.region_event = make_event('Regional Camp', self.tree['r1'])
        self.province_event = make_event('Province 9 Rally', self.tree['prov'])
        self.area_a_event = make_event('Area A Hangout', self.tree['area_a'])
        self.area_b_event = make_event('Area B Hangout', self.tree['area_b'])
        self.unscoped_event = make_event('Legacy Event', None)

    def visible(self, user):
        return set(
            scoping.visible_to(Event.objects.all(), user)
            .values_list('title', flat=True)
        )

    def test_a_parish_teen_sees_events_at_or_above_their_position(self):
        teen = make_user('teen')
        set_membership(teen, self.tree['parish_a'], is_primary=True)

        self.assertEqual(
            self.visible(teen),
            {'Regional Camp', 'Province 9 Rally', 'Area A Hangout', 'Legacy Event'},
        )

    def test_a_parish_teen_does_not_see_a_sibling_areas_event(self):
        """The whole point of scoping — Area B's hangout is not Area A's business."""
        teen = make_user('teen')
        set_membership(teen, self.tree['parish_a'], is_primary=True)

        self.assertNotIn('Area B Hangout', self.visible(teen))

    def test_a_region_level_member_sees_only_region_wide_events(self):
        """
        "At or above" is not "everything". A member placed at the region does not
        sit inside Area A's subtree, so Area A's local hangout is not theirs.
        """
        leader = make_user('regional')
        set_membership(leader, self.tree['r1'], is_primary=True)

        self.assertEqual(self.visible(leader), {'Regional Camp', 'Legacy Event'})

    def test_a_user_with_no_position_sees_everything(self):
        """
        A guest, or a teen still in the Unassigned bucket, must not be shown an
        empty events screen. Scoping narrows what a *placed* user sees; it is not
        an authentication gate.
        """
        drifter = make_user('drifter')

        self.assertEqual(len(self.visible(drifter)), 5)

    def test_an_anonymous_user_sees_everything(self):
        from django.contrib.auth.models import AnonymousUser

        self.assertEqual(len(self.visible(AnonymousUser())), 5)

    def test_an_unscoped_event_is_visible_to_everyone(self):
        """NULL scope_node = 'everywhere' — the faithful reading of the old empty list."""
        teen = make_user('teen')
        set_membership(teen, self.tree['parish_a'], is_primary=True)

        self.assertIn('Legacy Event', self.visible(teen))

    def test_a_second_region_is_isolated(self):
        """Proof the tenancy actually holds: Region 30 cannot see Region 63's camp."""
        other_region_teen = make_user('other')
        set_membership(other_region_teen, self.tree['r2'], is_primary=True)

        self.assertEqual(self.visible(other_region_teen), {'Legacy Event'})


class ManageabilityTests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        self.region_event = make_event('Regional Camp', self.tree['r1'])
        self.province_event = make_event('Province 9 Rally', self.tree['prov'])
        self.area_b_event = make_event('Area B Hangout', self.tree['area_b'])

    def manageable(self, user):
        return set(
            scoping.manageable_by(Event.objects.all(), user)
            .values_list('title', flat=True)
        )

    def test_a_regional_manager_manages_the_whole_subtree(self):
        leader = make_user('regional')
        grant(leader, self.tree['r1'], 'events.manage')

        self.assertEqual(
            self.manageable(leader),
            {'Regional Camp', 'Province 9 Rally', 'Area B Hangout'},
        )

    def test_a_province_manager_cannot_manage_the_region_above_them(self):
        """
        The row-level scoping the audit said was blocked. A province coordinator
        editing the region's camp was previously impossible to prevent.
        """
        coordinator = make_user('coordinator')
        grant(coordinator, self.tree['prov'], 'events.manage')

        manageable = self.manageable(coordinator)

        self.assertIn('Province 9 Rally', manageable)
        self.assertIn('Area B Hangout', manageable)      # below them in the tree
        self.assertNotIn('Regional Camp', manageable)    # above them

    def test_a_manager_in_another_region_manages_nothing_here(self):
        outsider = make_user('outsider')
        grant(outsider, self.tree['r2'], 'events.manage')

        self.assertEqual(self.manageable(outsider), set())

    def test_a_user_without_the_capability_manages_nothing(self):
        teen = make_user('teen')
        set_membership(teen, self.tree['parish_a'], is_primary=True)

        self.assertEqual(self.manageable(teen), set())

    def test_a_superuser_manages_everything(self):
        root = make_user('root')
        root.is_superuser = True
        root.save()

        self.assertEqual(len(self.manageable(root)), 3)


class EventListEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.tree = build_tree()
        self.url = reverse('event-list')
        make_event('Regional Camp', self.tree['r1'])
        make_event('Area B Hangout', self.tree['area_b'])
        make_event('Area A Draft', self.tree['area_a'], status=Event.Status.DRAFT)

    def titles(self, response):
        results = response.data.get('results', response.data)
        return {event['title'] for event in results}

    def test_a_teen_sees_only_published_events_at_or_above_them(self):
        teen = make_user('teen')
        set_membership(teen, self.tree['parish_a'], is_primary=True)
        self.client.force_authenticate(teen)

        titles = self.titles(self.client.get(self.url))

        self.assertEqual(titles, {'Regional Camp'})

    def test_a_manager_sees_unpublished_events_only_within_their_subtree(self):
        coordinator = make_user('coordinator')
        set_membership(coordinator, self.tree['area_a'], is_primary=True)
        grant(coordinator, self.tree['area_a'], 'events.manage')
        self.client.force_authenticate(coordinator)

        titles = self.titles(self.client.get(self.url))

        self.assertIn('Area A Draft', titles)        # their own draft
        self.assertIn('Regional Camp', titles)       # published, above them
        self.assertNotIn('Area B Hangout', titles)   # a sibling area's event

    def test_the_node_filter_cannot_widen_access(self):
        """
        The old `?province=` filter let the client choose whose data to read. `?node=`
        filters *within* what is already visible, so pointing it at another area
        returns nothing rather than that area's events.
        """
        teen = make_user('teen')
        set_membership(teen, self.tree['parish_a'], is_primary=True)
        self.client.force_authenticate(teen)

        response = self.client.get(self.url, {'node': str(self.tree['area_b'].id)})

        self.assertEqual(self.titles(response), set())
