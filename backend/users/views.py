from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import action
from django.contrib.auth import authenticate
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .models import User
from .serializers import (
    UserSerializer, LoginSerializer, RegisterSerializer,
    ChangePasswordSerializer, UserProfileSerializer
)
from .permissions import IsAdminUser, IsOwnerOrAdmin


class LoginView(generics.GenericAPIView):
    """
    API view for user login.
    Returns JWT tokens on successful authentication.
    """
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        """Authenticate user and return JWT tokens."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        # Update last login time
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        
        # Prepare response data
        response_data = {
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
        
        return Response(response_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    API view for user logout.
    Blacklists the refresh token.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Logout user by blacklisting refresh token."""
        try:
            refresh_token = request.data.get("refresh")
            
            if not refresh_token:
                return Response(
                    {"detail": _("Refresh token is required.")},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Blacklist the refresh token
            token = RefreshToken(refresh_token)
            token.blacklist()
            
            return Response(
                {"detail": _("Successfully logged out.")},
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            return Response(
                {"detail": _("Invalid token or token already blacklisted.")},
                status=status.HTTP_400_BAD_REQUEST
            )


class RegisterView(generics.CreateAPIView):
    """
    API view for registering new users (admin only).
    """
    serializer_class = RegisterSerializer
    permission_classes = [IsAdminUser]
    
    def perform_create(self, serializer):
        """Create new user and log the action."""
        user = serializer.save()
        # TODO: Send welcome email or notification
        # TODO: Log user creation in audit log
        return user


class ChangePasswordView(generics.GenericAPIView):
    """
    API view for changing user password.
    """
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Change user password."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        
        # Verify old password
        if not user.check_password(serializer.validated_data['old_password']):
            return Response(
                {"old_password": [_("Wrong password.")]},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set new password
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        # TODO: Log password change in audit log
        
        return Response(
            {"detail": _("Password updated successfully.")},
            status=status.HTTP_200_OK
        )


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    API view for user profile.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        """Return the authenticated user."""
        return self.request.user
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'GET':
            return UserSerializer
        return UserProfileSerializer


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing users (admin only).
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        """Return filtered queryset based on query parameters."""
        queryset = super().get_queryset()
        
        # Filter by role if provided
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(role=role)
        
        # Filter by province if provided
        province = self.request.query_params.get('province', None)
        if province:
            queryset = queryset.filter(province=province)
        
        # Filter by active status if provided
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            is_active = is_active.lower() == 'true'
            queryset = queryset.filter(is_active=is_active)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user account."""
        user = self.get_object()
        
        if user == request.user:
            return Response(
                {"detail": _("You cannot deactivate your own account.")},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.is_active = False
        user.save()
        
        # Send deactivation email
        if user.email:
            from .utils import send_account_deactivation_email
            send_account_deactivation_email(user)
        
        return Response(
            {"detail": _("User deactivated successfully.")},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user account."""
        user = self.get_object()
        
        user.is_active = True
        user.save()
        
        # Send activation email
        if user.email:
            from .utils import send_account_activation_email
            send_account_activation_email(user)
        
        return Response(
            {"detail": _("User activated successfully.")},
            status=status.HTTP_200_OK
        )


class CoordinatorListView(generics.ListAPIView):
    """
    API view for listing coordinators.
    """
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        """Return only coordinator users."""
        return User.objects.filter(role=User.Role.COORDINATOR, is_active=True)