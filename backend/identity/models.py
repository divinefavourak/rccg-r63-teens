"""
Identity & authorization models.

Layering: this app sits *on top of* `hierarchy` (it references HierarchyNode);
`hierarchy` never imports `identity`. Two deliberately separate concepts
(Phase 1B decision):

- ``Membership`` — a user's *belonging* to an organization node (their home
  parish and any additional affiliations). No authority.
- ``RoleAssignment`` — a user's *authority*: a Role granted at a node, with a
  lifecycle. Authorization is computed from RoleAssignments, never from booleans
  on User.

RBAC is DB-backed (``Role``/``Permission``/``RolePermission``) but permission
*codes* come from the code registry in ``permissions_registry`` (validated),
giving admin-editable role config with a type-safe permission vocabulary.
"""
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Profile(models.Model):
    """Presentation/identity data for a user. Deliberately excludes credentials
    (on User) and church hierarchy (on Membership)."""

    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'
        NOT_SPECIFIED = 'not_specified', 'Prefer not to say'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile',
    )
    display_name = models.CharField(max_length=150, blank=True)
    photo = models.ImageField(upload_to='profile_photos/', null=True, blank=True)
    gender = models.CharField(max_length=20, choices=Gender.choices, blank=True)
    birthday = models.DateField(null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    timezone = models.CharField(max_length=64, default='Africa/Lagos')
    preferences = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Profile'
        verbose_name_plural = 'Profiles'

    def __str__(self):
        return self.display_name or f'Profile of {self.user}'


class Permission(models.Model):
    """A single, code-defined permission. `code` must exist in the registry
    (enforced in ``clean``); labels/relationships are DB-managed."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True, db_index=True)
    label = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return self.code

    def clean(self):
        from .permissions_registry import ALL_PERMISSION_CODES
        if self.code not in ALL_PERMISSION_CODES:
            raise ValidationError({'code': f'Unknown permission code: {self.code}'})


class Role(models.Model):
    """A named bundle of permissions, assignable at certain node levels."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=50, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    # Node types (hierarchy.NodeType values) this role may be assigned at.
    # Empty list = not assignable to any org node (e.g. future 'parent').
    allowed_node_types = models.JSONField(default=list, blank=True)
    permissions = models.ManyToManyField(
        Permission, through='RolePermission', related_name='roles', blank=True,
    )
    is_system = models.BooleanField(
        default=False, help_text='Seeded/protected role — do not delete.',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['label']

    def __str__(self):
        return self.label

    def permission_codes(self):
        return set(self.permissions.values_list('code', flat=True))

    def allows_node_type(self, node_type):
        return node_type in (self.allowed_node_types or [])

    def clean(self):
        # Validate allowed_node_types at the Role boundary, not just deferred to
        # RoleAssignment.clean().
        from hierarchy.models import NodeType
        valid = {choice.value for choice in NodeType}
        unknown = [t for t in (self.allowed_node_types or []) if t not in valid]
        if unknown:
            raise ValidationError({'allowed_node_types': f'Unknown node types: {unknown}'})


class RolePermission(models.Model):
    """Explicit through table so grants are admin-manageable and auditable."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_roles')

    class Meta:
        unique_together = [['role', 'permission']]

    def __str__(self):
        return f'{self.role.code} -> {self.permission.code}'


class Membership(models.Model):
    """A user's belonging to an organization node. One primary (home) node per
    user; additional non-primary memberships are allowed."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships',
    )
    organization_node = models.ForeignKey(
        'hierarchy.HierarchyNode', on_delete=models.PROTECT, related_name='memberships',
    )
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    joined_at = models.DateTimeField(default=timezone.now)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # A user may hold at most one active membership per node...
            models.UniqueConstraint(
                fields=['user', 'organization_node'],
                condition=models.Q(is_active=True),
                name='uniq_active_membership_per_node',
            ),
            # ...and at most one primary membership overall (their home node).
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_primary=True, is_active=True),
                name='uniq_primary_membership_per_user',
            ),
        ]
        indexes = [models.Index(fields=['organization_node', 'is_active'])]

    def __str__(self):
        star = ' (primary)' if self.is_primary else ''
        return f'{self.user} @ {self.organization_node}{star}'


class RoleAssignment(models.Model):
    """A user's authority: a Role granted at a node, with a lifecycle. Validity
    is (is_active AND start_date <= today <= end_date-or-open)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='role_assignments',
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='assignments')
    node = models.ForeignKey(
        'hierarchy.HierarchyNode', on_delete=models.PROTECT, related_name='role_assignments',
    )
    start_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    appointed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='role_assignments_made',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'role', 'node'],
                condition=models.Q(is_active=True),
                name='uniq_active_role_assignment',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['node', 'role']),
        ]

    def __str__(self):
        return f'{self.user} — {self.role.code} @ {self.node}'

    def clean(self):
        # Role must be allowed at this node's level (invalid-assignment guard).
        if self.role_id and self.node_id:
            if not self.role.allows_node_type(self.node.node_type):
                raise ValidationError(
                    f'Role "{self.role.code}" cannot be assigned at a '
                    f'{self.node.node_type} node.'
                )
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError({'end_date': 'end_date cannot precede start_date.'})

    @property
    def is_current(self):
        today = timezone.localdate()
        return (
            self.is_active
            and self.start_date <= today
            and (self.end_date is None or self.end_date >= today)
        )


class MembershipTransfer(models.Model):
    """Append-only record of a user moving between organization nodes."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='membership_transfers',
    )
    from_node = models.ForeignKey(
        'hierarchy.HierarchyNode', on_delete=models.PROTECT, null=True, blank=True,
        related_name='transfers_out',
    )
    to_node = models.ForeignKey(
        'hierarchy.HierarchyNode', on_delete=models.PROTECT, related_name='transfers_in',
    )
    transferred_at = models.DateTimeField(auto_now_add=True)
    transferred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='membership_transfers_made',
    )
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-transferred_at']

    def __str__(self):
        return f'{self.user}: {self.from_node} -> {self.to_node}'
