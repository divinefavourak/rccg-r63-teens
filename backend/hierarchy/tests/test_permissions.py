"""The DRF HasCapability object-level permission."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from hierarchy import services
from hierarchy.models import NodeType, RoleAssignment
from hierarchy.permissions import HasCapability
from hierarchy.services import Capability

User = get_user_model()


class _ScopedObject:
    """Stand-in for a future scoped model (content/event) with a visibility_node."""
    def __init__(self, node):
        self.visibility_node = node


class HasCapabilityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        national = services.create_root('RCCG National')
        region = services.add_child(national, NodeType.REGION, 'Region 63')
        prov = services.add_child(region, NodeType.PROVINCE, 'Prov 9')
        zone = services.add_child(prov, NodeType.ZONE, 'Zone 1')
        self.area = services.add_child(zone, NodeType.AREA, 'Area A')
        self.parish = services.add_child(self.area, NodeType.PARISH, 'Parish A')
        self.other_area = services.add_child(zone, NodeType.AREA, 'Area B')

        self.coord = User.objects.create_user(
            username='coord', email='coord@example.com', password='x',
            first_name='Co', last_name='Ord',
        )
        services.assign_role(self.coord, RoleAssignment.Role.COORDINATOR, self.area)

    def _request(self, user):
        request = self.factory.get('/')
        request.user = user
        return request

    def test_grants_within_scope(self):
        perm = HasCapability(Capability.EVENT_MANAGE)()
        request = self._request(self.coord)
        self.assertTrue(perm.has_object_permission(request, None, _ScopedObject(self.parish)))

    def test_denies_out_of_scope(self):
        perm = HasCapability(Capability.EVENT_MANAGE)()
        request = self._request(self.coord)
        self.assertFalse(perm.has_object_permission(request, None, _ScopedObject(self.other_area)))

    def test_denies_missing_scope_node(self):
        perm = HasCapability(Capability.EVENT_MANAGE)()
        request = self._request(self.coord)
        self.assertFalse(perm.has_object_permission(request, None, _ScopedObject(None)))

    def test_unauthenticated_has_no_permission(self):
        from django.contrib.auth.models import AnonymousUser
        perm = HasCapability(Capability.EVENT_MANAGE)()
        request = self._request(AnonymousUser())
        self.assertFalse(perm.has_permission(request, None))

    def test_has_permission_coarse_gate_denies_non_leader(self):
        """The footgun fix: a plain authenticated user cannot pass the collection
        gate on a capability-guarded endpoint (e.g. create)."""
        teen = User.objects.create_user(
            username='teen', email='teen@example.com', password='x',
            first_name='Te', last_name='En',
        )
        perm = HasCapability(Capability.EVENT_MANAGE)()
        self.assertFalse(perm.has_permission(self._request(teen), object()))

    def test_has_permission_coarse_gate_allows_leader(self):
        perm = HasCapability(Capability.EVENT_MANAGE)()
        self.assertTrue(perm.has_permission(self._request(self.coord), object()))

    def test_has_permission_uses_view_node_resolver(self):
        class _View:
            def __init__(self, node):
                self._node = node
            def get_capability_node(self, request):
                return self._node

        perm = HasCapability(Capability.EVENT_MANAGE)()
        request = self._request(self.coord)
        self.assertTrue(perm.has_permission(request, _View(self.parish)))       # in scope
        request = self._request(self.coord)  # fresh (avoid cached assignments across asserts)
        self.assertFalse(perm.has_permission(request, _View(self.other_area)))  # out of scope
