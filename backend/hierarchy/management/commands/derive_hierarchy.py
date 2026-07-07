"""
Bootstrap a *provisional* hierarchy tree from existing user data.

This derives National -> Region -> Province -> Zone -> Area -> Parish nodes from
the legacy free-text province/zone/area/parish fields, creates a Membership for
every user (unmatched users land in a region-level 'Unassigned' bucket), and
converts each user's legacy `role` into a scoped RoleAssignment.

The tree it produces is PROVISIONAL (memberships are flagged
``is_provisional=True``): it exists to bootstrap development against real-shaped
data and is later reconciled against an authoritative admin CSV
(docs/design/phase1-hierarchy-rbac.md). The command is idempotent and supports
``--dry-run``. It only reads the users/profiles apps and only writes hierarchy
tables — no other app's schema or data is touched.
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from hierarchy import services
from hierarchy.models import HierarchyNode, NodeType, RoleAssignment

User = get_user_model()

# Legacy User.role -> (leadership role, tree level to scope the assignment at).
ROLE_MAP = {
    'admin': (RoleAssignment.Role.ADMIN, NodeType.REGION),
    'coordinator': (RoleAssignment.Role.COORDINATOR, NodeType.PROVINCE),
    'teacher': (RoleAssignment.Role.TEACHER, NodeType.PARISH),
}


def _clean(value):
    return (value or '').strip()


def _province_label(user):
    """Human-readable province name from the legacy enum value, if any."""
    raw = _clean(user.province)
    if not raw:
        return ''
    try:
        return User.Province(raw).label
    except (ValueError, AttributeError):
        return raw


class Command(BaseCommand):
    help = 'Derive a provisional church hierarchy tree from existing user data.'

    def add_arguments(self, parser):
        parser.add_argument('--region-name', default='Region 63',
                            help='Name of the region node to bootstrap under National.')
        parser.add_argument('--national-name', default='RCCG National',
                            help='Name of the root national node.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Roll back all writes and only report what would change.')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        stats = {'nodes_created': 0, 'memberships': 0, 'assignments': 0, 'unassigned': 0}

        try:
            with transaction.atomic():
                national = self._get_or_create_root(options['national_name'], stats)
                region, _ = services.get_or_create_child(
                    national, NodeType.REGION, options['region_name'])
                if _:
                    stats['nodes_created'] += 1
                unassigned, created = services.get_or_create_child(
                    region, NodeType.PROVINCE, 'Unassigned')
                if created:
                    stats['nodes_created'] += 1

                for user in User.objects.all().iterator():
                    self._process_user(user, region, unassigned, stats)

                if dry_run:
                    self.stdout.write(self.style.WARNING('DRY RUN — rolling back.'))
                    transaction.set_rollback(True)
        except Exception as exc:  # surface, never swallow
            self.stderr.write(self.style.ERROR(f'Aborted: {exc}'))
            raise

        self.stdout.write(self.style.SUCCESS(
            'Nodes created: {nodes_created} | memberships: {memberships} | '
            'role assignments: {assignments} | unassigned users: {unassigned}'.format(**stats)
        ))

    def _get_or_create_root(self, name, stats):
        root = HierarchyNode.objects.filter(node_type=NodeType.NATIONAL, name=name).first()
        if root:
            return root
        stats['nodes_created'] += 1
        return services.create_root(name, NodeType.NATIONAL)

    def _process_user(self, user, region, unassigned, stats):
        province_name = _province_label(user)

        deepest = unassigned
        if province_name:
            node, created = services.get_or_create_child(region, NodeType.PROVINCE, province_name)
            stats['nodes_created'] += int(created)
            deepest = node
            for node_type, raw in (
                (NodeType.ZONE, getattr(user, 'zone', '')),
                (NodeType.AREA, getattr(user, 'area', '')),
                (NodeType.PARISH, getattr(user, 'parish', '')),
            ):
                name = _clean(raw)
                if not name:
                    break
                child, created = services.get_or_create_child(deepest, node_type, name)
                stats['nodes_created'] += int(created)
                deepest = child

        if deepest is unassigned:
            stats['unassigned'] += 1

        services.set_membership(user, deepest, is_provisional=True)
        stats['memberships'] += 1

        mapped = ROLE_MAP.get(_clean(user.role))
        if mapped:
            role, level = mapped
            scope = self._node_at_level(deepest, level, region)
            services.assign_role(user, role, scope)
            stats['assignments'] += 1

    @staticmethod
    def _node_at_level(node, target_level, region):
        """Walk up from ``node`` to the ancestor of ``target_level`` (fallback: region)."""
        if node.node_type == target_level:
            return node
        for ancestor in node.get_ancestors():
            if ancestor.node_type == target_level:
                return ancestor
        return region
