"""
Hierarchy scoping for events.

`docs/07-feature-specifications.md` §3: "Every content item, event, and
announcement declares a visibility scope; users see items scoped **at or above**
their position."

Two different questions, deliberately kept apart:

* **Who may *see* this event?** — everyone at or below its `scope_node`. A teen in
  Parish A sees a Parish A event, an Area event above it, a Province event above
  that, and a Region event above that. They do not see Parish B's event.
* **Who may *manage* it?** — whoever holds `events.manage` at a node that is an
  ancestor-or-self of the event's `scope_node`. That is `identity.authorization.
  scope_queryset`, which the backend audit noted could not be wired until events
  carried a node at all (C2).

The old `?province=` filter did neither. It compared a client-supplied string to a
hard-coded enum, which is both a hard-coded region (forbidden by
`docs/15-technical-architecture.md`) and the IDOR the audit flagged: the client
chose which province's data to ask for.
"""
from django.db.models import Q

from hierarchy.models import HierarchyNode
from identity.authorization import has_any_permission, scope_queryset
from identity.models import Membership
from identity.permissions_registry import Perm


def user_node(user):
    """
    The user's position in the tree — their primary membership node, or None.

    None is a real answer, not a failure: a user in the 'Unassigned' bucket, or one
    created before the hierarchy existed, genuinely has no position.
    """
    if not user or not user.is_authenticated:
        return None

    membership = (
        Membership.objects
        .filter(user=user, is_primary=True, is_active=True)
        .select_related('organization_node')
        .first()
    )
    return membership.organization_node if membership else None


def visible_to(queryset, user):
    """
    Restrict `queryset` to the events this user is allowed to *see*.

    An event is visible when its `scope_node` is at or above the user's position —
    i.e. the user's node lies inside the event's subtree — or when the event is
    unscoped (`scope_node` NULL, meaning "everywhere").

    **A user with no position sees everything published.** That is deliberate: a
    guest browsing events, or a teen whose parish has not been assigned yet, must
    not be shown an empty screen. Scoping narrows what a *placed* user sees; it is
    not an authentication gate, and the events it filters are published ones that
    were already public.
    """
    node = user_node(user)
    if node is None:
        return queryset

    # `node.path` is treebeard's materialized path. An event is visible when the
    # user's path starts with the event's — that is exactly "the event's node is an
    # ancestor of, or is, the user's node". Evaluated in the database, so scoping
    # costs a prefix comparison rather than a tree walk per row.
    ancestor_paths = [
        node.path[:length]
        for length in range(HierarchyNode.steplen, len(node.path) + 1,
                            HierarchyNode.steplen)
    ]

    return queryset.filter(
        Q(scope_node__isnull=True) | Q(scope_node__path__in=ancestor_paths)
    )


def manageable_by(queryset, user):
    """
    Restrict `queryset` to events this user may *manage* — those inside a subtree
    where they hold `events.manage`.

    This is the row-level scoping the audit called for. A province coordinator can
    now only edit their own province's events, not the region's or another
    province's, which no permission class could enforce while the scope was a
    string array.
    """
    return scope_queryset(queryset, user, Perm.EVENTS_MANAGE, node_field='scope_node')


def can_manage(user, event):
    """May this user manage this specific event?"""
    if getattr(user, 'is_superuser', False):
        return True
    if not has_any_permission(user, Perm.EVENTS_MANAGE):
        return False
    if event.scope_node_id is None:
        # An unscoped event belongs to nobody in particular; anyone who may manage
        # events at all may manage it. The alternative — nobody may — would strand
        # every legacy event that migrated to NULL.
        return True
    return manageable_by(
        type(event).objects.filter(pk=event.pk), user,
    ).exists()
