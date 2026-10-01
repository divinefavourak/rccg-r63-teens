"""
Editing what a role *means*.

Separated from `views.py` because this is the one endpoint in the system that
changes authority for everybody at once. Granting someone a role affects one
person; adding `content.publish` to Regional Coordinator affects every Regional
Coordinator, immediately, everywhere — with no audit row per affected user,
because none of their assignments changed.

Guarded by three rules, in order:

1. `roles.manage` — held by Super Admin alone in the seeded set.
2. **No escalation.** You may not add a permission you do not hold yourself. The
   same rule as `can_assign`, applied to role definitions: otherwise a holder of
   `roles.manage` could grant themselves everything in two moves by editing a
   role they already hold.
3. **System roles keep their identity.** `is_system` roles may have permissions
   adjusted but may not be renamed or deactivated — code and migrations look them
   up by `code`, and `seed_rbac` would recreate them anyway.
"""
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authorization import HasPermission, effective_permissions
from .models import Permission, Role, RolePermission
from .permissions_registry import ALL_PERMISSION_CODES, Perm
from .serializers import RoleSerializer


class RolePermissionsView(APIView):
    """
    `PUT /api/v1/identity/roles/<uuid>/permissions/`

    Body: `{"permissions": ["users.view", ...]}` — the complete desired set, not
    a delta. Sending the whole set makes the request idempotent and means a lost
    concurrent update cannot silently merge into a role nobody intended.
    """
    permission_classes = [IsAuthenticated, HasPermission(Perm.ROLES_MANAGE)]

    @transaction.atomic
    def put(self, request, pk):
        role = Role.objects.filter(pk=pk).first()
        if role is None:
            return Response({'detail': 'No such role.'},
                            status=status.HTTP_404_NOT_FOUND)

        desired = request.data.get('permissions')
        if not isinstance(desired, list):
            return Response(
                {'permissions': ['Send the complete list of permission codes.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        desired = set(desired)
        unknown = desired - set(ALL_PERMISSION_CODES)
        if unknown:
            # The vocabulary is code-defined on purpose; an unknown code is a
            # client bug, not a new permission.
            return Response(
                {'permissions': [f'Unknown permission codes: {sorted(unknown)}.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Rule 2 — no escalation. A superuser holds everything, so this is a
        # no-op for them; for anyone else it caps edits at their own authority.
        if not getattr(request.user, 'is_superuser', False):
            mine = set(effective_permissions(request.user))
            current = role.permission_codes()
            adding = desired - current
            beyond = adding - mine
            if beyond:
                return Response(
                    {'detail': 'You cannot add a permission you do not hold '
                               f'yourself: {sorted(beyond)}.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        objects = {p.code: p for p in Permission.objects.filter(code__in=desired)}
        missing = desired - set(objects)
        if missing:
            return Response(
                {'detail': f'These permissions are not seeded yet: {sorted(missing)}. '
                           'Run `manage.py seed_rbac`.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        RolePermission.objects.filter(role=role).exclude(
            permission__code__in=desired).delete()
        existing = set(
            RolePermission.objects.filter(role=role).values_list(
                'permission__code', flat=True)
        )
        RolePermission.objects.bulk_create([
            RolePermission(role=role, permission=objects[code])
            for code in desired - existing
        ])

        role.refresh_from_db()
        return Response(RoleSerializer(role).data)
