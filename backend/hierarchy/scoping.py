"""
Hierarchy scoping — which nodes may a given user see?

Mirrors `events/scoping.py` in both shape and intent: the scoping rules that need
`identity.authorization` live in their own module so `hierarchy.models` stays free
of the dependency (`models.py`: "identity depends on hierarchy, never the
reverse").

Two categories of visible node, and the distinction matters to the UI:

* **In scope** — nodes inside a subtree where the user holds `hierarchy.view`.
  These are selectable: the operator may switch the Console's scope to any of
  them, and authority flows down to them from their assignment.
* **Ancestors** — nodes *above* that subtree. Returned so the client can render a
  breadcrumb ("RCCG National / Region 63 / Province 69") without a second
  request, but marked non-selectable: a Province Coordinator may see that their
  province sits under Region 63 without being able to scope to the region.

Without the ancestors a rooted operator sees their own node floating with no
context; with them selectable, the scope ceiling leaks.
"""
from hierarchy.models import HierarchyNode


def _ancestor_paths(path, steplen):
    """Every ancestor path of ``path``, excluding the node itself.

    treebeard materialized paths are fixed-width segments, so the ancestors of
    ``000100020003`` are exactly ``0001`` and ``00010002`` — string slices, not a
    tree walk.
    """
    return [path[:length] for length in range(steplen, len(path), steplen)]


def authority_paths(user, permission_code):
    """Paths of the nodes where ``user`` holds ``permission_code`` directly.

    Each is the root of a subtree the user has authority over. Returns None for a
    superuser (sentinel: the whole tree, no filtering).
    """
    if getattr(user, 'is_superuser', False):
        return None
    if not user or not user.is_authenticated:
        return []

    from identity.authorization import active_role_assignments, _role_permission_map

    assignments = list(active_role_assignments(user))
    perms = _role_permission_map(assignments)
    return [
        a.node.path
        for a in assignments
        if permission_code in perms.get(a.role_id, ())
    ]


def visible_nodes(user, permission_code=None):
    """
    The nodes ``user`` may see, as a queryset.

    Includes their authority subtrees *and* the ancestors of those subtrees. Use
    `selectable_node_ids` to tell the two apart when rendering.
    """
    from identity.permissions_registry import Perm

    if permission_code is None:
        permission_code = Perm.HIERARCHY_VIEW

    prefixes = authority_paths(user, permission_code)
    if prefixes is None:
        return HierarchyNode.objects.all()
    if not prefixes:
        return HierarchyNode.objects.none()

    from django.db.models import Q

    steplen = HierarchyNode.steplen
    query = Q()
    for prefix in prefixes:
        # The subtree at this node, self included.
        query |= Q(path__startswith=prefix)
    # Ancestors, for breadcrumb context only.
    ancestors = {p for prefix in prefixes for p in _ancestor_paths(prefix, steplen)}
    if ancestors:
        query |= Q(path__in=ancestors)

    return HierarchyNode.objects.filter(query)


def selectable_node_ids(user, permission_code=None):
    """
    Ids of the nodes the user may actually *scope to* — the authority subtrees,
    without the ancestors.

    None is the superuser sentinel, meaning "everything is selectable".
    """
    from identity.permissions_registry import Perm

    if permission_code is None:
        permission_code = Perm.HIERARCHY_VIEW

    prefixes = authority_paths(user, permission_code)
    if prefixes is None:
        return None
    if not prefixes:
        return set()

    from django.db.models import Q

    query = Q()
    for prefix in prefixes:
        query |= Q(path__startswith=prefix)
    return set(
        HierarchyNode.objects.filter(query).values_list('id', flat=True)
    )
