"""Guard against model/migration drift.

Note: the full suite runs via ``pytest --no-migrations`` (a legacy Postgres-only
migration in `profiles` blocks SQLite), so migration *files* are not otherwise
exercised. This at least fails CI if a model change lacks a migration. Running
the real migration path still requires the default runner against Postgres.
"""
from io import StringIO

from django.core.management import call_command
from django.db.migrations.loader import MigrationLoader
from django.test import TestCase


class MigrationStateTests(TestCase):
    def test_no_missing_hierarchy_migrations(self):
        # Meaningless (and unsupported) when migrations are disabled, e.g. under
        # `pytest --no-migrations`. Runs for real under the default Postgres runner.
        module, _ = MigrationLoader.migrations_module('hierarchy')
        if module is None:
            self.skipTest('migrations disabled for this run (--no-migrations)')
        out = StringIO()
        try:
            call_command('makemigrations', 'hierarchy', check=True, dry_run=True,
                        stdout=out, stderr=out, verbosity=1)
        except SystemExit:
            self.fail(f'hierarchy models have unmigrated changes:\n{out.getvalue()}')
