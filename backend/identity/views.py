"""
Identity & authorization API.

Every endpoint delegates authorization to `identity.authorization` — no
permission logic is implemented inline. List endpoints are scoped with
``scope_queryset``; object/collection access is gated by ``HasPermission``.
"""
import uuid

from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from hierarchy.models import HierarchyNode
from . import authorization as authz
from .authorization import HasPermission
from .models import Membership, Permission, Profile, Role, RoleAssignment
from .permissions_registry import Perm
from .serializers import (
    MembershipSerializer, MeSerializer, PermissionSerializer, ProfileSerializer,
    RoleAssignmentSerializer, RoleSerializer,
)


class MeView(APIView):
    """The current user's identity, profile, memberships, roles and permissions."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class MyProfileView(APIView):
    """Read/update the current user's own profile (self-service, no role needed)."""
    permission_classes = [IsAuthenticated]

    def _profile(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        return profile

    def get(self, request):
        return Response(ProfileSerializer(self._profile(request)).data)

    def patch(self, request):
        serializer = ProfileSerializer(self._profile(request), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class RoleViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only catalogue of roles and their permissions."""
    queryset = Role.objects.prefetch_related('permissions').all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasPermission(Perm.ROLES_VIEW)]


class PermissionListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(Perm.ROLES_VIEW)]

    def get(self, request):
        return Response(PermissionSerializer(Permission.objects.all(), many=True).data)


def _as_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _narrow_to_node(queryset, request, node_field):
    """`?node=<id>` narrows a list to that node and everything beneath it.

    It can only narrow. The queryset is already restricted by `scope_queryset`
    to subtrees where the caller holds the permission, so naming a node outside
    them returns nothing rather than that node's rows. A value that is not a
    node id returns nothing too, not the unfiltered list.
    """
    raw = request.query_params.get('node')
    if not raw:
        return queryset
    node_id = _as_uuid(raw)
    node = HierarchyNode.objects.filter(pk=node_id).first() if node_id else None
    if node is None:
        return queryset.none()
    return queryset.filter(**{f'{node_field}__path__startswith': node.path})


# What "search for a person" means on both lists below.
_PERSON_SEARCH = [
    'user__first_name', 'user__last_name', 'user__username', 'user__email',
    'user__profile__display_name',
]


class MembershipViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                        mixins.CreateModelMixin, viewsets.GenericViewSet):
    """List/inspect memberships within the caller's scope; create with
    memberships.manage at the target node."""
    serializer_class = MembershipSerializer
    # `?is_active=true`, `?search=`, `?node=` and `?page_size=` (up to 200).
    filterset_fields = ['is_active', 'is_primary']
    search_fields = _PERSON_SEARCH + ['organization_node__name']

    def get_permissions(self):
        code = Perm.MEMBERSHIPS_MANAGE if self.action == 'create' else Perm.MEMBERSHIPS_VIEW
        return [IsAuthenticated(), HasPermission(code)()]

    def get_permission_node(self, request):
        node_id = request.data.get('organization_node')
        return HierarchyNode.objects.filter(pk=node_id).first() if node_id else None

    def get_queryset(self):
        # user__profile: UserRefSerializer reads profile.display_name, which is a
        # query per row without this.
        qs = (Membership.objects
              .select_related('organization_node', 'user', 'user__profile')
              .order_by('-joined_at'))
        qs = authz.scope_queryset(qs, self.request.user, Perm.MEMBERSHIPS_VIEW,
                                  node_field='organization_node')
        return _narrow_to_node(qs, self.request, 'organization_node')

    def perform_create(self, serializer):
        # Route through the service so single-primary demotion and the active
        # (user, node) uniqueness are handled consistently.
        data = serializer.validated_data
        serializer.instance = authz.set_membership(
            data['user'], data['organization_node'],
            is_primary=data.get('is_primary', False),
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def transfer(self, request, pk=None):
        """
        Move this person's home to another node.

        `POST /identity/memberships/<id>/transfer/` with `{to_node, reason?}`.

        The caller needs `memberships.manage` at both ends: over where the
        person is leaving and over where they are going. The move is recorded
        (`MembershipTransfer`), the new membership becomes their home, and the
        one they left is ended so they are not listed in two places.
        """
        membership = self.get_object()
        target = HierarchyNode.objects.filter(pk=_as_uuid(request.data.get('to_node'))).first()
        if target is None:
            return Response({'to_node': ['Choose where to move them to.']},
                            status=status.HTTP_400_BAD_REQUEST)
        if not target.is_active:
            return Response({'to_node': [f'{target.name} is not active.']},
                            status=status.HTTP_400_BAD_REQUEST)
        if target.pk == membership.organization_node_id:
            return Response({'to_node': [f'They already belong to {target.name}.']},
                            status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not (authz.has_permission(user, Perm.MEMBERSHIPS_MANAGE, membership.organization_node)
                and authz.has_permission(user, Perm.MEMBERSHIPS_MANAGE, target)):
            return Response(
                {'detail': 'You can only move someone between parts of the church you manage members in.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        moved = authz.transfer_primary_membership(
            membership.user, target, transferred_by=user,
            reason=(request.data.get('reason') or '').strip(),
        )
        Membership.objects.filter(pk=membership.pk).exclude(pk=moved.pk).update(
            is_active=False, is_primary=False)
        moved = Membership.objects.select_related(
            'organization_node', 'user', 'user__profile').get(pk=moved.pk)
        return Response(MembershipSerializer(moved).data)


class RoleAssignmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                            mixins.CreateModelMixin, mixins.DestroyModelMixin,
                            viewsets.GenericViewSet):
    """Grant/revoke authority. Creation goes through the authorization service
    (validates node level and blocks privilege escalation)."""
    serializer_class = RoleAssignmentSerializer
    # `?is_active=true`, `?search=`, `?node=`, and `?users=<id>,<id>` for the
    # roles held by the people on one page of a member list.
    filterset_fields = ['is_active', 'role']
    search_fields = _PERSON_SEARCH + ['role__label', 'node__name']

    def get_permissions(self):
        code = Perm.ROLES_ASSIGN if self.action in ('create', 'destroy') else Perm.ROLES_VIEW
        return [IsAuthenticated(), HasPermission(code)()]

    def get_permission_node(self, request):
        node_id = request.data.get('node')
        return HierarchyNode.objects.filter(pk=node_id).first() if node_id else None

    def get_queryset(self):
        qs = (RoleAssignment.objects
              .select_related('role', 'node', 'user', 'user__profile',
                              'appointed_by', 'appointed_by__profile')
              .prefetch_related('role__permissions')
              .order_by('-created_at'))
        qs = authz.scope_queryset(qs, self.request.user, Perm.ROLES_VIEW, node_field='node')
        qs = _narrow_to_node(qs, self.request, 'node')
        users = self.request.query_params.get('users')
        if users is not None:
            ids = [u for u in (_as_uuid(part) for part in users.split(',')) if u]
            qs = qs.filter(user_id__in=ids)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = get_object_or_404(Role, pk=serializer.validated_data['role'].pk)
        node = get_object_or_404(HierarchyNode, pk=serializer.validated_data['node'].pk)
        target_user = serializer.validated_data['user']
        # Authorization service enforces node-level validity + escalation guard.
        assignment = authz.assign_role(
            target_user, role, node,
            appointed_by=request.user,
            start_date=serializer.validated_data.get('start_date'),
            end_date=serializer.validated_data.get('end_date'),
        )
        return Response(RoleAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        authz.revoke_role(instance)  # soft-revoke, preserves history
