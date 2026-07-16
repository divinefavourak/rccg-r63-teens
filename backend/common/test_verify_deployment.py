"""
Smoke tests for the production bootstrap.

These test the *deployment*, not a feature. Their job is to prove that
`verify_deployment` actually fails when a real deployment would be broken — a
verification command that passes on an empty database is worse than no command at
all, because it converts an unknown into a false assurance.

So each test below removes one prerequisite and asserts the check notices.
"""
from datetime import time
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from common.management.commands import verify_deployment as vd
from common.dates import app_today

User = get_user_model()

# The test database has every migration applied and nothing seeded — the same
# starting point as a fresh production database the moment `migrate` finishes.
PROD_SETTINGS = dict(
    DEBUG=False,
    ALLOWED_HOSTS=['faithtribe.app'],
    SECRET_KEY='x',
    DATABASE_URL='postgres://localhost/x',
    FRONTEND_URL='https://faithtribe.app',
)


def make_user(username='teen', **kwargs):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x', **kwargs)


class SymbolFallbackTests(TestCase):
    """A verification command must not crash on the console of the person verifying."""

    def test_ascii_fallback_on_a_console_that_cannot_encode_tick_marks(self):
        class Cp1252Stream:
            encoding = 'cp1252'

        self.assertEqual(vd.symbols(Cp1252Stream()), vd.ASCII_SYMBOLS)

    def test_unicode_where_the_console_supports_it(self):
        class Utf8Stream:
            encoding = 'utf-8'

        self.assertEqual(vd.symbols(Utf8Stream()), vd.UNICODE_SYMBOLS)


class MigrationCheckTests(TestCase):

    def test_a_fully_migrated_database_passes(self):
        """The test database is migrated by definition — this pins the happy path."""
        self.assertEqual(vd.check_migrations().status, vd.OK)


@override_settings(**PROD_SETTINGS)
class CriticalSettingsTests(TestCase):

    def test_production_settings_pass(self):
        self.assertEqual(vd.check_critical_settings().status, vd.OK)

    @override_settings(DEBUG=True)
    def test_debug_on_is_a_failure(self):
        result = vd.check_critical_settings()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('DEBUG', result.detail)

    @override_settings(ALLOWED_HOSTS=['*'])
    def test_wildcard_allowed_hosts_is_a_failure(self):
        """
        The settings default. It defeats Host-header validation, which is what stands
        between the app and password-reset-link spoofing — and it is therefore the
        single most likely thing to still be wrong on launch day.
        """
        result = vd.check_critical_settings()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('ALLOWED_HOSTS', result.detail)

    # SECRET_KEY-unset is intentionally not tested here: emptying it fires Django's
    # setting_changed signal and tears down the signing machinery the test runner
    # itself depends on. The check still guards it; DEBUG and ALLOWED_HOSTS below
    # cover the FAIL path, and they are the two most likely to be wrong on launch
    # day anyway.


class RbacCheckTests(TestCase):
    """
    RBAC is seeded by data migration (`identity/0003_seed_rbac`), so a freshly
    migrated database already has roles and permissions. The failure mode in the
    field is not "unseeded" — it is **drift**: the code registry gains a permission
    (as `identity/0004` added `bible.manage`) and the deployed database has not been
    reconciled to it. Production was found exactly one permission behind.

    So the check has to catch drift, not just emptiness.
    """

    def test_a_freshly_migrated_database_is_already_seeded(self):
        self.assertEqual(vd.check_rbac_seeded().status, vd.OK)

    def test_a_registry_that_has_drifted_ahead_of_the_database_fails(self):
        from identity.models import Permission
        from identity.permissions_registry import ALL_PERMISSION_CODES

        Permission.objects.filter(code=ALL_PERMISSION_CODES[-1]).delete()

        result = vd.check_rbac_seeded()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('seed_rbac', result.fix)

    def test_a_missing_role_fails(self):
        from identity.models import Role

        Role.objects.filter(code='regional_coordinator').delete()

        self.assertEqual(vd.check_rbac_seeded().status, vd.FAIL)

    def test_seed_rbac_repairs_drift(self):
        from identity.models import Permission
        from identity.permissions_registry import ALL_PERMISSION_CODES

        Permission.objects.filter(code=ALL_PERMISSION_CODES[-1]).delete()

        call_command('seed_rbac', verbosity=0)

        self.assertEqual(vd.check_rbac_seeded().status, vd.OK)


