import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0001_initial"),
        ("payments", "0002_alter_paymentplan_ticket_category"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="registration",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payment_attempts",
                to="events.eventregistration",
            ),
        ),
        migrations.AddField(
            model_name="payment",
            name="authorization_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="payment",
            name="access_code",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
