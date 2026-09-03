"""
Read and write API for the org tree.

Every mutation routes through `hierarchy.services` rather than touching
treebeard directly, so the level invariant ("a node's type is exactly one below
its parent's") is enforced in one place. `HierarchyNode.clean` enforces it again
at the model boundary, which is what catches the Django admin's own move form.

Writes are gated on `hierarchy.manage` **at the node being changed** — not
merely held somewhere. A Regional Coordinator with hierarchy.manage at Region 63
may not rename National, and the check is an ancestor-or-self comparison rather
than a role name.
"""
from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from identity.authorization import has_permission
from identity.permissions_registry import Perm

from . import services
from .models import HierarchyNode, child_type_of
from .scoping import selectable_node_ids, visible_nodes
from .serializers import HierarchyNodeSerializer


def _context(request, nodes=None):
    return {
        'selectable_ids': selectable_node_ids(request.user),
        'path_to_id': {n.path: n.id for n in (nodes or [])},
        'request': request,
    }


class NodeListView(APIView):
    """
    `GET  /api/v1/hierarchy/nodes/` — every node the caller may see.
    `POST /api/v1/hierarchy/nodes/` — add a child node.

    The list is flat and ordered by materialized path, which is depth-first tree
    order, so the client builds the nested structure in a single pass.

    Returns the authority subtree plus its ancestors; `selectable` marks which is
    which. A caller with no `hierarchy.view` anywhere gets an empty list rather
    than a 403 — having no tree is a legitimate state (a Teacher), not an error.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        nodes = list(visible_nodes(request.user).order_by('path'))
        serializer = HierarchyNodeSerializer(
            nodes, many=True, context=_context(request, nodes),
        )
        return Response({'count': len(nodes), 'results': serializer.data})

    @transaction.atomic
    def post(self, request):
        parent_id = request.data.get('parent')
        name = (request.data.get('name') or '').strip()

        if not name:
            return Response({'name': ['A name is required.']},
                            status=status.HTTP_400_BAD_REQUEST)
        if not parent_id:
            # Creating a root is a one-time bootstrap act with no parent to
            # authorize against, so it stays a management command.
            return Response(
                {'parent': ['A parent is required. The root node is created by '
                            '`manage.py derive_hierarchy`, not through the API.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parent = HierarchyNode.objects.filter(pk=parent_id).first()
        if parent is None:
            return Response({'parent': ['No such node.']},
                            status=status.HTTP_404_NOT_FOUND)

        if not has_permission(request.user, Perm.HIERARCHY_MANAGE, parent):
            return Response(
                {'detail': 'You cannot add nodes here.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # The child's type is determined, never chosen: exactly one type may sit
        # beneath a given parent. Accepting it from the client would let a
        # caller propose an invalid tree we then have to reject.
        node_type = child_type_of(parent.node_type)
        if node_type is None:
            return Response(
                {'parent': [f'A {parent.get_node_type_display()} cannot have children.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            node = services.add_child(
                parent, node_type, name,
                code=(request.data.get('code') or '').strip(),
            )
        except ValidationError as exc:
            return Response({'detail': exc.messages[0]},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response(
            HierarchyNodeSerializer(node, context=_context(request, [parent, node])).data,
            status=status.HTTP_201_CREATED,
        )


class NodeDetailView(APIView):
    """
    `GET    /nodes/<uuid>/` — one node, if visible.
    `PATCH  /nodes/<uuid>/` — rename, re-code, or deactivate.
    `DELETE /nodes/<uuid>/` — deactivate (never a hard delete).
    """
    permission_classes = [IsAuthenticated]

    def _visible(self, request, pk):
        return visible_nodes(request.user).filter(pk=pk).first()

    def get(self, request, pk):
        node = self._visible(request, pk)
        if node is None:
            # 404 rather than 403: revealing that a node exists but is out of
            # scope is itself a disclosure about the shape of the tree.
            return Response({'detail': 'Not found.'},
                            status=status.HTTP_404_NOT_FOUND)

        ancestors = []
        if node.depth > 1:
            steplen = HierarchyNode.steplen
            paths = [node.path[:l] for l in range(steplen, len(node.path), steplen)]
            ancestors = list(HierarchyNode.objects.filter(path__in=paths))

        return Response(
            HierarchyNodeSerializer(
                node, context=_context(request, [*ancestors, node]),
            ).data
        )

    @transaction.atomic
    def patch(self, request, pk):
        node = self._visible(request, pk)
        if node is None:
            return Response({'detail': 'Not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        if not has_permission(request.user, Perm.HIERARCHY_MANAGE, node):
            return Response({'detail': 'You cannot change this node.'},
                            status=status.HTTP_403_FORBIDDEN)

        changed = []
        if 'name' in request.data:
            name = (request.data.get('name') or '').strip()
            if not name:
                return Response({'name': ['A name is required.']},
                                status=status.HTTP_400_BAD_REQUEST)
            node.name = name
            changed.append('name')
        if 'code' in request.data:
            node.code = (request.data.get('code') or '').strip()
            changed.append('code')
        if 'is_active' in request.data:
            node.is_active = bool(request.data['is_active'])
            changed.append('is_active')

        if not changed:
            return Response({'detail': 'Nothing to change.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            node.full_clean(exclude=['path', 'depth', 'numchild', 'slug'])
        except ValidationError as exc:
            return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)

        node.save(update_fields=[*changed, 'updated_at'])
        return Response(
            HierarchyNodeSerializer(node, context=_context(request, [node])).data
        )

    @transaction.atomic
    def delete(self, request, pk):
        """
        Deactivate, never destroy.

        Nodes are referenced by memberships and role assignments with
        `on_delete=PROTECT`, so a hard delete would either fail or orphan
        history. Deactivating keeps the record of who belonged where.
        """
        node = self._visible(request, pk)
        if node is None:
            return Response({'detail': 'Not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        if not has_permission(request.user, Perm.HIERARCHY_MANAGE, node):
            return Response({'detail': 'You cannot change this node.'},
                            status=status.HTTP_403_FORBIDDEN)

        node.is_active = False
        node.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class NodeMoveView(APIView):
    """
    `POST /nodes/<uuid>/move/` — reparent a node.

    Authority is required at **both** ends: where it is leaving and where it is
    going. Holding manage at only the destination would otherwise let someone
    pull a subtree out of a peer's scope into their own.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        node = visible_nodes(request.user).filter(pk=pk).first()
        if node is None:
            return Response({'detail': 'Not found.'},
                            status=status.HTTP_404_NOT_FOUND)

        parent = HierarchyNode.objects.filter(
            pk=request.data.get('parent')).first()
        if parent is None:
            return Response({'parent': ['No such node.']},
                            status=status.HTTP_404_NOT_FOUND)

        if not has_permission(request.user, Perm.HIERARCHY_MANAGE, node):
            return Response({'detail': 'You cannot move this node.'},
                            status=status.HTTP_403_FORBIDDEN)
        if not has_permission(request.user, Perm.HIERARCHY_MANAGE, parent):
            return Response({'detail': 'You cannot move a node to there.'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            moved = services.move_node(node, parent)
        except ValidationError as exc:
            return Response({'detail': exc.messages[0]},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response(
            HierarchyNodeSerializer(moved, context=_context(request, [moved])).data
        )
