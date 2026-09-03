"""
Identity & authorization API.

Every endpoint delegates authorization to `identity.authorization` — no
permission logic is implemented inline. List endpoints are scoped with
``scope_queryset``; object/collection access is gated by ``HasPermission``.
"""
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
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


class MembershipViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                        mixins.CreateModelMixin, viewsets.GenericViewSet):
    """List/inspect memberships within the caller's scope; create with
    memberships.manage at the target node."""
    serializer_class = MembershipSerializer

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
        return authz.scope_queryset(qs, self.request.user, Perm.MEMBERSHIPS_VIEW,
                                    node_field='organization_node')

    def perform_create(self, serializer):
        # Route through the service so single-primary demotion and the active
        # (user, node) uniqueness are handled consistently.
        data = serializer.validated_data
        serializer.instance = authz.set_membership(
            data['user'], data['organization_node'],
            is_primary=data.get('is_primary', False),
        )


class RoleAssignmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                            mixins.CreateModelMixin, mixins.DestroyModelMixin,
                            viewsets.GenericViewSet):
    """Grant/revoke authority. Creation goes through the authorization service
    (validates node level and blocks privilege escalation)."""
    serializer_class = RoleAssignmentSerializer

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
        return authz.scope_queryset(qs, self.request.user, Perm.ROLES_VIEW, node_field='node')

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
