"""
Let province coordinators manage their people, and let a Teacher be appointed
at a province.

- `province_coordinator` gains `users.manage` (correct someone's details) and
  `roles.assign` (appoint, for example, a Teacher). Both stay inside their
  province: user management is scoped by membership, and a grant by the
  subset and node rules.
- `teacher` may now be granted at a province as well as an area or parish.
  Region 63 had no areas or parishes loaded, so nobody could be made one.

Only that, with fixed codes rather than the live registry, as in 0007: the
earlier seeds reconcile every system role, which would also undo anything an
administrator has changed on the Roles screen since.
"""
from django.db import migrations

PROVINCE_COORDINATOR = 'province_coordinator'
NEW_PERMISSIONS = {
    'users.manage': 'Manage users',
    'roles.assign': 'Assign roles',
}
TEACHER = 'teacher'
PROVINCE = 'province'


def forward(apps, schema_editor):
    Permission = apps.get_model('identity', 'Permission')
    Role = apps.get_model('identity', 'Role')
    RolePermission = apps.get_model('identity', 'RolePermission')

    coordinator = Role.objects.filter(code=PROVINCE_COORDINATOR).first()
    if coordinator is not None:
        for code, label in NEW_PERMISSIONS.items():
            # get_or_create, not update_or_create: these permissions already
            # exist (0003) and their labels are not this migration's business.
            permission, _ = Permission.objects.get_or_create(code=code, defaults={'label': label})
            RolePermission.objects.get_or_create(role=coordinator, permission=permission)

    teacher = Role.objects.filter(code=TEACHER).first()
    if teacher is not None and PROVINCE not in (teacher.allowed_node_types or []):
        teacher.allowed_node_types = [*(teacher.allowed_node_types or []), PROVINCE]
        teacher.save(update_fields=['allowed_node_types'])


def backward(apps, schema_editor):
    Role = apps.get_model('identity', 'Role')
    RolePermission = apps.get_model('identity', 'RolePermission')

    RolePermission.objects.filter(
        role__code=PROVINCE_COORDINATOR, permission__code__in=list(NEW_PERMISSIONS),
    ).delete()
    # Teachers already appointed at a province keep their assignments; this
    # only stops new ones being made there.
    teacher = Role.objects.filter(code=TEACHER).first()
    if teacher is not None and PROVINCE in (teacher.allowed_node_types or []):
        teacher.allowed_node_types = [t for t in teacher.allowed_node_types if t != PROVINCE]
        teacher.save(update_fields=['allowed_node_types'])


class Migration(migrations.Migration):
    dependencies = [('identity', '0007_seed_payments_reconcile')]
    operations = [migrations.RunPython(forward, backward)]
