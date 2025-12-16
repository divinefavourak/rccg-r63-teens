from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from django.core.validators import MinLengthValidator, RegexValidator
import uuid

class UserManager(BaseUserManager):
    """Custom manager for User model"""
    
    def create_user(self, username, email, password=None, **extra_fields):
        if not username:
            raise ValueError('Username is required')
        if not email:
            raise ValueError('Email is required')
        
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'admin')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Comprehensive User model for RCCG R63 system"""
    
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrator'
        COORDINATOR = 'coordinator', 'Coordinator'
        INDIVIDUAL = 'individual', 'Individual'
    
    class Province(models.TextChoices):
        # Updated to match frontend/src/constants/formFields.tsx
        LAGOS_PROVINCE_9 = 'lagos_province_9', 'Lagos Province 9'
        LAGOS_PROVINCE_28 = 'lagos_province_28', 'Lagos Province 28'
        LAGOS_PROVINCE_69 = 'lagos_province_69', 'Lagos Province 69'
        LAGOS_PROVINCE_84 = 'lagos_province_84', 'Lagos Province 84'
        LAGOS_PROVINCE_86 = 'lagos_province_86', 'Lagos Province 86'
        LAGOS_PROVINCE_104 = 'lagos_province_104', 'Lagos Province 104'
        REGIONAL_HQ = 'regional_hq', 'Regional Headquarter'
    
    # Core identification
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(
        max_length=150,
        unique=True,
        validators=[
            MinLengthValidator(3),
            RegexValidator(
                regex=r'^[\w.@+-]+$',
                message='Enter a valid username. Only letters, numbers, and @/./+/-/_ are allowed.'
            )
        ]
    )
    email = models.EmailField(unique=True)
    
    # Personal information
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(
        max_length=20,
        validators=[
            RegexValidator(
                regex=r'^\+?1?\d{9,15}$',
                message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
            )
        ]
    )
    
    # Role and permissions
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.COORDINATOR)
    province = models.CharField(max_length=50, choices=Province.choices, null=True, blank=True)
    
    # Church hierarchy (for coordinators)
    zone = models.CharField(max_length=100, blank=True)
    area = models.CharField(max_length=100, blank=True)
    parish = models.CharField(max_length=100, blank=True)
    
    # Status flags
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    
    # Timestamps
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Profile metadata
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    bio = models.TextField(blank=True, max_length=500)
    
    # Communication preferences
    email_notifications = models.BooleanField(default=True)
    sms_notifications = models.BooleanField(default=False)
    
    # Security
    password_reset_required = models.BooleanField(default=False)
    failed_login_attempts = models.IntegerField(default=0)
    account_locked_until = models.DateTimeField(null=True, blank=True)
    
    # Audit fields
    created_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_users'
    )
    
    objects = UserManager()
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name']
    
    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['province']),
            models.Index(fields=['is_active']),
        ]
        ordering = ['-date_joined']
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN
    
    @property
    def is_coordinator(self):
        return self.role == self.Role.COORDINATOR
    
    def get_display_name(self):
        """Get display name for the user"""
        if self.first_name and self.last_name:
            return self.full_name
        return self.username
    
    def can_access_province(self, province_name):
        """Check if user can access data from a specific province"""
        if self.is_admin:
            return True
        return self.province == province_name
    
    def increment_failed_login(self):
        """Increment failed login attempts and lock if needed"""
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.account_locked_until = timezone.now() + timezone.timedelta(minutes=15)
        self.save()
    
    def reset_failed_logins(self):
        """Reset failed login attempts"""
        self.failed_login_attempts = 0
        self.account_locked_until = None
        self.save()


class LoginHistory(models.Model):
    """Track user login history"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_history')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    login_time = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=True)
    
    class Meta:
        verbose_name_plural = 'Login Histories'
        ordering = ['-login_time']
    
    def __str__(self):
        return f"{self.user.username} - {self.login_time}"


class AuditLog(models.Model):
    """Audit log for tracking changes in the system"""
    class ActionType(models.TextChoices):
        CREATE = 'create', 'Create'
        UPDATE = 'update', 'Update'
        DELETE = 'delete', 'Delete'
        LOGIN = 'login', 'Login'
        LOGOUT = 'logout', 'Logout'
        PASSWORD_CHANGE = 'password_change', 'Password Change'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='audit_actions'
    )
    action = models.CharField(max_length=50, choices=ActionType.choices)
    entity_type = models.CharField(max_length=100)  # e.g., 'User', 'Ticket'
    entity_id = models.CharField(max_length=255)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]
    
    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.action} - {self.entity_type}"