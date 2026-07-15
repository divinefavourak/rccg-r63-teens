"""
Bring a database from "migrations applied" to "a leader can actually use it".

    python manage.py bootstrap_production --dry-run
    python manage.py bootstrap_production

Runs the initialisation steps in the only order they work in, then verifies the
result. Every step it calls is **idempotent**, so this command is safe to re-run —
which matters, because the realistic failure mode is not "it broke", it is "someone
ran half of it, went to lunch, and nobody is sure what state the database is in".

    1. seed_rbac          permissions + roles from the code registry
    2. derive_hierarchy   the tree + memberships + legacy role assignments
    3. verify_deployment  did any of that actually work?

Deliberately **not** included:

* `migrate` — schema changes are a deploy-pipeline decision with a rollback plan
  attached, not something a convenience command should do behind your back. Run it
  yourself, first. `verify_deployment` will tell you if you forgot.
* `import_bible` — it needs a text file this command cannot invent.

See `docs/ops/01-first-deployment.md` for the full runbook.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = 'Seed RBAC, build the hierarchy, then verify. Idempotent; safe to re-run.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Report what each step would do; write nothing.',
        )
        parser.add_argument(
            '--region-name', default='Region 63',
            help='Region node to build the tree under (default: "Region 63").',
        )
        parser.add_argument(
            '--national-name', default='RCCG National',
            help='Root node name (default: "RCCG National").',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Refuse to seed a database whose schema is behind the code. Seeding against
        # a stale schema half-succeeds and leaves rows that the real migration then
        # has to reconcile — a worse position than not having started.
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        if plan:
            apps = sorted({migration.app_label for migration, _ in plan})
            raise CommandError(
                f'{len(plan)} unapplied migration(s) in: {", ".join(apps)}.\n'
                f'Run `python manage.py migrate` first — bootstrapping a stale '
                f'schema would leave the database half-initialised.'
            )

        self._step('1/3  seed_rbac — permissions and roles from the code registry')
        call_command('seed_rbac', verbosity=0)
        self._done('RBAC reconciled to the registry')

        self._step('2/3  derive_hierarchy — tree, memberships, legacy role assignments')
        call_command(
            'derive_hierarchy',
            region_name=options['region_name'],
            national_name=options['national_name'],
            dry_run=dry_run,
        )
        if dry_run:
            self._warn('DRY RUN — the hierarchy was rolled back. Nothing was written.')

        self._step('3/3  verify_deployment')
        self.stdout.write('')
        try:
            call_command('verify_deployment')
        except SystemExit:
            # verify_deployment exits non-zero when something is still missing. That
            # is not a bootstrap failure — it is the bootstrap telling you what is
            # left (a Bible import, VAPID keys, today's devotional). Re-raise so a
            # pipeline still stops, but say so plainly first.
            self.stdout.write('')
            self.stdout.write(self.style.WARNING(
                'Bootstrap finished; verification found outstanding items above. '
                'They are listed with the command that fixes each one.'
            ))
            raise

    def _step(self, message):
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING(message))

    def _done(self, message):
        self.stdout.write(self.style.SUCCESS(f'  {message}'))

    def _warn(self, message):
        self.stdout.write(self.style.WARNING(f'  {message}'))
