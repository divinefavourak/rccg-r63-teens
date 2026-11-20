from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0013_group_registration_and_payment_method"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="group_registration_only",
            field=models.BooleanField(default=False),
        ),
    ]
