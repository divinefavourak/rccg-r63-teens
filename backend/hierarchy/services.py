"""
Domain services for the church hierarchy — tree mutation and traversal only.

This module wraps treebeard so business rules (the level invariant) are enforced
in one place and callers never depend on treebeard's API directly. Authorization
and membership logic live in `identity.authorization`.
"""
from django.db import transaction
from django.utils.text import slugify

from .models import HierarchyNode, NodeType, child_type_of, validate_parent_child

__all__ = [
    'child_type_of', 'validate_parent_child', 'create_root', 'add_child',
    'get_or_create_child', 'move_node', 'is_ancestor_or_self', 'subtree_node_ids',
]


@transaction.atomic
def create_root(name, node_type=NodeType.NATIONAL, code='', slug=''):
    """Create the tree root. Only a NATIONAL node may be a root."""
    from django.core.exceptions import ValidationError
    if NodeType(node_type) != NodeType.NATIONAL:
        raise ValidationError('The root node must be of type National.')
    return HierarchyNode.add_root(
        node_type=NodeType.NATIONAL,
        name=name,
        code=code,
        slug=slug or slugify(name)[:300],
    )


@transaction.atomic
def add_child(parent, node_type, name, code='', slug=''):
    """Add a child node under ``parent`` after enforcing the level invariant."""
    validate_parent_child(parent.node_type, node_type)
    return parent.add_child(
        node_type=node_type,
        name=name,
        code=code,
        slug=slug or slugify(name)[:300],
    )


@transaction.atomic
def get_or_create_child(parent, node_type, name, code=''):
    """
    Idempotent child creation keyed by (parent, node_type, normalized name).
    Returns (node, created). Dedup is case/space-insensitive; there is no
    DB-level uniqueness on siblings (a treebeard limitation), so concurrent
    creators can race — bulk callers should serialize or cache.
    """
    validate_parent_child(parent.node_type, node_type)
    normalized = name.strip().casefold()
    for child in parent.get_children():
        if child.node_type == node_type and child.name.strip().casefold() == normalized:
            return child, False
    node = add_child(parent, node_type, name.strip(), code=code)
    return node, True


@transaction.atomic
def move_node(node, new_parent):
    """
    Re-parent ``node`` (and, via treebeard, its whole subtree) under
    ``new_parent``. Members keep their membership rows, so they are re-scoped
    automatically — the docs' "moving a parish re-scopes its members."
    """
    validate_parent_child(new_parent.node_type, node.node_type)
    node.move(new_parent, pos='sorted-child')
    return HierarchyNode.objects.get(pk=node.pk)


def is_ancestor_or_self(ancestor, target):
    """True if ``ancestor`` is ``target`` or an ancestor of it (path-prefix test)."""
    if ancestor.pk == target.pk:
        return True
    return target.is_descendant_of(ancestor)


def subtree_node_ids(node):
    """IDs of ``node`` plus all its descendants."""
    ids = [node.pk]
    ids.extend(node.get_descendants().values_list('pk', flat=True))
    return ids
