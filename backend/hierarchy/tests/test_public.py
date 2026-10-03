"""The sign-up church picker: readable without an account, and narrow."""
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from hierarchy import services
from hierarchy.models import NodeType

URL = '/api/v1/hierarchy/public/children/'
_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


@override_settings(CACHES=_LOCMEM)
class PublicChildrenTests(APITestCase):
    def setUp(self):
        cache.clear()
        national = services.create_root('RCCG National')
        self.region = services.add_child(national, NodeType.REGION, 'Region 63')
        services.add_child(national, NodeType.REGION, 'Region 1')
        self.province = services.add_child(self.region, NodeType.PROVINCE, 'Lagos Province 69')
        self.zone = services.add_child(self.province, NodeType.ZONE, 'Zone 4')
        area_a = services.add_child(self.zone, NodeType.AREA, 'Area 1')
        area_b = services.add_child(self.zone, NodeType.AREA, 'Area 2')
        self.parish = services.add_child(area_a, NodeType.PARISH, 'Victory House')
        services.add_child(area_b, NodeType.PARISH, 'Grace Chapel')
        services.add_child(self.parish, NodeType.DEPARTMENT, 'Choir')

    def _names(self, **params):
        res = self.client.get(URL, params)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return [n['name'] for n in res.data['results']]

    def test_no_parent_lists_regions_without_signing_in(self):
        self.assertEqual(self._names(), ['Region 1', 'Region 63'])

    def test_parent_lists_direct_children(self):
        self.assertEqual(self._names(parent=str(self.region.id)), ['Lagos Province 69'])

    def test_type_skips_the_area_level(self):
        self.assertEqual(self._names(parent=str(self.zone.id), type='parish'),
                         ['Grace Chapel', 'Victory House'])

    def test_search_narrows_by_name(self):
        self.assertEqual(self._names(parent=str(self.zone.id), type='parish', q='vict'),
                         ['Victory House'])

    def test_only_name_level_and_id_are_exposed(self):
        res = self.client.get(URL)
        self.assertEqual(set(res.data['results'][0]), {'id', 'name', 'node_type'})

    def test_inactive_nodes_are_hidden(self):
        self.province.is_active = False
        self.province.save(update_fields=['is_active'])
        self.assertEqual(self._names(parent=str(self.region.id)), [])

    def test_departments_are_never_listed(self):
        self.assertEqual(self._names(parent=str(self.parish.id)), [])
        res = self.client.get(URL, {'parent': str(self.parish.id), 'type': 'department'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_unassigned_bucket_is_not_offered(self):
        services.add_child(self.region, NodeType.PROVINCE, 'Unassigned')
        self.assertEqual(self._names(parent=str(self.region.id)), ['Lagos Province 69'])

    def test_unknown_parent_is_404(self):
        res = self.client.get(URL, {'parent': '00000000-0000-0000-0000-000000000000'})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        res = self.client.get(URL, {'parent': 'not-a-uuid'})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
