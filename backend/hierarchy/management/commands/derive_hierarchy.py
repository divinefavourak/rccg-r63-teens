"""
Bootstrap a *provisional* hierarchy tree from existing user data.

Derives National -> Region -> Province -> Zone -> Area -> Parish nodes from the
legacy free-text province/zone/area/parish fields, creates a Membership for
every user (unmatched users land in a region-level 'Unassigned' bucket), and
converts each user's legacy `role` into a scoped RoleAssignment.

The tree it produces is PROVISIONAL (memberships flagged ``is_provisional``): it
bootstraps development against real-shaped data and is later reconciled against
an authoritative admin CSV (docs/design/phase1-hierarchy-rbac.md). Idempotent;
supports ``--dry-run``. Reads only users/profiles; writes only hierarchy tables.

Scope safety: role assignments are **fail-closed**. A role is only granted at a
node of its expected level (admin->region, coordinator->area, teacher->parish).
If the user's data doesn't reach that level, NO role is assigned and the user is
reported for manual handling — we never fall back to a broader scope, because
that would silently over-privilege leaders (e.g. a teacher with a missing parish
becoming a region-wide teacher).

Known limitation: only User.{province,zone,area,parish} are read; TeenProfile is
not consulted here (that reconciliation belongs to the CSV workflow).
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from hierarchy import services
from hierarchy.models import HierarchyNode, NodeType, RoleAssignment

User = get_user_model()

# Legacy User.role -> (leadership role, the exact tree level it must scope to).
ROLE_MAP = {
    'admin': (RoleAssignment.Role.ADMIN, NodeType.REGION),
    'coordinator': (RoleAssignment.Role.COORDINATOR, NodeType.AREA),
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
        self._cache = {}  # (parent_pk, node_type, casefolded_name) -> node
        self._unresolved_roles = []
        stats = {'nodes_created': 0, 'memberships': 0, 'assignments': 0,
                'unassigned': 0, 'roles_unresolved': 0}

        try:
            with transaction.atomic():
                national = self._get_or_create_root(options['national_name'], stats)
                region = self._child(national, NodeType.REGION, options['region_name'], stats)
                unassigned = self._child(region, NodeType.PROVINCE, 'Unassigned', stats)

                for user in User.objects.all().iterator():
                    self._process_user(user, region, unassigned, stats)

                if dry_run:
                    self.stdout.write(self.style.WARNING('DRY RUN — rolling back.'))
                    transaction.set_rollback(True)
        except Exception as exc:  # surface, never swallow
            self.stderr.write(self.style.ERROR(f'Aborted: {exc}'))
            raise

        if self._unresolved_roles:
            self.stdout.write(self.style.WARNING(
                'Users needing manual role scoping (data did not reach the '
                'required level):'))
            for username, role, level in self._unresolved_roles:
                self.stdout.write(f'  - {username}: {role} needs a {level} node')

        self.stdout.write(self.style.SUCCESS(
            'Nodes created: {nodes_created} | memberships: {memberships} | '
            'role assignments: {assignments} | unassigned users: {unassigned} | '
            'roles unresolved: {roles_unresolved}'.format(**stats)
        ))

    # -- node helpers (cached to avoid an O(users x depth) query storm) --------

    def _get_or_create_root(self, name, stats):
        root = HierarchyNode.objects.filter(node_type=NodeType.NATIONAL, name=name).first()
        if root:
            self._cache[(None, NodeType.NATIONAL, name.casefold())] = root
            return root
        stats['nodes_created'] += 1
        root = services.create_root(name, NodeType.NATIONAL)
        self._cache[(None, NodeType.NATIONAL, name.casefold())] = root
        return root

    def _child(self, parent, node_type, name, stats):
        """Cached get-or-create; hits the DB at most once per unique node."""
        key = (parent.pk, node_type, name.strip().casefold())
        node = self._cache.get(key)
        if node is not None:
            return node
        node, created = services.get_or_create_child(parent, node_type, name)
        stats['nodes_created'] += int(created)
        self._cache[key] = node
        return node

    # -- per-user processing ---------------------------------------------------

    def _process_user(self, user, region, unassigned, stats):
        province_name = _province_label(user)

        deepest = unassigned
        if province_name:
            deepest = self._child(region, NodeType.PROVINCE, province_name, stats)
            for node_type, raw in (
                (NodeType.ZONE, getattr(user, 'zone', '')),
                (NodeType.AREA, getattr(user, 'area', '')),
                (NodeType.PARISH, getattr(user, 'parish', '')),
            ):
                name = _clean(raw)
                if not name:
                    break
                deepest = self._child(deepest, node_type, name, stats)

        if deepest is unassigned:
            stats['unassigned'] += 1

        services.set_membership(user, deepest, is_provisional=True)
        stats['memberships'] += 1

        mapped = ROLE_MAP.get(_clean(user.role))
        if not mapped:
            return
        role, level = mapped
        scope = self._resolve_scope(deepest, level)
        if scope is None:
            stats['roles_unresolved'] += 1
            self._unresolved_roles.append((user.get_username(), role, level))
            return
        services.assign_role(user, role, scope)
        stats['assignments'] += 1

    @staticmethod
    def _resolve_scope(node, target_level):
        """The ancestor-or-self of ``node`` at ``target_level``, or None.

        Fail-closed: returns None rather than a broader fallback, so a role is
        never granted at a wider scope than the user's data supports.
        """
        if node.node_type == target_level:
            return node
        for ancestor in node.get_ancestors():
            if ancestor.node_type == target_level:
                return ancestor
        return None
