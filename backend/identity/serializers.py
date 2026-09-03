from django.contrib.auth import get_user_model
from rest_framework import serializers

from hierarchy.models import HierarchyNode
from .models import Membership, Permission, Profile, Role, RoleAssignment


class NodeRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = HierarchyNode
        fields = ('id', 'name', 'node_type')


class UserRefSerializer(serializers.ModelSerializer):
    """
    The minimum needed to *name* a person in a list.

    Nested into membership and role-assignment payloads so a People screen can
    render without either fetching the entire user table to join against, or
    issuing a request per row. Deliberately excludes anything sensitive — this
    travels to every client that may see the membership.
    """
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'display_name', 'email', 'is_active')

    def get_display_name(self, user):
        profile = getattr(user, 'profile', None)
        if profile and profile.display_name:
            return profile.display_name
        full = f'{user.first_name} {user.last_name}'.strip()
        return full or user.get_username()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = (
            'id', 'display_name', 'photo', 'gender', 'birthday', 'bio',
            'timezone', 'preferences', 'updated_at',
        )
        read_only_fields = ('id', 'updated_at')


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ('code', 'label', 'description')


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SlugRelatedField(slug_field='code', many=True, read_only=True)

    class Meta:
        model = Role
        fields = ('id', 'code', 'label', 'description', 'allowed_node_types',
                  'permissions', 'is_system', 'is_active')


class MembershipSerializer(serializers.ModelSerializer):
    organization_node_detail = NodeRefSerializer(source='organization_node', read_only=True)
    user_detail = UserRefSerializer(source='user', read_only=True)

    class Meta:
        model = Membership
        fields = ('id', 'user', 'user_detail', 'organization_node',
                  'organization_node_detail', 'is_primary', 'is_active', 'joined_at')
        read_only_fields = ('id', 'joined_at')


class RoleAssignmentSerializer(serializers.ModelSerializer):
    role_detail = RoleSerializer(source='role', read_only=True)
    node_detail = NodeRefSerializer(source='node', read_only=True)
    user_detail = UserRefSerializer(source='user', read_only=True)
    appointed_by_detail = UserRefSerializer(source='appointed_by', read_only=True)

    class Meta:
        model = RoleAssignment
        fields = ('id', 'user', 'user_detail', 'role', 'role_detail', 'node',
                  'node_detail', 'start_date', 'end_date', 'is_active',
                  'appointed_by', 'appointed_by_detail', 'created_at')
        read_only_fields = ('id', 'appointed_by', 'created_at', 'is_active')


class MeSerializer(serializers.Serializer):
    """The current user's identity, profile, belonging, authority and effective
    permissions — one call for the client to bootstrap its authz UI."""
    id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_superuser = serializers.BooleanField()
    profile = serializers.SerializerMethodField()
    memberships = serializers.SerializerMethodField()
    role_assignments = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    def get_profile(self, user):
        profile = getattr(user, 'profile', None)
        return ProfileSerializer(profile).data if profile else None

    def get_memberships(self, user):
        qs = user.memberships.filter(is_active=True).select_related('organization_node')
        return MembershipSerializer(qs, many=True).data

    def get_role_assignments(self, user):
        from .authorization import active_role_assignments
        return RoleAssignmentSerializer(active_role_assignments(user), many=True).data

    def get_permissions(self, user):
        from .authorization import effective_permissions
        return effective_permissions(user)
