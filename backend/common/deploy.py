"""
Shared deployment-state helpers.

The one question asked from two places — `verify_deployment` (to report) and
`bootstrap_production` (to refuse to run) — is "is the database's schema behind the
code?". Keeping the answer in one function means the report and the guard can never
drift apart and start disagreeing about whether a deploy is safe.
"""
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


def unapplied_migration_plan():
    """
    Return `(plan, apps)` for migrations that exist in code but are not applied.

    `plan` is Django's migration plan (a list of `(migration, backwards)` tuples);
    `apps` is the sorted set of app labels it touches. An empty plan means the
    schema is current.
    """
    executor = MigrationExecutor(connection)
    targets = executor.loader.graph.leaf_nodes()
    plan = executor.migration_plan(targets)
    apps = sorted({migration.app_label for migration, _ in plan})
    return plan, apps
