from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    
    role_display = serializers.CharField(source='get_role_display_name', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'name', 
            'role', 'role_display', 'province',
            'is_active', 'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'role_display']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True},
            'province': {'required': False, 'allow_blank': True},
        }
    
    def validate(self, data):
        """Validate user data."""
        # If role is coordinator, province is required
        if data.get('role') == User.Role.COORDINATOR and not data.get('province'):
            raise serializers.ValidationError({
                'province': _('Province is required for coordinators.')
            })
        
        # If role is admin, province should be empty
        if data.get('role') == User.Role.ADMIN and data.get('province'):
            data['province'] = None
        
        return data


class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""
    
    username = serializers.CharField(
        max_length=255,
        required=True,
        help_text=_('Username of the user.')
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text=_('Password of the user.')
    )
    
    def validate(self, data):
        """Validate user credentials."""
        username = data.get('username')
        password = data.get('password')
        
        if username and password:
            # Try to authenticate user
            user = authenticate(username=username, password=password)
            
            if user:
                if not user.is_active:
                    raise serializers.ValidationError(
                        _('User account is disabled. Please contact an administrator.')
                    )
                data['user'] = user
            else:
                raise serializers.ValidationError(
                    _('Unable to log in with provided credentials.')
                )
        else:
            raise serializers.ValidationError(
                _('Must include "username" and "password".')
            )
        
        return data


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration (admin only)."""
    
    password = serializers.CharField(
        write_only=True,
        required=True,
        min_length=8,
        validators=[validate_password],
        style={'input_type': 'password'},
        help_text=_('Password must be at least 8 characters long.')
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text=_('Enter the same password as above, for verification.')
    )
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'name', 
            'role', 'province', 'password', 'confirm_password'
        ]
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True},
            'province': {'required': False, 'allow_blank': True},
        }
    
    def validate(self, data):
        """Validate registration data."""
        # Check password confirmation
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'password': _('Passwords do not match.'),
                'confirm_password': _('Passwords do not match.')
            })
        
        # Validate role-specific requirements
        role = data.get('role', User.Role.COORDINATOR)
        
        if role == User.Role.COORDINATOR and not data.get('province'):
            raise serializers.ValidationError({
                'province': _('Province is required for coordinators.')
            })
        
        if role == User.Role.ADMIN and data.get('province'):
            data['province'] = None
        
        return data
    
    def create(self, validated_data):
        """Create a new user."""
        # Remove confirm_password from validated data
        validated_data.pop('confirm_password')
        
        # Create user
        user = User.objects.create_user(**validated_data)
        
        # Log user creation (could be logged to audit log)
        return user


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password."""
    
    old_password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text=_('Your current password.')
    )
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        min_length=8,
        validators=[validate_password],
        style={'input_type': 'password'},
        help_text=_('New password must be at least 8 characters long.')
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text=_('Enter the same new password for verification.')
    )
    
    def validate(self, data):
        """Validate password change data."""
        # Check new password confirmation
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'new_password': _('Passwords do not match.'),
                'confirm_password': _('Passwords do not match.')
            })
        
        # Check if new password is different from old password
        if data['old_password'] == data['new_password']:
            raise serializers.ValidationError({
                'new_password': _('New password must be different from old password.')
            })
        
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile updates."""
    
    class Meta:
        model = User
        fields = ['name', 'email']
        extra_kwargs = {
            'name': {'required': True},
            'email': {'required': False, 'allow_blank': True},
        }