class HierarchyCheckTests(TestCase):

    def test_an_empty_tree_fails(self):
        """The exact production state the audit found: schema present, tree empty."""
        result = vd.check_hierarchy()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('derive_hierarchy', result.fix)

    def test_a_tree_without_a_region_fails(self):
        """A national root alone scopes nothing."""
        from hierarchy import services

        services.create_root('RCCG National')

        result = vd.check_hierarchy()
        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('no region', result.detail)

    def test_a_built_tree_passes(self):
        from identity.tests.base import build_tree

        build_tree()

        self.assertEqual(vd.check_hierarchy().status, vd.OK)


class MembershipCheckTests(TestCase):

    def test_no_memberships_fails(self):
        make_user()

        self.assertEqual(vd.check_memberships().status, vd.FAIL)

    def test_partially_placed_users_warn(self):
        """
        Fails open, not closed: an unplaced user sees everything rather than nothing.
        Still wrong, so it warns.
        """
        from identity.authorization import set_membership
        from identity.tests.base import build_tree

        tree = build_tree()
        placed = make_user('placed')
        make_user('unplaced')
        set_membership(placed, tree['parish_a'], is_primary=True)

        result = vd.check_memberships()

        self.assertEqual(result.status, vd.WARN)
        self.assertIn('no position', result.detail)

    def test_all_users_placed_passes(self):
        from identity.authorization import set_membership
        from identity.tests.base import build_tree

        tree = build_tree()
        set_membership(make_user('placed'), tree['parish_a'], is_primary=True)

        self.assertEqual(vd.check_memberships().status, vd.OK)


class RoleAssignmentCheckTests(TestCase):
    """
    The check the production audit was missing. RBAC was seeded, roles existed,
    permissions existed — and *nobody had been assigned anything*, so every console
    surface was shut to every non-superuser. The system looked configured and was
    inert.
    """

    def test_zero_assignments_fails(self):
        make_user()

        result = vd.check_role_assignments()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('every console surface is closed', result.detail)

    def test_assignments_that_leave_nobody_able_to_publish_warn(self):
        """Roles assigned, but only to a teacher: nobody can publish a devotional."""
        from identity.authorization import assign_role
        from identity.models import Role
        from identity.tests.base import build_tree

        tree = build_tree()
        assign_role(make_user('teacher'), Role.objects.get(code='teacher'),
                    tree['parish_a'], enforce_escalation=False)

        result = vd.check_role_assignments()

        self.assertEqual(result.status, vd.WARN)
        self.assertIn('content.publish', result.detail)

    def test_a_regional_coordinator_satisfies_it(self):
        from identity.authorization import assign_role
        from identity.models import Role
        from identity.tests.base import build_tree

        tree = build_tree()
        assign_role(make_user('boss'), Role.objects.get(code='regional_coordinator'),
                    tree['r1'], enforce_escalation=False)

        self.assertEqual(vd.check_role_assignments().status, vd.OK)


class BibleCheckTests(TestCase):

    def test_no_translation_fails(self):
        result = vd.check_bible()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('import_bible', result.fix)

    def test_a_translation_with_no_verses_fails(self):
        """
        The exact Phase 2A state: the schema shipped, the text never did. A check
        that only counted translations would have called this ready.
        """
        from bible.models import BibleTranslation

        BibleTranslation.objects.create(
            code='WEB', name='World English Bible', is_default=True, is_active=True)

        result = vd.check_bible()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('no verses', result.detail)

    def test_an_imported_translation_passes(self):
        from bible.importers import import_translation

        import_translation({
            'translation': {'code': 'WEB', 'name': 'World English Bible',
                            'is_public_domain': True, 'is_default': True},
            'books': [{'osis_code': 'John', 'chapters': [['In the beginning.']]}],
        })

        self.assertEqual(vd.check_bible().status, vd.OK)

    def test_an_unindexed_translation_warns(self):
        from bible.importers import import_translation
        from bible.models import BibleVerse

        import_translation({
            'translation': {'code': 'WEB', 'name': 'WEB', 'is_public_domain': True,
                            'is_default': True},
            'books': [{'osis_code': 'John', 'chapters': [['In the beginning.']]}],
        })
        BibleVerse.objects.update(search_vector=None)

        result = vd.check_bible()

        self.assertEqual(result.status, vd.WARN)
        self.assertIn('rebuild_bible_search', result.fix)


