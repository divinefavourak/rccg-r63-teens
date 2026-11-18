"""
Adds the Adult (26+) age group and narrows Superteen to 20-25.

Until now everyone from 20 up was put in Superteen, so a 48-year-old teacher
signing up was told "That puts you in Superteen (19+)". The group is always
derived from the date of birth (TeenProfile.save), so existing rows are
re-derived here with the same rule. On 18 November 2026 production had 8
Superteens, 3 of them 26 or older, and no content targeted at any age group,
so nobody loses anything they could see.

The historical model has no custom save(), hence the arithmetic below; keep it
in step with TeenProfile._calculate_age_group for the two bands it touches.
"""
from datetime import date

from django.db import migrations, models


def _age(dob, today):
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def rederive(apps, schema_editor):
    TeenProfile = apps.get_model('profiles', 'TeenProfile')
    today = date.today()
    for profile in TeenProfile.objects.filter(
        age_group__in=['superteen', 'adult'], date_of_birth__isnull=False,
    ).only('id', 'date_of_birth', 'age_group'):
        group = 'adult' if _age(profile.date_of_birth, today) >= 26 else 'superteen'
        if group != profile.age_group:
            TeenProfile.objects.filter(pk=profile.pk).update(age_group=group)


def undo(apps, schema_editor):
    # Before this migration every age from 20 up was Superteen.
    TeenProfile = apps.get_model('profiles', 'TeenProfile')
    TeenProfile.objects.filter(age_group='adult').update(age_group='superteen')


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0011_create_missing_initial_tables'),
    ]

    operations = [
        migrations.AlterField(
            model_name='teenprofile',
            name='age_group',
            field=models.CharField(
                blank=True,
                choices=[
                    ('toddler', 'Toddler (1-5)'),
                    ('children', 'Children (6-8)'),
                    ('pre_teen', 'Pre-Teen (9-12)'),
                    ('teen', 'Teen (13-19)'),
                    ('superteen', 'Superteen (20-25)'),
                    ('adult', 'Adult (26+)'),
                ],
                default='',
                max_length=20,
            ),
        ),
        migrations.RunPython(rederive, undo),
    ]
