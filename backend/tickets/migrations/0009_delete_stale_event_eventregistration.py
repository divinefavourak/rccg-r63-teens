# Manually created migration to remove stale Event and EventRegistration models
# that were created in the tickets app (migration 0008) before being moved
# to the dedicated events app. Their user ForeignKey caused a related_name
# clash with events.EventRegistration.user (both used 'event_registrations').

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0008_event_eventregistration_and_more"),
    ]

    operations = [
        migrations.DeleteModel(
            name="EventRegistration",
        ),
        migrations.DeleteModel(
            name="Event",
        ),
    ]
