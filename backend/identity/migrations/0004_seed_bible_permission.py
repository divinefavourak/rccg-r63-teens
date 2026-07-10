"""
Re-reconcile RBAC after the Scripture phase added `bible.manage` to the registry.

Reuses the same seed function shape as 0003: idempotent, and reversible only in
the sense that we never delete seeded roles automatically.
"""
from django.db import migrations


def seed(apps, schema_editor):
    from identity.permissions_registry import REGISTRY, ROLE_SEED

    Permission = apps.get_model('identity', 'Permission')
    Role = apps.get_model('identity', 'Role')
    RolePermission = apps.get_model('identity', 'RolePermission')

    perm_by_code = {}
    for code, label in REGISTRY:
        perm, _ = Permission.objects.update_or_create(code=code, defaults={'label': label})
        perm_by_code[code] = perm

    for spec in ROLE_SEED:
        role, _ = Role.objects.update_or_create(
            code=spec['code'],
            defaults={
                'label': spec['label'],
                'allowed_node_types': spec['allowed_node_types'],
                'is_system': spec.get('is_system', False),
            },
        )
        desired = set(spec['permissions'])
        existing = set(role.role_permissions.values_list('permission__code', flat=True))
        for code in desired - existing:
            RolePermission.objects.get_or_create(role=role, permission=perm_by_code[code])
        if role.is_system:
            for code in existing - desired:
                RolePermission.objects.filter(role=role, permission__code=code).delete()


def unseed(apps, schema_editor):
    pass  # keep seeded roles on reverse


class Migration(migrations.Migration):
    dependencies = [('identity', '0003_seed_rbac')]
    operations = [migrations.RunPython(seed, unseed)]
