import logging

from rest_framework import viewsets, generics, status, permissions

logger = logging.getLogger(__name__)
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.contrib.auth import authenticate
from django.db.models import Q

from .email_service import UserEmailService
from .models import User, LoginHistory, AuditLog
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    AdminUserUpdateSerializer, LoginSerializer, TokenResponseSerializer,
    LoginHistorySerializer, AuditLogSerializer
)
from identity.authorization import HasPermission, IsSelfOrHasPermission, has_any_permission
from identity.permissions_registry import Perm


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token obtain view with login history tracking"""
    throttle_scope = 'auth'  # rate-limited via ScopedRateThrottle (settings)

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        # Check if user exists
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Don't create login history for non-existent users (user_id is required)
            # Just return 401 immediately
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
        
        # Email-verification gate (enforced only when configured — non-breaking by default)
        from django.conf import settings as dj_settings
        if getattr(dj_settings, 'ENFORCE_EMAIL_VERIFICATION', False) and not user.is_verified:
            return Response(
                {"detail": "Please verify your email before logging in."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Successful login
        user.reset_failed_logins()
        user.last_login = timezone.now()
        user.save(update_fields=['failed_login_attempts', 'account_locked_until', 'last_login'])
        
        # Track login history
        LoginHistory.objects.create(
            user=user,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            success=True
        )
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        user_data = UserSerializer(user).data
        response_data = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user_data,
            'needs_gender': not has_any_permission(user, Perm.USERS_MANAGE) and not user.gender,
        }

        return Response(response_data)
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class RegisterView(generics.CreateAPIView):
    """Public endpoint for user registration"""
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Extract date_of_birth before saving (it's not on the User model)
        date_of_birth = serializer.validated_data.get('date_of_birth', None)

        user = serializer.save()

        # Auto-create TeenProfile so age_group is calculated immediately
        try:
            from profiles.models import TeenProfile
            if not hasattr(user, 'teen_profile'):
                TeenProfile.objects.create(
                    user=user,
                    date_of_birth=date_of_birth,
                    gender=user.gender or '',
                    province=user.province or '',
                    guardian_name='',
                    guardian_phone='',
                    guardian_email='',
                    guardian_relationship='',
                    parish=user.parish or '',
                )
                logger.info('[Register] TeenProfile created for user=%s age_group=%s',
                            user.username,
                            user.teen_profile.age_group if date_of_birth else 'unknown')
        except Exception as e:
            logger.warning('[Register] Could not auto-create TeenProfile for user=%s: %s', user.username, e)

        UserEmailService.send_welcome_email(user)

        return Response(
            {"detail": "Registration successful. Please login."},
            status=status.HTTP_201_CREATED
        )


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User management"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission(Perm.USERS_MANAGE)]
    pagination_class = None  # Return all users — admin endpoint; dataset is bounded
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            if self.request and has_any_permission(self.request.user, Perm.USERS_MANAGE):
                return AdminUserUpdateSerializer
            return UserUpdateSerializer
        return UserSerializer
    
    def get_permissions(self):
        # Self-service for reading/updating own account; deletion requires
        # users.manage (falls through to the class-level permission) so users
        # cannot delete their own accounts via this endpoint.
        if self.action in ['retrieve', 'update', 'partial_update']:
            return [permissions.IsAuthenticated(), IsSelfOrHasPermission(Perm.USERS_MANAGE)()]
        return super().get_permissions()
    
    def get_queryset(self):
        user = self.request.user
        
        if not user.is_authenticated:
            return User.objects.none()

        # User managers see all users; everyone else sees only themselves.
        # (Node-scoped user visibility via Membership is a documented follow-up.)
        if has_any_permission(user, Perm.USERS_MANAGE):
            return User.objects.all()

        return User.objects.filter(id=user.id)
    
    def perform_create(self, serializer):
        user = serializer.save()

        # Notify the new user that their account was created
        UserEmailService.send_account_created_email(user, created_by=self.request.user)

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
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, HasPermission(Perm.USERS_MANAGE)])
    def send_welcome_email(self, request, pk=None):
        """Manually resend the welcome email for a user."""
        user = self.get_object()
        UserEmailService.send_welcome_email(user)
        return Response({'detail': f'Welcome email sent to {user.email}.'})

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class CurrentUserView(APIView):
    """Get or update current user info"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        return self.patch(request)


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

        UserEmailService.send_password_changed_email(user)

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
    permission_classes = [permissions.IsAuthenticated, HasPermission(Perm.USERS_MANAGE)]
    
    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        
        if user_id:
            return LoginHistory.objects.filter(user_id=user_id)
        
        return LoginHistory.objects.all()


class ForgotPasswordView(APIView):
    """
    Accept an email address and send a password-reset link if the account exists.
    Always returns 200 to prevent email enumeration attacks.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp'

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        ip = request.META.get('REMOTE_ADDR', 'unknown')
        logger.info('[ForgotPassword] Request received for email=%s ip=%s', email, ip)

        if email:
            try:
                user = User.objects.get(email=email, is_active=True)
                logger.info('[ForgotPassword] User found: username=%s id=%s — dispatching reset email', user.username, user.pk)
                UserEmailService.send_password_reset_email(user)
            except User.DoesNotExist:
                logger.info('[ForgotPassword] No active account found for email=%s — no email sent', email)

        return Response(
            {"detail": "If that email is registered, a reset link has been sent."}
        )


class ResetPasswordView(APIView):
    """
    Accept uid + token (from the reset email) and a new password, then apply it.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp'

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        new_password = request.data.get('new_password', '')

        if not uid or not token or not new_password:
            return Response(
                {"detail": "uid, token, and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ip = request.META.get('REMOTE_ADDR', 'unknown')
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError):
            logger.warning('[ResetPassword] Invalid uid — no matching user. ip=%s', ip)
            return Response(
                {"detail": "Invalid reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            logger.warning('[ResetPassword] Expired or invalid token for user=%s ip=%s', user.username, ip)
            return Response(
                {"detail": "Reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()
        logger.info('[ResetPassword] Password successfully reset for user=%s ip=%s', user.username, ip)

        return Response({"detail": "Password has been reset. You may now log in."})


class VerifyEmailView(APIView):
    """Verify a user's email via uid+token (same token scheme as password reset)."""
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp'

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        if not uid or not token:
            return Response(
                {"detail": "uid and token are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Invalid verification link."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Verification link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.is_verified:
            user.is_verified = True
            user.save(update_fields=['is_verified'])
        return Response({"detail": "Email verified. You can now log in."})


class AuditLogView(generics.ListAPIView):
    """View audit logs"""
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission(Perm.USERS_MANAGE)]
    
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