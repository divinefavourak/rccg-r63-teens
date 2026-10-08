"""
Load zones, areas and parishes into the org tree from a CSV.

`derive_hierarchy` builds the tree from what users typed on their profiles,
which gets as far as provinces and no further when nobody has entered a zone or
a parish. This fills in the rest from a list the region supplies.

    python manage.py import_hierarchy parishes.csv --dry-run
    python manage.py import_hierarchy parishes.csv

The CSV needs a header row with these columns (extra columns are ignored):

    province,zone,area,parish
    Lagos Province 9,Holiness Zone,Agege Area,RCCG Holiness Assembly

- A row may stop early: `province,zone` alone creates just the zone.
- Names are matched ignoring case and surrounding spaces, so re-running the
  same file creates nothing new. Fix a spelling in the file *before* importing:
  "COFB" and "Church of the First Born" would become two parishes.
- The province must already exist under the region. A typo there is reported
  and the row skipped, rather than quietly creating an eighth province. On a
  database with no provinces yet, pass `--create-provinces` to add the ones the
  file names.
- Nothing is ever deleted or moved, and no memberships are touched.
"""
import csv

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from hierarchy import services
from hierarchy.models import UNASSIGNED_NAME, HierarchyNode, NodeType

LEVELS = (
    ('zone', NodeType.ZONE),
    ('area', NodeType.AREA),
    ('parish', NodeType.PARISH),
)


def _clean(value):
    return ' '.join((value or '').split())


class Command(BaseCommand):
    help = 'Add zones, areas and parishes to the org tree from a CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('csv_path')
        parser.add_argument('--region-name', default='Region 63')
        parser.add_argument(
            '--create-provinces', action='store_true',
            help='Create a province named in the file when the region has none '
                 'by that name. Off by default, so a typo is reported and not '
                 'turned into a new province.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Build, report, then roll everything back.')

    def handle(self, *args, **options):
        region = HierarchyNode.objects.filter(
            node_type=NodeType.REGION, name__iexact=options['region_name'],
        ).first()
        if region is None:
            raise CommandError(
                f'No region named "{options["region_name"]}". Run derive_hierarchy first.')

        provinces = {
            child.name.strip().casefold(): child
            for child in region.get_children()
            if child.node_type == NodeType.PROVINCE
            and child.name.strip().casefold() != UNASSIGNED_NAME.casefold()
        }

        try:
            handle = open(options['csv_path'], newline='', encoding='utf-8-sig')
        except OSError as exc:
            raise CommandError(f'Cannot read {options["csv_path"]}: {exc}')

        created = {'zone': 0, 'area': 0, 'parish': 0}
        skipped = []
        created_provinces = []

        with handle, transaction.atomic():
            reader = csv.DictReader(handle)
            headers = {(h or '').strip().lower() for h in (reader.fieldnames or [])}
            if 'province' not in headers or 'zone' not in headers:
                raise CommandError('The CSV needs at least "province" and "zone" columns.')

            for line, raw in enumerate(reader, start=2):
                row = {(k or '').strip().lower(): _clean(v) for k, v in raw.items()}
                if not any(row.values()):
                    continue

                province_name = row.get('province', '')
                parent = provinces.get(province_name.casefold())
                if parent is None and province_name and options['create_provinces']:
                    parent, _ = services.get_or_create_child(
                        region, NodeType.PROVINCE, province_name)
                    provinces[province_name.casefold()] = parent
                    created_provinces.append(province_name)
                if parent is None:
                    skipped.append((line, f'unknown province "{province_name}"'))
                    continue

                # Each level hangs off the one before it, so a gap ends the row:
                # a parish cannot be placed without its area.
                for column, node_type in LEVELS:
                    name = row.get(column, '')
                    if not name:
                        later = [c for c, _ in LEVELS[[c for c, _ in LEVELS].index(column) + 1:]
                                 if row.get(c)]
                        if later:
                            skipped.append(
                                (line, f'has a {later[0]} but no {column}; stopped at {parent.name}'))
                        break
                    parent, was_created = services.get_or_create_child(parent, node_type, name)
                    created[column] += int(was_created)

            if options['dry_run']:
                self.stdout.write(self.style.WARNING('DRY RUN: nothing was saved.'))
                transaction.set_rollback(True)

        if created_provinces:
            self.stdout.write('provinces created: ' + ', '.join(created_provinces))
        elif skipped and not options['create_provinces']:
            existing = ', '.join(sorted(node.name for node in provinces.values())) or 'none'
            self.stdout.write(self.style.WARNING(
                f'Provinces under {region.name}: {existing}. '
                f'Pass --create-provinces to add the ones in the file.'))
        for line, reason in skipped:
            self.stdout.write(self.style.WARNING(f'  line {line}: {reason}'))
        self.stdout.write(self.style.SUCCESS(
            'zones:{zone} areas:{area} parishes:{parish} skipped:{n}'.format(
                n=len(skipped), **created)))
