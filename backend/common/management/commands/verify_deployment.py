"""
Verify that a deployment is actually ready to serve teens.

    python manage.py verify_deployment
    python manage.py verify_deployment --strict   # warnings are failures too

This is the gate between "the code deployed" and "the product works". They are not
the same thing, and the gap between them is exactly what this command exists to
close: the production database was found running a schema several phases old, with
an RBAC registry seeded but **zero role assignments** and **zero hierarchy nodes** —
a system that starts, serves requests, and quietly does nothing a leader can use.

Every check answers one question: *would a real user hit a wall here?* Each failure
prints the command that fixes it, because a check that tells you something is broken
without telling you what to run is only half a check.

Exit code is non-zero if any check FAILs, so this can gate a deploy pipeline.
"""
from django.conf import settings
from django.core.management.base import BaseCommand

from common.deploy import unapplied_migration_plan

OK, WARN, FAIL = 'OK', 'WARN', 'FAIL'

UNICODE_SYMBOLS = {OK: '✓', WARN: '!', FAIL: '✗'}
ASCII_SYMBOLS = {OK: '[ OK ]', WARN: '[WARN]', FAIL: '[FAIL]'}


def symbols(stream):
    """
    Tick marks where the console can render them, ASCII where it cannot.

    A Windows console defaults to cp1252 and raises `UnicodeEncodeError` on '✗' —
    so a verification command that hard-codes tick marks *crashes on the machine of
    the person trying to verify a deployment*. Degrade instead.
    """
    encoding = getattr(stream, 'encoding', None) or 'ascii'
    try:
        '✓✗'.encode(encoding)
    except (LookupError, UnicodeEncodeError):
        return ASCII_SYMBOLS
    return UNICODE_SYMBOLS


class Result:
    """One check's verdict, plus the command that fixes it."""

    def __init__(self, name, status, detail='', fix=''):
        self.name = name
        self.status = status
        self.detail = detail
        self.fix = fix


# ---------------------------------------------------------------------------
# Checks. Each takes no arguments and returns a Result.
# ---------------------------------------------------------------------------

def check_migrations():
    """Unapplied migrations mean the code and the database disagree about reality."""
    plan, apps = unapplied_migration_plan()

    if not plan:
        return Result('migrations applied', OK, 'schema is current')

    return Result(
        'migrations applied', FAIL,
        f'{len(plan)} unapplied migration(s) in: {", ".join(apps)}',
        'python manage.py migrate',
    )


def check_critical_settings():
    """
    The settings that decide whether this is a production system or an open door.
    """
    problems, warnings = [], []

    if not getattr(settings, 'SECRET_KEY', None):
        problems.append('SECRET_KEY is unset')

    if settings.DEBUG:
        problems.append('DEBUG is True')

    hosts = getattr(settings, 'ALLOWED_HOSTS', [])
    if '*' in hosts:
        # A wildcard host defeats Django's Host-header validation, which is what
        # stands between the app and cache-poisoning / password-reset-link
        # spoofing. It is the default in this settings file — so it is the single
        # most likely thing to still be wrong on the day of launch.
        problems.append("ALLOWED_HOSTS is ['*'] — set it to the real hostnames")

    if not getattr(settings, 'DATABASE_URL', None):
        warnings.append('DATABASE_URL unset (falling back to local sqlite)')

    if not getattr(settings, 'FRONTEND_URL', None):
        warnings.append('FRONTEND_URL unset — verse-share deep links will be relative')

    if problems:
        return Result('critical settings', FAIL, '; '.join(problems),
                      'Set these in the deployment environment, then redeploy.')
    if warnings:
        return Result('critical settings', WARN, '; '.join(warnings))
    return Result('critical settings', OK, 'DEBUG off, hosts pinned, secrets present')