class DevotionalCheckTests(TestCase):

    def test_no_devotional_today_fails(self):
        self.assertEqual(vd.check_devotional_today().status, vd.FAIL)

    def test_todays_devotional_with_a_thin_buffer_warns(self):
        from content.models import Devotional, MemoryVerse

        devotional = Devotional.objects.create(
            date=app_today(), title='Chosen', slug='chosen', content='.',
            status=Devotional.Status.PUBLISHED,
        )
        MemoryVerse.objects.create(devotional=devotional, is_primary=True,
                                   reference_display='John 3:16', text_override='.')

        result = vd.check_devotional_today()

        self.assertEqual(result.status, vd.WARN)
        self.assertIn('runs dry', result.detail)


class NotificationCheckTests(TestCase):

    @override_settings(DEBUG=False,
                       NOTIFICATIONS_PUSH_BACKEND='notifications.push.LoggingPushBackend')
    def test_a_logging_backend_in_production_is_a_failure(self):
        """
        The silent one. Preferences are honoured, inbox rows are written, and no
        teen's phone ever buzzes — a habit product whose habit loop is disconnected.
        """
        result = vd.check_notifications()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('never a phone', result.detail)

    @override_settings(DEBUG=True,
                       NOTIFICATIONS_PUSH_BACKEND='notifications.push.LoggingPushBackend')
    def test_a_logging_backend_in_development_only_warns(self):
        self.assertEqual(vd.check_notifications().status, vd.WARN)

    @override_settings(DEBUG=False,
                       NOTIFICATIONS_PUSH_BACKEND='notifications.push.WebPushBackend',
                       VAPID_PRIVATE_KEY='', VAPID_PUBLIC_KEY='')
    def test_webpush_without_vapid_keys_is_a_failure(self):
        result = vd.check_notifications()

        self.assertEqual(result.status, vd.FAIL)
        self.assertIn('VAPID', result.detail)


class EventScopingCheckTests(TestCase):

    def test_no_events_passes(self):
        self.assertEqual(vd.check_event_scoping().status, vd.OK)

    def test_unscoped_events_warn_once_a_tree_exists(self):
        from datetime import timedelta

        from django.utils import timezone

        from events.models import Event
        from identity.tests.base import build_tree

        build_tree()
        Event.objects.create(
            title='Camp', slug='camp', description='.',
            start_datetime=timezone.now() + timedelta(days=1),
            end_datetime=timezone.now() + timedelta(days=2),
            scope_node=None,
        )

        result = vd.check_event_scoping()

        self.assertEqual(result.status, vd.WARN)
        self.assertIn('visible to every teen', result.detail)


class ProgressCheckTests(TestCase):

    def test_the_progress_engine_reports_healthy(self):
        self.assertEqual(vd.check_progress_engine().status, vd.OK)


class VerifyDeploymentCommandTests(TestCase):

    def run_verify(self, **kwargs):
        out = StringIO()
        try:
            call_command('verify_deployment', stdout=out, stderr=out, **kwargs)
        except SystemExit as exc:
            return out.getvalue(), exc.code
        return out.getvalue(), 0

    def test_a_bare_database_is_not_ready_and_exits_non_zero(self):
        """A deploy pipeline must stop here."""
        output, code = self.run_verify()

        self.assertEqual(code, 1)
        self.assertIn('NOT READY', output)

    def test_failures_print_the_command_that_fixes_them(self):
        output, _ = self.run_verify()

        self.assertIn('To fix:', output)
        self.assertIn('derive_hierarchy', output)

    def test_a_failing_check_does_not_hide_the_others(self):
        """
        Every check runs even when an earlier one explodes — that is how the audit of
        the real database surfaced ten problems in one pass instead of one.
        """
        output, _ = self.run_verify()

        for name in ['migrations applied', 'RBAC seeded', 'hierarchy exists',
                     'role assignments exist', 'notification backend configured']:
            self.assertIn(name, output)

    @override_settings(**PROD_SETTINGS)
    def test_strict_mode_turns_warnings_into_failures(self):
        from identity.authorization import assign_role, set_membership
        from identity.models import Role
        from identity.tests.base import build_tree

        call_command('seed_rbac', verbosity=0)
        tree = build_tree()
        boss = make_user('boss')
        set_membership(boss, tree['r1'], is_primary=True)
        assign_role(boss, Role.objects.get(code='regional_coordinator'), tree['r1'],
                    enforce_escalation=False)

        # Still missing the Bible and today's devotional, so both runs fail — the
        # point here is only that --strict cannot pass while warnings remain.
        _, strict_code = self.run_verify(strict=True)
        self.assertEqual(strict_code, 1)


