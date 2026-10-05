import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PushDevice",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("token", models.CharField(max_length=255, unique=True)),
                (
                    "platform",
                    models.CharField(
                        blank=True,
                        choices=[("ios", "iOS"), ("android", "Android")],
                        max_length=16,
                    ),
                ),
                ("device_name", models.CharField(blank=True, max_length=120)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                ("failed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="push_devices",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Push Device",
                "verbose_name_plural": "Push Devices",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["user", "is_active"], name="notif_device_user_active"
                    )
                ],
            },
        ),
    ]