def check_rbac_seeded():
    from identity.models import Permission, Role
    from identity.permissions_registry import ALL_PERMISSION_CODES, ROLE_SEED

    have_perms = set(Permission.objects.values_list('code', flat=True))
    have_roles = set(Role.objects.values_list('code', flat=True))
    missing_perms = set(ALL_PERMISSION_CODES) - have_perms
    missing_roles = {spec['code'] for spec in ROLE_SEED} - have_roles

    if missing_perms or missing_roles:
        detail = []
        if missing_perms:
            detail.append(f'{len(missing_perms)} permission(s) missing')
        if missing_roles:
            detail.append(f'roles missing: {", ".join(sorted(missing_roles))}')
        return Result('RBAC seeded', FAIL, '; '.join(detail),
                      'python manage.py seed_rbac')

    return Result('RBAC seeded', OK,
                  f'{len(have_perms)} permissions, {len(have_roles)} roles')


def check_hierarchy():
    from hierarchy.models import HierarchyNode, NodeType

    total = HierarchyNode.objects.count()
    if total == 0:
        return Result(
            'hierarchy exists', FAIL, 'no hierarchy nodes',
            'python manage.py derive_hierarchy   (build the tree from user data)',
        )

    roots = HierarchyNode.objects.filter(node_type=NodeType.NATIONAL).count()
    regions = HierarchyNode.objects.filter(node_type=NodeType.REGION).count()

    if roots == 0:
        return Result('hierarchy exists', FAIL,
                      f'{total} node(s) but no national root',
                      'python manage.py derive_hierarchy')
    if regions == 0:
        return Result('hierarchy exists', FAIL,
                      f'{total} node(s) but no region — nothing can be scoped',
                      'python manage.py derive_hierarchy')

    return Result('hierarchy exists', OK,
                  f'{total} nodes ({regions} region(s))')


def check_memberships():
    """
    Every user needs a place in the tree, or scoping cannot see them.

    A user with no membership has no *position*: events scoped to their parish will
    not reach them, and `events.scoping.visible_to` will (deliberately) show them
    everything instead. That fails open, so it is a WARN rather than a FAIL — but it
    means the hierarchy is not doing its job for those people.
    """
    from django.contrib.auth import get_user_model
    from identity.models import Membership

    User = get_user_model()
    total_users = User.objects.filter(is_active=True).count()
    placed = (
        Membership.objects
        .filter(is_active=True, is_primary=True, user__is_active=True)
        .values('user_id').distinct().count()
    )

    if placed == 0:
        return Result('memberships exist', FAIL,
                      f'0 of {total_users} active users placed in the tree',
                      'python manage.py derive_hierarchy')
    if placed < total_users:
        return Result('memberships exist', WARN,
                      f'{placed} of {total_users} active users placed — '
                      f'{total_users - placed} have no position',
                      'python manage.py derive_hierarchy   (re-run; it is idempotent)')

    return Result('memberships exist', OK, f'all {total_users} active users placed')


def check_role_assignments():
    """
    Capabilities are worthless unless someone holds them.

    This is the check the production audit was missing: the RBAC registry was seeded
    (20 permissions, 8 roles) and *nobody had been assigned anything*, so every
    console surface was closed to every non-superuser. The system looked configured
    and was inert.
    """
    from identity.authorization import users_with_permission
    from identity.models import RoleAssignment
    from identity.permissions_registry import Perm

    total = RoleAssignment.objects.filter(is_active=True).count()
    if total == 0:
        return Result(
            'role assignments exist', FAIL,
            'nobody holds any role — every console surface is closed',
            'python manage.py derive_hierarchy   (maps legacy roles), then\n'
            '      python manage.py grant_role <user> <role> <node> for anyone left over',
        )

    # Someone must be able to publish content and manage events, or the region
    # cannot actually run on this platform.
    gaps = [
        name for name, code in (
            ('content.publish', Perm.CONTENT_PUBLISH),
            ('events.manage', Perm.EVENTS_MANAGE),
            ('roles.assign', Perm.ROLES_ASSIGN),
        )
        if not users_with_permission(code).exclude(is_superuser=True).exists()
    ]
    if gaps:
        return Result(
            'role assignments exist', WARN,
            f'{total} assignment(s), but nobody (other than a superuser) holds: '
            f'{", ".join(gaps)}',
            'python manage.py grant_role <user> <role> <node>',
        )

    return Result('role assignments exist', OK, f'{total} active assignment(s)')


