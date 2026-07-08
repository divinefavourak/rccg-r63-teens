"""
Grandfather existing users as verified so enabling ENFORCE_EMAIL_VERIFICATION
later never locks out accounts created before the verification flow existed. Only
users present at this migration are grandfathered; new signups start unverified.
"""
from django.db import migrations


def grandfather(apps, schema_editor):
    User = apps.get_model('users', 'User')
    User.objects.filter(is_verified=False).update(is_verified=True)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [('users', '0008_user_is_verified')]
    operations = [migrations.RunPython(grandfather, noop)]
