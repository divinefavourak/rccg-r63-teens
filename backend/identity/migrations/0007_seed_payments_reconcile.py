"""
Add `payments.reconcile` and give it to the three roles that check transfer
receipts: super admin, national coordinator and regional coordinator.

Only that. The earlier seeds (0004, 0006) reconcile every system role with
the registry, which would also undo any permission an administrator has
since added or removed on the Roles screen. Fixed codes, not the live
registry, so the migration means the same thing whenever it runs.
"""
from django.db import migrations

CODE = 'payments.reconcile'
LABEL = 'Verify transfer receipts and reconcile payments'
ROLES = ('super_admin', 'national_coordinator', 'regional_coordinator')


def seed(apps, schema_editor):
    Permission = apps.get_model('identity', 'Permission')
    Role = apps.get_model('identity', 'Role')
    RolePermission = apps.get_model('identity', 'RolePermission')

    permission, _ = Permission.objects.update_or_create(code=CODE, defaults={'label': LABEL})
    for role in Role.objects.filter(code__in=ROLES):
        RolePermission.objects.get_or_create(role=role, permission=permission)


def unseed(apps, schema_editor):
    pass  # keep seeded permissions on reverse


class Migration(migrations.Migration):
    dependencies = [('identity', '0006_seed_content_manager_role')]
    operations = [migrations.RunPython(seed, unseed)]
