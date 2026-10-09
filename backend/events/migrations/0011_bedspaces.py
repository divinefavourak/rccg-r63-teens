# Written by hand for the bedspaces feature. Check it against the models with
# `python manage.py makemigrations events --check --dry-run`: that should
# report no changes.

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0010_alter_event_cover_image"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="bedspaces_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="eventregistration",
            name="attending_as_leader",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="Hostel",
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
                ("name", models.CharField(max_length=100)),
                ("code", models.CharField(max_length=10)),
                (
                    "gender",
                    models.CharField(
                        choices=[("male", "Male"), ("female", "Female")],
                        max_length=10,
                    ),
                ),
                ("capacity", models.PositiveIntegerField()),
                ("reserved_for_leaders", models.PositiveIntegerField(default=0)),
                (
                    "event",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="hostels",
                        to="events.event",
                    ),
                ),
            ],
            options={
                "ordering": ["code"],
            },
        ),
        migrations.CreateModel(
            name="BedAssignment",
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
                ("serial", models.PositiveIntegerField()),
                ("for_leader", models.BooleanField(default=False)),
                (
                    "assigned_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="bed_assignments_made",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "hostel",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="beds",
                        to="events.hostel",
                    ),
                ),
                (
                    "registration",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bed",
                        to="events.eventregistration",
                    ),
                ),
            ],
            options={
                "ordering": ["hostel__code", "serial"],
            },
        ),
        migrations.AddConstraint(
            model_name="hostel",
            constraint=models.UniqueConstraint(
                fields=("event", "code"), name="uniq_hostel_code_per_event"
            ),
        ),
        migrations.AddConstraint(
            model_name="hostel",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("reserved_for_leaders__lte", models.F("capacity"))
                ),
                name="hostel_reserved_within_capacity",
            ),
        ),
        migrations.AddConstraint(
            model_name="bedassignment",
            constraint=models.UniqueConstraint(
                fields=("hostel", "serial"), name="uniq_bed_per_hostel"
            ),
        ),
    ]
