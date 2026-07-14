"""
Step 1 of 3: add `Event.scope_node` alongside the legacy `target_provinces`.

Split deliberately from the removal (0008) so the data migration in 0007 can read
the old column and write the new one. A single migration that added the FK and
dropped the array in one step — which is what makemigrations generates — would
destroy every event's audience before anything could migrate it.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0005_alter_event_status"),
        ("hierarchy", "0003_alter_roleassignment_unique_together_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="scope_node",
            field=models.ForeignKey(
                blank=True,
                help_text="The node that owns this event; its subtree can see it. "
                          "Blank means visible everywhere.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="events",
                to="hierarchy.hierarchynode",
            ),
        ),
    ]