def check_bible():
    from bible.models import BibleTranslation, BibleVerse

    translations = BibleTranslation.objects.filter(is_active=True)
    if not translations.exists():
        return Result('Bible translation installed', FAIL, 'no active translation',
                      'python manage.py import_bible <translation.json>')

    default = translations.filter(is_default=True).first()
    if default is None:
        return Result('Bible translation installed', FAIL,
                      f'{translations.count()} translation(s) but none is default',
                      'Set is_default on one translation (the reader has nothing to open).')

    verses = BibleVerse.objects.filter(
        chapter__book__translation=default).count()
    if verses == 0:
        return Result('Bible translation installed', FAIL,
                      f'{default.code} exists but has no verses — the schema is '
                      f'there and the text is not',
                      f'python manage.py import_bible <{default.code.lower()}.json>')

    indexed = BibleVerse.objects.filter(
        chapter__book__translation=default, search_vector__isnull=False).count()
    if indexed < verses:
        return Result('Bible translation installed', WARN,
                      f'{default.code}: {verses} verses, but {verses - indexed} '
                      f'are not in the search index',
                      f'python manage.py rebuild_bible_search --translation {default.code}')

    return Result('Bible translation installed', OK,
                  f'{default.code} ({verses} verses, fully indexed)')


def check_devotional_today():
    """
    No devotional today means every teen who opens the app finds nothing, and a
    streak they cannot continue (`docs/02-roadmap.md`: "software without content is
    an empty shell").
    """
    from content.services import calendar as calendar_service
    from content.services import daily

    devotional = daily.todays_devotional()
    buffer_days = calendar_service.buffer_days()

    if devotional is None:
        return Result('devotional exists for today', FAIL,
                      'no published devotional for today',
                      'Publish one in the console, or run '
                      'python manage.py scrape_devotional')

    if buffer_days < 7:
        return Result('devotional exists for today', WARN,
                      f'"{devotional.title}" published, but the pipeline runs dry in '
                      f'{buffer_days} day(s)',
                      'Schedule more devotionals — the roadmap asks for a 60-day '
                      'buffer before launch.')

    return Result('devotional exists for today', OK,
                  f'"{devotional.title}" ({buffer_days}-day buffer)')


def check_notifications():
    """
    A logging push backend is correct behaviour in development and a silent failure
    in production: preferences are honoured, inbox rows are written, and no teen's
    phone ever buzzes.
    """
    backend = getattr(settings, 'NOTIFICATIONS_PUSH_BACKEND', '')
    is_real = backend.endswith('WebPushBackend')

    if not is_real:
        status = WARN if settings.DEBUG else FAIL
        return Result(
            'notification backend configured', status,
            f'push backend is {backend.rsplit(".", 1)[-1] or "unset"} — '
            f'notifications reach the inbox but never a phone',
            'Set NOTIFICATIONS_PUSH_BACKEND=notifications.push.WebPushBackend '
            'and provide the VAPID keys.',
        )

    missing = [
        name for name in ('VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY')
        if not getattr(settings, name, None)
    ]
    if missing:
        return Result('notification backend configured', FAIL,
                      f'WebPush selected but {", ".join(missing)} unset — every push '
                      f'will raise',
                      'Generate a VAPID key pair and set both env vars.')

    try:
        import pywebpush  # noqa: F401
    except ImportError:
        return Result('notification backend configured', FAIL,
                      'WebPush selected but pywebpush is not installed',
                      'pip install pywebpush')

    return Result('notification backend configured', OK, 'WebPush with VAPID keys')


