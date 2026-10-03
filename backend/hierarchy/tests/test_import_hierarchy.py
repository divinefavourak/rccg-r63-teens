"""`manage.py import_hierarchy`: zones, areas and parishes from a CSV."""
import os
import tempfile
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from hierarchy import services
from hierarchy.models import HierarchyNode, NodeType

HEADER = 'province,zone,area,parish\n'


class ImportHierarchyTests(TestCase):
    def setUp(self):
        national = services.create_root('RCCG National')
        self.region = services.add_child(national, NodeType.REGION, 'Region 63')
        services.add_child(self.region, NodeType.PROVINCE, 'Lagos Province 9')
        services.add_child(self.region, NodeType.PROVINCE, 'Unassigned')

    def _run(self, body, *args):
        fd, path = tempfile.mkstemp(suffix='.csv')
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            fh.write(HEADER + body)
        self.addCleanup(os.remove, path)
        out = StringIO()
        call_command('import_hierarchy', path, *args, stdout=out)
        return out.getvalue()

    def _count(self, node_type):
        return HierarchyNode.objects.filter(node_type=node_type).count()

    def test_builds_the_path_under_an_existing_province(self):
        out = self._run('Lagos Province 9,Holiness Zone,Agege Area,RCCG Holiness Assembly\n')
        self.assertIn('zones:1 areas:1 parishes:1 skipped:0', out)
        parish = HierarchyNode.objects.get(node_type=NodeType.PARISH)
        self.assertEqual([a.name for a in parish.get_ancestors()][-3:],
                         ['Lagos Province 9', 'Holiness Zone', 'Agege Area'])

    def test_is_idempotent_and_ignores_case_and_spacing(self):
        row = 'Lagos Province 9,Holiness Zone,Agege Area,RCCG Holiness Assembly\n'
        self._run(row)
        out = self._run(' lagos province 9 , holiness  zone ,AGEGE AREA,rccg holiness assembly\n')
        self.assertIn('zones:0 areas:0 parishes:0', out)
        self.assertEqual(self._count(NodeType.PARISH), 1)

    def test_siblings_share_their_parents(self):
        self._run('Lagos Province 9,Holiness Zone,Agege Area,Parish A\n'
                  'Lagos Province 9,Holiness Zone,Agege Area,Parish B\n'
                  'Lagos Province 9,Holiness Zone,Ketu Area,Parish C\n')
        self.assertEqual((self._count(NodeType.ZONE), self._count(NodeType.AREA),
                          self._count(NodeType.PARISH)), (1, 2, 3))

    def test_unknown_province_is_skipped_not_created(self):
        out = self._run('Lagos Province 99,Zone X,Area X,Parish X\n')
        self.assertIn('line 2: unknown province "Lagos Province 99"', out)
        self.assertEqual(self._count(NodeType.PROVINCE), 2)
        self.assertEqual(self._count(NodeType.ZONE), 0)

    def test_the_unassigned_bucket_cannot_be_imported_into(self):
        out = self._run('Unassigned,Zone X,Area X,Parish X\n')
        self.assertIn('skipped:1', out)
        self.assertEqual(self._count(NodeType.ZONE), 0)

    def test_a_row_may_stop_early(self):
        out = self._run('Lagos Province 9,Holiness Zone,,\n')
        self.assertIn('zones:1 areas:0 parishes:0 skipped:0', out)

    def test_a_parish_without_its_area_is_reported(self):
        out = self._run('Lagos Province 9,Holiness Zone,,Parish A\n')
        self.assertIn('has a parish but no area', out)
        self.assertEqual(self._count(NodeType.PARISH), 0)
        self.assertEqual(self._count(NodeType.ZONE), 1)

    def test_dry_run_writes_nothing(self):
        out = self._run('Lagos Province 9,Holiness Zone,Agege Area,Parish A\n', '--dry-run')
        self.assertIn('zones:1 areas:1 parishes:1', out)
        self.assertEqual(self._count(NodeType.ZONE), 0)

    def test_missing_region_is_an_error(self):
        with self.assertRaises(CommandError):
            self._run('Lagos Province 9,Z,A,P\n', '--region-name', 'Region 1')
