"""
Undo what `derive_hierarchy` did to people who had been dealt with in the
Console.

It ran on every deploy and treated each user as new. So for someone who had
been moved, it made a second membership where their old profile points and
made that their home, which listed them twice in People. And a legacy role
that had been revoked was granted again.

This puts back what the Console decided:

* A person's latest recorded move (`MembershipTransfer`) says where they
  belong. If they still have a membership there, and their home is now a
  different one made after that move, that later one is ended and the place
  they were moved to is their home again.
* A role with nobody recorded as granting it, held where the same role was
  revoked earlier, is revoked again.

It finds nothing on a second run. `--dry-run` reports and changes nothing.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from identity.authorization import revoke_role
from identity.models import Membership, MembershipTransfer, RoleAssignment


class Command(BaseCommand):
    help = 'Undo the memberships and roles derive_hierarchy put back after Console changes.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        with transaction.atomic():
            moved = self._memberships()
            revoked = self._roles()
            if options['dry_run']:
                self.stdout.write(self.style.WARNING('DRY RUN — rolling back.'))
                transaction.set_rollback(True)
        self.stdout.write(self.style.SUCCESS(
            f'homes put back:{moved} roles revoked again:{revoked}'))

    def _memberships(self):
        fixed = 0
        latest = {}
        # Newest first, so the first one seen for a user is their latest move.
        for transfer in MembershipTransfer.objects.order_by('-transferred_at').iterator():
            latest.setdefault(transfer.user_id, transfer)

        for transfer in latest.values():
            active = Membership.objects.filter(user_id=transfer.user_id, is_active=True)
            chosen = active.filter(organization_node_id=transfer.to_node_id).first()
            if chosen is None or chosen.is_primary:
                continue
            put_back = active.filter(
                is_primary=True, created_at__gt=transfer.transferred_at,
            ).select_related('user', 'organization_node').first()
            if put_back is None:
                continue

            self.stdout.write(
                f'  {put_back.user.get_username()}: ending {put_back.organization_node.name}, '
                f'home is {transfer.to_node.name}')
            # End the later one first: a user may have one home at a time.
            Membership.objects.filter(pk=put_back.pk).update(is_active=False, is_primary=False)
            Membership.objects.filter(pk=chosen.pk).update(is_primary=True)
            fixed += 1
        return fixed

    def _roles(self):
        fixed = 0
        again = RoleAssignment.objects.filter(
            is_active=True, appointed_by__isnull=True,
        ).select_related('user', 'role', 'node')
        for assignment in again:
            revoked_before = RoleAssignment.objects.filter(
                user_id=assignment.user_id, role_id=assignment.role_id,
                node_id=assignment.node_id, is_active=False,
                created_at__lt=assignment.created_at,
            ).exists()
            if not revoked_before:
                continue
            self.stdout.write(
                f'  {assignment.user.get_username()}: revoking {assignment.role.code} '
                f'at {assignment.node.name} again')
            revoke_role(assignment)
            fixed += 1
        return fixed
