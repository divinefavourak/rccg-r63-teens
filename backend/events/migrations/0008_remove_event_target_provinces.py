"""
Step 3 of 3: drop `Event.target_provinces`.

With the audience carried into `scope_node` (0007), the hard-coded Lagos province
array has no readers left. Removing it is what actually closes the finding: while
the column exists, something will eventually read it again.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0007_migrate_target_provinces_to_scope_node'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='event',
            name='target_provinces',
        ),
    ]
