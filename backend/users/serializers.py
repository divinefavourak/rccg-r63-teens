from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import User, LoginHistory, AuditLog


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    province_display = serializers.CharField(source='get_province_display', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'role', 'role_display', 'province', 'province_display',
            'zone', 'area', 'parish', 'is_active', 'date_joined', 'last_login',
            'profile_picture', 'bio', 'email_notifications', 'sms_notifications',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']
    
    def get_full_name(self, obj):
        return obj.full_name


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        validators=[validate_password]
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'phone', 'role', 'province',
            'zone', 'area', 'parish'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }
    
    def validate(self, data):
        # Check if passwords match
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords don't match."})
        
        # Role-specific validation
        if data.get('role') == User.Role.COORDINATOR and not data.get('province'):
            raise serializers.ValidationError({"province": "Province is required for coordinators."})
        
        # Admin shouldn't have province
        if data.get('role') == User.Role.ADMIN and data.get('province'):
            raise serializers.ValidationError({"province": "Administrators should not have a province assigned."})
        
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        
        # Set is_staff and is_superuser based on role
        if user.role == User.Role.ADMIN:
            user.is_staff = True
            user.is_superuser = True
        
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users"""
    current_password = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'},
        validators=[validate_password]
    )
    
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone', 'email',
            'zone', 'area', 'parish', 'profile_picture', 'bio',
            'email_notifications', 'sms_notifications',
            'current_password', 'new_password'
        ]
    
    def validate(self, data):
        request = self.context.get('request')
        user = request.user if request else None
        
        # Check if trying to change password
        if 'new_password' in data:
            if not user or not user.check_password(data.get('current_password', '')):
                raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        
        return data
    
    def update(self, instance, validated_data):
        # Handle password change
        new_password = validated_data.pop('new_password', None)
        validated_data.pop('current_password', None)
        
        if new_password:
            instance.set_password(new_password)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    username = serializers.CharField()
    password = serializers.CharField(
        style={'input_type': 'password'},
        trim_whitespace=False
    )
    
    def validate(self, data):
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            raise serializers.ValidationError("Both username and password are required.")
        
        return data


class TokenResponseSerializer(serializers.Serializer):
    """Serializer for token responses"""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class LoginHistorySerializer(serializers.ModelSerializer):
    """Serializer for login history"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = LoginHistory
        fields = ['id', 'user_username', 'ip_address', 'user_agent', 'login_time', 'success']
        read_only_fields = fields


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs"""
    user_display = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user_display', 'action', 'action_display',
            'entity_type', 'entity_id', 'old_values', 'new_values',
            'ip_address', 'user_agent', 'timestamp'
        ]
        read_only_fields = fields
    
    def get_user_display(self, obj):
        return obj.user.get_display_name() if obj.user else 'System'