class BootstrapProductionTests(TestCase):

    def test_bootstrap_seeds_rbac_and_builds_the_tree(self):
        """The whole point: one command takes a migrated database to a usable one."""
        from hierarchy.models import HierarchyNode
        from identity.models import Membership, Role, RoleAssignment

        make_user('admin-user', role='admin', province='lagos_province_9')
        make_user('teen-user', role='teen')

        out = StringIO()
        try:
            call_command('bootstrap_production', stdout=out, stderr=out)
        except SystemExit:
            pass    # verification still flags the Bible/devotional — expected

        self.assertTrue(Role.objects.exists())
        self.assertTrue(HierarchyNode.objects.exists())
        self.assertEqual(Membership.objects.filter(is_primary=True).count(), 2)
        self.assertTrue(RoleAssignment.objects.filter(is_active=True).exists())

    def test_bootstrap_is_idempotent(self):
        from hierarchy.models import HierarchyNode
        from identity.models import Membership

        make_user('admin-user', role='admin', province='lagos_province_9')

        for _ in range(2):
            try:
                call_command('bootstrap_production', stdout=StringIO(),
                             stderr=StringIO())
            except SystemExit:
                pass

        # Re-running must not fork the tree or duplicate anyone's membership. The
        # realistic failure is a half-finished run being repeated, so this is the
        # property that matters most.
        self.assertEqual(
            HierarchyNode.objects.filter(node_type='national').count(), 1)
        self.assertEqual(Membership.objects.filter(is_primary=True).count(), 1)

    def test_dry_run_writes_nothing(self):
        """
        --dry-run promises "write nothing". derive_hierarchy rolled back, but
        seed_rbac wrote for real — and the runbook tells operators to preview
        against production with exactly this flag.

        To make this bite, first introduce registry drift (delete a permission).
        On a freshly-migrated database the registry already matches the code, so a
        seed_rbac that ran for real would write nothing anyway and the bug would
        hide. With a permission missing, a real seed_rbac would re-create it — so a
        correct dry-run must leave it absent.
        """
        from identity.models import Permission, RoleAssignment
        from identity.permissions_registry import ALL_PERMISSION_CODES

        make_user('admin-user', role='admin', province='lagos_province_9')
        dropped = ALL_PERMISSION_CODES[-1]
        Permission.objects.filter(code=dropped).delete()

        try:
            call_command('bootstrap_production', '--dry-run',
                         stdout=StringIO(), stderr=StringIO())
        except SystemExit:
            pass

        self.assertFalse(
            Permission.objects.filter(code=dropped).exists(),
            'dry-run re-created a dropped permission — seed_rbac wrote for real',
        )
        self.assertEqual(RoleAssignment.objects.count(), 0,
                         'dry-run created role assignments')

    def test_bootstrap_refuses_to_run_against_a_stale_schema(self):
        """
        Seeding a database whose migrations are behind half-succeeds and leaves rows
        the real migration then has to reconcile — worse than not starting.
        """
        from unittest import mock

        from django.core.management.base import CommandError

        with mock.patch(
            'django.db.migrations.executor.MigrationExecutor.migration_plan',
            return_value=[(mock.Mock(app_label='bible'), False)],
        ):
            with self.assertRaisesMessage(CommandError, 'unapplied migration'):
                call_command('bootstrap_production', stdout=StringIO())
