"""
Grant a role to a user at a hierarchy node.

    python manage.py grant_role tolu regional_coordinator "Region 63"
    python manage.py grant_role tolu@example.com teacher "Parish A" --dry-run
    python manage.py grant_role --list

The bootstrap escape hatch. `derive_hierarchy` maps *legacy* `User.role` strings
onto real `RoleAssignment`s, but it is **fail-closed**: a coordinator whose record
never carried a province cannot be resolved to a province node, so it skips them
and says so. Those people — and anyone appointed after the migration — need an
explicit grant, and a first administrator has to be created by hand from a shell
before anyone can appoint anyone through the API.

Escalation is **not** enforced here, deliberately: this is an operator command run
from a deploy shell by someone who already has the database. Pretending to check
their authority against a role they could simply INSERT would be theatre. The API
path (`identity.authorization.assign_role`) *does* enforce it, and that is the path
every non-bootstrap grant should take.
"""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from hierarchy.models import HierarchyNode
from identity.authorization import assign_role
from identity.models import Role

User = get_user_model()


class Command(BaseCommand):
    help = 'Grant a role to a user at a hierarchy node (bootstrap/operator command).'

    def add_arguments(self, parser):
        parser.add_argument('user', nargs='?',
                            help='Username or e-mail address.')
        parser.add_argument('role', nargs='?',
                            help='Role code, e.g. regional_coordinator.')
        parser.add_argument('node', nargs='?',
                            help='Node name, e.g. "Region 63".')
        parser.add_argument('--dry-run', action='store_true',
                            help='Resolve everything and report, but write nothing.')
        parser.add_argument('--list', action='store_true', dest='list_options',
                            help='List the available roles and nodes, then exit.')

    def handle(self, *args, **options):
        if options['list_options']:
            return self._list()

        for field in ('user', 'role', 'node'):
            if not options[field]:
                raise CommandError(
                    'user, role and node are all required. '
                    'Run with --list to see the available roles and nodes.'
                )

        user = self._resolve_user(options['user'])
        role = self._resolve_role(options['role'])
        node = self._resolve_node(options['node'])

        # The role's own level rule — a parish-level role cannot be granted at a
        # region, and vice versa. Checked before writing so the failure names the
        # real problem instead of surfacing as a constraint error.
        if not role.allows_node_type(node.node_type):
            allowed = ', '.join(role.allowed_node_types) or '(none)'
            raise CommandError(
                f'Role "{role.code}" cannot be held at a {node.node_type} node. '
                f'It is allowed at: {allowed}.'
            )

        if options['dry_run']:
            self.stdout.write(self.style.WARNING(
                f'DRY RUN — would grant {role.code} to {user.get_username()} '
                f'at {node.node_type} "{node.name}".'
            ))
            return

        try:
            assignment = assign_role(user, role, node, enforce_escalation=False)
        except ValidationError as exc:
            raise CommandError('; '.join(exc.messages)) from exc

        self.stdout.write(self.style.SUCCESS(
            f'{user.get_username()} now holds {role.code} at '
            f'{node.node_type} "{node.name}".'
        ))
        self.stdout.write(
            f'  capabilities: {", ".join(sorted(role.permission_codes())) or "(none)"}'
        )
        if not assignment.pk:
            self.stdout.write('  (already held — nothing changed)')

    # -- resolution --------------------------------------------------------

    def _resolve_user(self, value):
        matches = User.objects.filter(
            Q(username__iexact=value) | Q(email__iexact=value)
        )
        if not matches:
            raise CommandError(f'No user matches {value!r}.')
        if len(matches) > 1:
            names = ', '.join(u.get_username() for u in matches)
            raise CommandError(f'{value!r} is ambiguous: {names}.')
        return matches[0]

    def _resolve_role(self, value):
        role = Role.objects.filter(code__iexact=value).first()
        if role is None:
            codes = ', '.join(Role.objects.values_list('code', flat=True))
            raise CommandError(
                f'No role {value!r}. Available: {codes or "(none — run seed_rbac)"}.'
            )
        return role

    def _resolve_node(self, value):
        matches = list(HierarchyNode.objects.filter(name__iexact=value))
        if not matches:
            raise CommandError(
                f'No node named {value!r}. Run with --list to see the tree '
                f'(or derive_hierarchy if it is empty).'
            )
        if len(matches) > 1:
            # Two parishes can legitimately share a name under different areas, so
            # disambiguate by path rather than guessing.
            paths = ', '.join(
                f'{n.name} ({n.node_type}, path {n.path})' for n in matches
            )
            raise CommandError(f'{value!r} is ambiguous: {paths}.')
        return matches[0]

    def _list(self):
        self.stdout.write(self.style.MIGRATE_HEADING('Roles:'))
        roles = Role.objects.all().order_by('code')
        if not roles:
            self.stdout.write('  (none — run: python manage.py seed_rbac)')
        for role in roles:
            allowed = ', '.join(role.allowed_node_types) or 'any'
            self.stdout.write(f'  {role.code:24} allowed at: {allowed}')

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Nodes:'))
        nodes = HierarchyNode.objects.all().order_by('path')
        if not nodes:
            self.stdout.write('  (none — run: python manage.py derive_hierarchy)')
        for node in nodes:
            indent = '  ' * (node.depth - 1)
            self.stdout.write(f'  {indent}{node.node_type:9} {node.name}')
