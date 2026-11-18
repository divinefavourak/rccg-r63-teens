"""
"I teach at church": the question sign-up asks adults, and what happens to the answer.

Saying yes grants nothing. Teacher tools open a class list with teens' names,
contacts and reading, so they are given by a person who knows the church, never
claimed on a form. A yes is stored on the account (`User.asked_to_teach_at`)
and the coordinators over the place the person chose are told. They answer it
in People: giving any role that does something clears it
(`authorization.assign_role`); "Not a teacher" clears it too.

Who is told: whoever can give roles at the person's church and is closest to
it. A parish's own coordinator hears about it, the regional office does not;
if nobody below the region can give roles there, the nearest level up that can
is told instead, and if no one at all, the superusers.
"""
import logging
from datetime import date

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# The question is only asked from here up. Younger people are teens, whatever
# they think they do on Sundays; the app hides the question for them and the
# server ignores an answer it did not ask for.
ASK_FROM_AGE = 20


def _age(dob, today=None):
    today = today or date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def record(user, date_of_birth, node):
    """Store the request and, once the account is committed, tell the leaders."""
    if date_of_birth is None or _age(date_of_birth) < ASK_FROM_AGE:
        return False
    user.asked_to_teach_at = timezone.now()
    user.save(update_fields=['asked_to_teach_at'])
    user_id, node_id = user.pk, getattr(node, 'pk', None)
    transaction.on_commit(lambda: notify_leaders(user_id, node_id))
    return True


def leaders_for(node):
    """The people who should hear about a request from someone at ``node``."""
    from identity.models import RoleAssignment
    from identity.permissions_registry import Perm

    User = get_user_model()
    if node is not None:
        today = timezone.localdate()
        grants = (
            RoleAssignment.objects
            .filter(is_active=True, start_date__lte=today, user__is_active=True,
                    role__role_permissions__permission__code=Perm.ROLES_ASSIGN)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
            .select_related('node', 'user')
            .distinct()
        )
        # The same rule as scope_queryset: a grant covers its node and
        # everything beneath it, by materialized path.
        covering = [g for g in grants if node.path.startswith(g.node.path)]
        if covering:
            nearest = max(g.node.depth for g in covering)
            return list({g.user_id: g.user for g in covering if g.node.depth == nearest}.values())
    return list(User.objects.filter(is_superuser=True, is_active=True))


def notify_leaders(user_id, node_id):
    """Best effort: the account exists whatever happens here."""
    try:
        from hierarchy.models import HierarchyNode
        from identity.models import Membership
        from notifications import services
        from notifications.models import NotificationType

        User = get_user_model()
        person = User.objects.get(pk=user_id)
        node = HierarchyNode.objects.filter(pk=node_id).first() if node_id else None
        membership = (Membership.objects
                      .filter(user=person, is_primary=True, is_active=True).first())
        name = person.get_full_name() or person.username
        where = f' at {node.name}' if node else ''
        link = f'/console/people/{membership.pk}' if membership else '/console/people'

        for leader in leaders_for(node):
            if leader.pk == person.pk:
                continue
            services.send(
                leader, NotificationType.SYSTEM,
                f'{name} says they teach',
                f'{name} joined{where} and said they teach at church. '
                'Give them the Teacher role, or mark them as not a teacher, in People.',
                deep_link=link,
                dedupe_key=f'teach-request:{person.pk}',
                defer_push=True,
            )
    except Exception:
        logger.exception('Could not tell leaders about a teach request from %s', user_id)


def decline(user):
    """A coordinator says this person does not teach. Nothing else changes."""
    type(user).objects.filter(pk=user.pk).update(asked_to_teach_at=None)
