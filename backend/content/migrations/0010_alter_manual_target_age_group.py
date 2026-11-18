"""Manuals can be aimed at Adults (26+); Superteen is now 20-25 (profiles/0012)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0009_backfill_primary_memory_verses'),
    ]

    operations = [
        migrations.AlterField(
            model_name='manual',
            name='target_age_group',
            field=models.CharField(
                choices=[
                    ('all', 'All Ages'),
                    ('children', 'Children (6-8)'),
                    ('pre_teen', 'Pre-Teen (9-12)'),
                    ('teen', 'Teens (13-19)'),
                    ('superteen', 'Superteen (20-25)'),
                    ('adult', 'Adult (26+)'),
                ],
                default='all',
                max_length=50,
            ),
        ),
    ]
