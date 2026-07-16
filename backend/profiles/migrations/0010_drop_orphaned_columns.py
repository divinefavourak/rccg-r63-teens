"""
Drop columns that exist in the DB but were removed from the TeenProfile model.
These were added by earlier migrations and never cleaned up after the model rewrite.
Using RunSQL with state_operations=[] so Django's model state is unaffected.
"""
from django.db import migrations


ORPHANED_COLUMNS = [
    'school',
    'grade_level',
    'interests',
    'favorite_topics',
    'devotional_reminder',
    'new_content_notification',
    'event_notification',
    'total_devotionals_read',
    'total_manuals_completed',
    'total_podcasts_played',
    'current_streak',
    'last_activity_at',
]

DROP_SQL = "\n".join(
    f"ALTER TABLE profiles_teenprofile DROP COLUMN IF EXISTS {col};"
    for col in ORPHANED_COLUMNS
)


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0009_alter_teenprofile_date_of_birth_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql=DROP_SQL,
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[],
        ),
    ]
