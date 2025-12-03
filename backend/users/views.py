from rest_framework import viewsets, generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.contrib.auth import authenticate
from django.db.models import Q

from .models import User, LoginHistory, AuditLog
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    LoginSerializer, TokenResponseSerializer,
    LoginHistorySerializer, AuditLogSerializer
)
from .permissions import IsAdmin, IsSelfOrAdmin, ProvinceAccessPermission


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token obtain view with login history tracking"""
    
    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        # Check if user exists
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            LoginHistory.objects.create(
                user=None,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                success=False
            )
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if account is locked
        if user.account_locked_until and user.account_locked_until > timezone.now():
            return Response(
                {"detail": "Account is temporarily locked. Try again later."},
                status=status.HTTP_423_LOCKED
            )
        
        # Authenticate user
        user = authenticate(username=username, password=password)
        
        if user is None:
            # Failed login attempt
            user = User.objects.get(username=username)
            user.increment_failed_login()
            
            LoginHistory.objects.create(
                user=user,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                success=False
            )
            
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Successful login
        user.reset_failed_logins()
        user.last_login = timezone.now()
        user.save()
        
        # Track login history
        LoginHistory.objects.create(
            user=user,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            success=True
        )
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        response_data = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        }
        
        return Response(response_data)
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User management"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_permissions(self):
        if self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsSelfOrAdmin()]
        return super().get_permissions()
    
    def get_queryset(self):
        user = self.request.user
        
        if not user.is_authenticated:
            return User.objects.none()
        
        # Admins see all users
        if user.role == User.Role.ADMIN:
            return User.objects.all()
        
        # Coordinators see only themselves
        return User.objects.filter(id=user.id)
    
    def perform_create(self, serializer):
        user = serializer.save()
        
        # Log the creation
        AuditLog.objects.create(
            user=self.request.user,
            action=AuditLog.ActionType.CREATE,
            entity_type='User',
            entity_id=str(user.id),
            new_values=UserSerializer(user).data,
            ip_address=self.get_client_ip(self.request),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')
        )
    
    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_data = UserSerializer(old_instance).data
        
        instance = serializer.save()
        
        # Log the update
        AuditLog.objects.create(
            user=self.request.user,
            action=AuditLog.ActionType.UPDATE,
            entity_type='User',
            entity_id=str(instance.id),
            old_values=old_data,
            new_values=UserSerializer(instance).data,
            ip_address=self.get_client_ip(self.request),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')
        )
    
    def perform_destroy(self, instance):
        # Log before deletion
        AuditLog.objects.create(
            user=self.request.user,
            action=AuditLog.ActionType.DELETE,
            entity_type='User',
            entity_id=str(instance.id),
            old_values=UserSerializer(instance).data,
            ip_address=self.get_client_ip(self.request),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')
        )
        
        instance.delete()
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class CurrentUserView(APIView):
    """Get current user info"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class ChangePasswordView(APIView):
    """Change user password"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password or not new_password:
            return Response(
                {"detail": "Both current and new passwords are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not user.check_password(current_password):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(new_password)
        user.save()
        
        # Log password change
        AuditLog.objects.create(
            user=user,
            action=AuditLog.ActionType.PASSWORD_CHANGE,
            entity_type='User',
            entity_id=str(user.id),
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return Response({"detail": "Password changed successfully."})
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class LoginHistoryView(generics.ListAPIView):
    """View user login history"""
    serializer_class = LoginHistorySerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        
        if user_id:
            return LoginHistory.objects.filter(user_id=user_id)
        
        return LoginHistory.objects.all()


class AuditLogView(generics.ListAPIView):
    """View audit logs"""
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
    def get_queryset(self):
        queryset = AuditLog.objects.all()
        
        # Filter by entity type
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(timestamp__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__lte=end_date)
        
        return queryset