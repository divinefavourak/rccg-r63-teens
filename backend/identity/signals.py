"""
Cache invalidation for the authority snapshots in ``identity.authorization``.

Authorization results are cached in Redis, so anything that changes what a user
may do has to invalidate them. These handlers bump a single global version
counter that is part of every snapshot's cache key, which means the next request
after a role change reads fresh data — no TTL wait, and no chance of a revoked
coordinator keeping access until a timer expires.

The counter is global rather than per-user on purpose. Editing a Role's
permission set changes authority for every holder of that role, and working out
that set would itself cost the queries this cache exists to avoid. Role and
assignment edits are infrequent admin actions, so invalidating everyone is the
cheaper trade.

``RoleAssignment`` is soft-deleted via ``revoke_role`` (is_active=False), which
is a save rather than a delete — hence post_save covers revocation too. post_delete
is still connected for hard deletes from the admin or a data migration.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .authorization import bump_authz_version
from .models import Role, RoleAssignment, RolePermission


@receiver(post_save, sender=RoleAssignment)
@receiver(post_delete, sender=RoleAssignment)
@receiver(post_save, sender=RolePermission)
@receiver(post_delete, sender=RolePermission)
@receiver(post_save, sender=Role)
@receiver(post_delete, sender=Role)
def invalidate_authority_cache(sender, **kwargs):
    bump_authz_version()
