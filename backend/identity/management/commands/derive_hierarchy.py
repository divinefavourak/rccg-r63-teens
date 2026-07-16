"""
Bootstrap a *provisional* org tree + memberships + leadership roles from the
legacy user data (moved here from `hierarchy` in Phase 1B: it writes identity
models, which depend on hierarchy).

For each user it ensures the National->Region->Province->Zone->Area->Parish path
exists, creates a primary Membership at the deepest resolved node (unmatched ->
region 'Unassigned' bucket), and — for legacy leaders — a RoleAssignment using
the seeded DB roles, **fail-closed** (skipped + reported when the data doesn't
reach the role's required node level). Idempotent; supports ``--dry-run``.
Requires roles to be seeded first (``manage.py seed_rbac``).
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from hierarchy import services
from hierarchy.models import HierarchyNode, NodeType
from identity.authorization import set_membership
from identity.models import Role, RoleAssignment

User = get_user_model()

# Legacy User.role -> (seeded Role code, required node level). Teens/individuals
# get only a Membership (no RoleAssignment — the 'teen' role carries no authority).
ROLE_MAP = {
    'admin': ('regional_coordinator', NodeType.REGION),
    'coordinator': ('province_coordinator', NodeType.PROVINCE),
    'teacher': ('teacher', NodeType.PARISH),
}


def _clean(v):
    return (v or '').strip()


def _province_label(user):
    raw = _clean(user.province)
    if not raw:
        return ''
    try:
        return User.Province(raw).label
    except (ValueError, AttributeError):
        return raw


class Command(BaseCommand):
    help = 'Provision org tree, memberships and leadership roles from legacy user data.'

    def add_arguments(self, parser):
        parser.add_argument('--region-name', default='Region 63')
        parser.add_argument('--national-name', default='RCCG National')
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        self._cache = {}
        self._unresolved = []
        roles = {r.code: r for r in Role.objects.all()}
        needed = {code for code, _ in ROLE_MAP.values()}
        missing = needed - set(roles)
        if missing:
            raise CommandError(f'Roles not seeded: {sorted(missing)}. Run seed_rbac first.')

        stats = {'nodes_created': 0, 'memberships': 0, 'assignments': 0,
                'unassigned': 0, 'roles_unresolved': 0}
        try:
            with transaction.atomic():
                national = self._root(options['national_name'], stats)
                region = self._child(national, NodeType.REGION, options['region_name'], stats)
                unassigned = self._child(region, NodeType.PROVINCE, 'Unassigned', stats)
                for user in User.objects.all().iterator():
                    self._process(user, region, unassigned, roles, stats)
                if options['dry_run']:
                    self.stdout.write(self.style.WARNING('DRY RUN — rolling back.'))
                    transaction.set_rollback(True)
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f'Aborted: {exc}'))
            raise

        for username, code, level in self._unresolved:
            self.stdout.write(self.style.WARNING(
                f'  unresolved: {username} needs a {level} node for role {code}'))
        self.stdout.write(self.style.SUCCESS(
            'nodes:{nodes_created} memberships:{memberships} assignments:{assignments} '
            'unassigned:{unassigned} unresolved:{roles_unresolved}'.format(**stats)))

    def _root(self, name, stats):
        root = HierarchyNode.objects.filter(node_type=NodeType.NATIONAL, name=name).first()
        if not root:
            root = services.create_root(name, NodeType.NATIONAL)
            stats['nodes_created'] += 1
        self._cache[(None, NodeType.NATIONAL, name.casefold())] = root
        return root

    def _child(self, parent, node_type, name, stats):
        key = (parent.pk, node_type, name.strip().casefold())
        if key in self._cache:
            return self._cache[key]
        node, created = services.get_or_create_child(parent, node_type, name)
        stats['nodes_created'] += int(created)
        self._cache[key] = node
        return node

    def _process(self, user, region, unassigned, roles, stats):
        deepest = unassigned
        province = _province_label(user)
        if province:
            deepest = self._child(region, NodeType.PROVINCE, province, stats)
            for node_type, raw in ((NodeType.ZONE, getattr(user, 'zone', '')),
                                   (NodeType.AREA, getattr(user, 'area', '')),
                                   (NodeType.PARISH, getattr(user, 'parish', ''))):
                name = _clean(raw)
                if not name:
                    break
                deepest = self._child(deepest, node_type, name, stats)
        if deepest is unassigned:
            stats['unassigned'] += 1

        set_membership(user, deepest, is_primary=True)
        stats['memberships'] += 1

        mapped = ROLE_MAP.get(_clean(user.role))
        if not mapped:
            return
        role_code, level = mapped
        scope = self._resolve(deepest, level)
        if scope is None:
            stats['roles_unresolved'] += 1
            self._unresolved.append((user.get_username(), role_code, level))
            return
        RoleAssignment.objects.get_or_create(
            user=user, role=roles[role_code], node=scope, is_active=True,
        )
        stats['assignments'] += 1

    @staticmethod
    def _resolve(node, level):
        if node.node_type == level:
            return node
        for ancestor in node.get_ancestors():
            if ancestor.node_type == level:
                return ancestor
        return None
