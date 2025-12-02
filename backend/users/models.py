from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

class UserManager(BaseUserManager):
    """Custom user manager for the User model."""
    
    def create_user(self, username, password=None, **extra_fields):
        """Create and return a regular user with a username and password."""
        if not username:
            raise ValueError(_('The Username field must be set'))
        
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        """Create and return a superuser."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        
        return self.create_user(username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model for the R63 Teens system."""
    
    class Role(models.TextChoices):
        ADMIN = 'admin', _('Administrator')
        COORDINATOR = 'coordinator', _('Coordinator')
    
    # Required fields
    username = models.CharField(
        _('username'),
        max_length=255,
        unique=True,
        help_text=_('Required. 255 characters or fewer. Letters, digits and @/./+/-/_ only.')
    )
    email = models.EmailField(
        _('email address'),
        unique=True,
        blank=True,
        null=True,
        help_text=_('Optional email address for notifications.')
    )
    name = models.CharField(
        _('full name'),
        max_length=255,
        help_text=_('Full name of the user.')
    )
    
    # Role-based fields
    role = models.CharField(
        _('role'),
        max_length=20,
        choices=Role.choices,
        default=Role.COORDINATOR,
        help_text=_('User role in the system.')
    )
    province = models.CharField(
        _('province'),
        max_length=255,
        blank=True,
        null=True,
        help_text=_('Province assigned to the coordinator.')
    )
    
    # Status fields
    is_active = models.BooleanField(
        _('active'),
        default=True,
        help_text=_(
            'Designates whether this user should be treated as active. '
            'Unselect this instead of deleting accounts.'
        )
    )
    is_staff = models.BooleanField(
        _('staff status'),
        default=False,
        help_text=_('Designates whether the user can log into this admin site.')
    )
    
    # Timestamps
    date_joined = models.DateTimeField(_('date joined'), default=timezone.now)
    last_login = models.DateTimeField(_('last login'), blank=True, null=True)
    
    # Custom manager
    objects = UserManager()
    
    # Field used for authentication
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['name', 'email']
    
    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['province']),
        ]
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.username})"
    
    @property
    def is_admin(self):
        """Check if user is an administrator."""
        return self.role == self.Role.ADMIN
    
    @property
    def is_coordinator(self):
        """Check if user is a coordinator."""
        return self.role == self.Role.COORDINATOR
    
    def has_coordinator_access(self, province):
        """Check if coordinator has access to a specific province."""
        if self.is_admin:
            return True
        return self.is_coordinator and self.province == province
    
    def get_role_display_name(self):
        """Get human-readable role name."""
        return dict(self.Role.choices).get(self.role, self.role)