def check_progress_engine():
    """The streak engine is the spine of the daily habit; if its tables are absent,
    every devotional completion raises."""
    from progress.models import ActionType, GraceDayLedger, SpiritualAction, StreakState

    actions = SpiritualAction.objects.count()
    streaks = StreakState.objects.count()
    grace = GraceDayLedger.objects.count()

    if not ActionType.values:
        return Result('progress engine healthy', FAIL, 'no action types registered')

    return Result('progress engine healthy', OK,
                  f'{actions} action(s), {streaks} streak(s), {grace} grace row(s)')


def check_event_scoping():
    """
    Events must be able to declare a place in the tree. Unscoped events are visible
    to everyone — correct for a region-wide camp, wrong for a parish hangout.
    """
    from events.models import Event
    from hierarchy.models import HierarchyNode

    total = Event.objects.count()
    if total == 0:
        return Result('event scoping configured', OK, 'no events yet')

    unscoped = Event.objects.filter(scope_node__isnull=True).count()
    if unscoped and HierarchyNode.objects.exists():
        return Result(
            'event scoping configured', WARN,
            f'{unscoped} of {total} event(s) have no scope_node — they are visible '
            f'to every teen in every region',
            'Set a scope_node on each event in the console (blank = everywhere, '
            'which is right for a regional camp and wrong for a parish hangout).',
        )

    return Result('event scoping configured', OK,
                  f'{total - unscoped} of {total} event(s) scoped')


CHECKS = [
    check_migrations,
    check_critical_settings,
    check_rbac_seeded,
    check_hierarchy,
    check_memberships,
    check_role_assignments,
    check_bible,
    check_devotional_today,
    check_notifications,
    check_progress_engine,
    check_event_scoping,
]


class Command(BaseCommand):
    help = 'Verify that this deployment is ready to serve. Non-zero exit on failure.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--strict', action='store_true',
            help='Treat warnings as failures (use this to gate a production deploy).',
        )

    def handle(self, *args, **options):
        strict = options['strict']
        results = []

        for check in CHECKS:
            try:
                results.append(check())
            except Exception as exc:
                # A check that explodes is itself a finding — most often a missing
                # table, which means the migration for that app never ran. Report it
                # as a failure rather than crashing the whole verification and
                # hiding the checks that would have passed.
                results.append(Result(
                    check.__name__.replace('check_', '').replace('_', ' '),
                    FAIL,
                    f'{type(exc).__name__}: {exc}',
                    'python manage.py migrate',
                ))

        width = max(len(r.name) for r in results)
        style = {OK: self.style.SUCCESS, WARN: self.style.WARNING,
                 FAIL: self.style.ERROR}
        symbol = symbols(self.stdout)

        self.stdout.write('')
        for result in results:
            line = (f'{symbol[result.status]} {result.name.ljust(width)}  '
                    f'{result.detail}')
            self.stdout.write(style[result.status](line))

        failures = [r for r in results if r.status == FAIL]
        warnings = [r for r in results if r.status == WARN]
        actionable = failures + (warnings if strict else [])

        if actionable:
            self.stdout.write('')
            self.stdout.write(self.style.MIGRATE_HEADING('To fix:'))
            for result in actionable:
                if result.fix:
                    self.stdout.write(f'  {result.name}:')
                    for line in result.fix.splitlines():
                        self.stdout.write(f'      {line}')

        self.stdout.write('')
        summary = (f'{len(results) - len(failures) - len(warnings)} passed, '
                   f'{len(warnings)} warning(s), {len(failures)} failure(s)')

        if failures or (strict and warnings):
            self.stdout.write(self.style.ERROR(f'NOT READY — {summary}'))
            # Non-zero exit so a deploy pipeline stops here.
            raise SystemExit(1)

        self.stdout.write(self.style.SUCCESS(f'READY — {summary}'))
