from django.contrib import admin
from django.core.exceptions import ValidationError
from treebeard.admin import TreeAdmin
from treebeard.forms import movenodeform_factory

from .models import HierarchyNode, NodeType, validate_parent_child

_BaseMoveForm = movenodeform_factory(HierarchyNode)


class HierarchyNodeAdminForm(_BaseMoveForm):
    """Treebeard move form that also enforces the level invariant.

    The default move form lets an admin drop a node anywhere (e.g. a Parish under
    a Region), bypassing ``hierarchy.services``. We recompute the intended parent
    from the chosen position/reference node and validate the parent->child rule.
    """

    def clean(self):
        cleaned = super().clean()
        node_type = cleaned.get('node_type')
        if not node_type:
            return cleaned

        ref = cleaned.get('_ref_node_id')
        position = cleaned.get('_position') or ''

        if not ref:
            if NodeType(node_type) != NodeType.NATIONAL:
                raise ValidationError('Only a National node may be placed at the root.')
            return cleaned

        ref_node = HierarchyNode.objects.filter(pk=ref).first()
        if ref_node is None:
            return cleaned  # treebeard's own validation will handle a bad ref
        parent = ref_node if position.endswith('child') else ref_node.get_parent()

        if parent is None:
            if NodeType(node_type) != NodeType.NATIONAL:
                raise ValidationError('Only a National node may be placed at the root.')
        else:
            validate_parent_child(parent.node_type, node_type)
        return cleaned


@admin.register(HierarchyNode)
class HierarchyNodeAdmin(TreeAdmin):
    form = HierarchyNodeAdminForm
    list_display = ('name', 'node_type', 'code', 'is_active')
    list_filter = ('node_type', 'is_active')
    search_fields = ('name', 'code', 'slug')
