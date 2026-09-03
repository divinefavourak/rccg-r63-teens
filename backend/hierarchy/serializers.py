"""Read serializers for the org tree."""
from rest_framework import serializers

from .models import HierarchyNode


class HierarchyNodeSerializer(serializers.ModelSerializer):
    """
    A single node, flat.

    `path` and `depth` are exposed deliberately: the client needs them to compute
    ancestry locally (a materialized path is sliceable) so that expanding the
    tree, drawing breadcrumbs and narrowing permissions to a scope do not each
    cost a round trip.

    `selectable` answers "may the operator scope to this node?". It is False for
    the ancestors returned purely for breadcrumb context — see
    `hierarchy.scoping`. The field is annotated by the view, which knows the
    requesting user; it is not a property of the node itself.
    """
    selectable = serializers.SerializerMethodField()
    parent_id = serializers.SerializerMethodField()

    class Meta:
        model = HierarchyNode
        fields = (
            'id', 'name', 'node_type', 'code', 'slug', 'is_active',
            'path', 'depth', 'parent_id', 'selectable',
        )

    def get_selectable(self, node):
        allowed = self.context.get('selectable_ids')
        if allowed is None:  # superuser sentinel — everything is selectable
            return True
        return node.id in allowed

    def get_parent_id(self, node):
        """Derived from the path rather than a query — the parent's path is this
        node's path minus one segment. Root nodes have no parent."""
        steplen = HierarchyNode.steplen
        if node.depth <= 1:
            return None
        parent_path = node.path[:-steplen]
        lookup = self.context.get('path_to_id') or {}
        return lookup.get(parent_path)
