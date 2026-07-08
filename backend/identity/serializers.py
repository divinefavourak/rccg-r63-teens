from rest_framework import serializers

from hierarchy.models import HierarchyNode
from .models import Membership, Permission, Profile, Role, RoleAssignment


class NodeRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = HierarchyNode
        fields = ('id', 'name', 'node_type')


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

    class Meta:
        model = Membership
        fields = ('id', 'user', 'organization_node', 'organization_node_detail',
                  'is_primary', 'is_active', 'joined_at')
        read_only_fields = ('id', 'joined_at')


class RoleAssignmentSerializer(serializers.ModelSerializer):
    role_detail = RoleSerializer(source='role', read_only=True)
    node_detail = NodeRefSerializer(source='node', read_only=True)

    class Meta:
        model = RoleAssignment
        fields = ('id', 'user', 'role', 'role_detail', 'node', 'node_detail',
                  'start_date', 'end_date', 'is_active', 'appointed_by', 'created_at')
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
