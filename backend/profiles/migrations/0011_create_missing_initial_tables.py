"""
Repair migration: create profiles_devotionalprogress, profiles_manualprogress and
profiles_favorite when they are absent from the database.

Why they can be absent: profiles/0001_initial was recorded as applied on
2026-01-13, and the migration file was then rewritten in place by commit 8f0009d
("refactoring of new site", 2026-01-19), which added the DevotionalProgress,
ManualProgress and Favorite CreateModel operations. Because django_migrations
already held the row for profiles.0001_initial, those three CREATE TABLE
statements never ran on databases that had been migrated before the rewrite.
Django's model state and makemigrations were unaffected, so the drift was
invisible to `showmigrations` and `makemigrations --check`.

This migration touches the database only (state_operations are empty) and skips
any table that already exists, so it is a no-op on a database built from the
current 0001_initial.
"""
from django.db import migrations


TARGET_MODELS = ['DevotionalProgress', 'ManualProgress', 'Favorite']


def create_missing_tables(apps, schema_editor):
    existing = set(schema_editor.connection.introspection.table_names())
    for model_name in TARGET_MODELS:
        model = apps.get_model('profiles', model_name)
        if model._meta.db_table in existing:
            continue
        schema_editor.create_model(model)


def noop_reverse(apps, schema_editor):
    """Deliberately does not drop the tables — they may hold data."""


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0010_drop_orphaned_columns'),
    ]

    operations = [
        migrations.RunPython(
            create_missing_tables,
            noop_reverse,
            elidable=False,
        ),
    ]
