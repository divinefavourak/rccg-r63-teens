"""
Reconcile the RBAC tables to the code registry, idempotently.

Creates/updates every registered Permission and every canonical Role, and syncs
each system role's permission grants to the registry (adds missing, prunes
extras on system roles so the code stays authoritative for them). Non-system
roles and their custom grants are left untouched.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from identity.models import Permission, Role, RolePermission
from identity.permissions_registry import REGISTRY, ROLE_SEED


class Command(BaseCommand):
    help = 'Seed/reconcile RBAC permissions and roles from the code registry.'

    @transaction.atomic
    def handle(self, *args, **options):
        # Permissions
        perm_by_code = {}
        for code, label in REGISTRY:
            perm, _ = Permission.objects.update_or_create(code=code, defaults={'label': label})
            perm_by_code[code] = perm

        created_roles = 0
        for spec in ROLE_SEED:
            role, was_created = Role.objects.update_or_create(
                code=spec['code'],
                defaults={
                    'label': spec['label'],
                    'allowed_node_types': spec['allowed_node_types'],
                    'is_system': spec.get('is_system', False),
                },
            )
            created_roles += int(was_created)

            desired = set(spec['permissions'])
            existing = set(role.permission_codes())
            # Add missing grants.
            for code in desired - existing:
                RolePermission.objects.get_or_create(role=role, permission=perm_by_code[code])
            # For system roles, prune grants not in the registry (code is source of truth).
            if role.is_system:
                for code in existing - desired:
                    RolePermission.objects.filter(role=role, permission__code=code).delete()

        self.stdout.write(self.style.SUCCESS(
            f'RBAC seeded: {len(perm_by_code)} permissions, '
            f'{len(ROLE_SEED)} roles ({created_roles} new).'
        ))
