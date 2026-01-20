"""
Teen profile models for the RCCG R63 Teens platform.
"""
from django.db import models
from django.conf import settings
from common.models import TimestampMixin, UUIDMixin, Province
import uuid


class TeenProfile(UUIDMixin, TimestampMixin):
    """
    One-to-one extension of User for teen-specific data.
    Stores personal info, church hierarchy, guardian info, and preferences.
    """
    
    class AgeGroup(models.TextChoices):
        TODDLER = 'toddler', 'Toddler (1-5)'
        CHILDREN = 'children', 'Children (6-7)'
        PRE_TEEN = 'pre_teen', 'Pre-Teen (8-12)'
        TEEN = 'teen', 'Teen (13-17)'
        YOUNG_ADULT = 'young_adult', 'Young Adult (18-19)'
    
    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'
        NOT_SPECIFIED = 'not_specified', 'Prefer not to say'
    
    # User relationship (one-to-one)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teen_profile'
    )
    
    # Personal Information
    date_of_birth = models.DateField()
    age_group = models.CharField(
        max_length=20,
        choices=AgeGroup.choices,
        blank=True
    )
    gender = models.CharField(max_length=20, choices=Gender.choices)
    bio = models.TextField(blank=True, max_length=500)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    
    # Church Hierarchy
    province = models.CharField(max_length=50, choices=Province.choices)
    zone = models.CharField(max_length=100, blank=True)
    area = models.CharField(max_length=100, blank=True)
    parish = models.CharField(max_length=255)
    department = models.CharField(max_length=255, blank=True)
    
    # Guardian Information
    guardian_name = models.CharField(max_length=255)
    guardian_phone = models.CharField(max_length=20)
    guardian_email = models.EmailField()
    guardian_relationship = models.CharField(max_length=100)
    
    # Emergency Contact (can be different from guardian)
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_relationship = models.CharField(max_length=100, blank=True)
    
    # Medical Information (for events)
    medical_conditions = models.TextField(blank=True)
    allergies = models.TextField(blank=True)
    medications = models.TextField(blank=True)
    dietary_restrictions = models.TextField(blank=True)
    blood_group = models.CharField(max_length=10, blank=True)
    
    # Preferences
    favorite_devotional_topics = models.JSONField(default=list, blank=True)
    notification_preferences = models.JSONField(default=dict, blank=True)
    
    # Engagement Stats
    devotionals_read_count = models.PositiveIntegerField(default=0)
    events_attended_count = models.PositiveIntegerField(default=0)
    streak_days = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_active_at = models.DateTimeField(null=True, blank=True)
    last_devotional_date = models.DateField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Teen Profile'
        verbose_name_plural = 'Teen Profiles'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['province']),
            models.Index(fields=['age_group']),
            models.Index(fields=['parish']),
            models.Index(fields=['user']),
        ]
    
    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username}'s Profile"
    
    def save(self, *args, **kwargs):
        # Auto-calculate age group from date of birth
        if self.date_of_birth:
            from datetime import date
            today = date.today()
            age = today.year - self.date_of_birth.year - (
                (today.month, today.day) < 
                (self.date_of_birth.month, self.date_of_birth.day)
            )
            self.age_group = self._calculate_age_group(age)
        super().save(*args, **kwargs)
    
    def _calculate_age_group(self, age):
        """Determine age group based on age."""
        if age <= 5:
            return self.AgeGroup.TODDLER
        elif age <= 7:
            return self.AgeGroup.CHILDREN
        elif age <= 12:
            return self.AgeGroup.PRE_TEEN
        elif age <= 17:
            return self.AgeGroup.TEEN
        else:
            return self.AgeGroup.YOUNG_ADULT
    
    @property
    def age(self):
        """Calculate current age."""
        from datetime import date
        today = date.today()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < 
            (self.date_of_birth.month, self.date_of_birth.day)
        )
    
    def update_streak(self, read_date):
        """Update devotional reading streak."""
        from datetime import date, timedelta
        
        if self.last_devotional_date:
            days_diff = (read_date - self.last_devotional_date).days
            
            if days_diff == 1:
                # Consecutive day - increment streak
                self.streak_days += 1
            elif days_diff > 1:
                # Streak broken - reset
                self.streak_days = 1
            # If days_diff == 0, same day - no change
        else:
            # First devotional
            self.streak_days = 1
        
        # Update longest streak
        if self.streak_days > self.longest_streak:
            self.longest_streak = self.streak_days
        
        self.last_devotional_date = read_date
        self.devotionals_read_count += 1
        self.save()


class DevotionalProgress(UUIDMixin, TimestampMixin):
    """Tracks which devotionals a teen has read."""
    
    profile = models.ForeignKey(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='devotional_progress'
    )
    devotional_id = models.UUIDField()  # Reference to Devotional in content app
    read_at = models.DateTimeField(auto_now_add=True)
    completion_percentage = models.PositiveIntegerField(default=100)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = [['profile', 'devotional_id']]
        ordering = ['-read_at']
        verbose_name = 'Devotional Progress'
        verbose_name_plural = 'Devotional Progress'
    
    def __str__(self):
        return f"{self.profile} - Devotional {self.devotional_id}"


class ManualProgress(UUIDMixin, TimestampMixin):
    """Tracks manual/lesson completion progress."""
    
    profile = models.ForeignKey(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='manual_progress'
    )
    manual_id = models.UUIDField()  # Reference to Manual in content app
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completion_percentage = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    
    class Meta:
        unique_together = [['profile', 'manual_id']]
        ordering = ['-started_at']
    
    def __str__(self):
        return f"{self.profile} - Manual {self.manual_id}"


class Favorite(UUIDMixin, TimestampMixin):
    """User favorites/bookmarks for content."""
    
    class ContentType(models.TextChoices):
        DEVOTIONAL = 'devotional', 'Devotional'
        MANUAL = 'manual', 'Manual'
        MEDIA_EPISODE = 'media_episode', 'Media Episode'
        EVENT = 'event', 'Event'
    
    profile = models.ForeignKey(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='favorites'
    )
    content_type = models.CharField(max_length=20, choices=ContentType.choices)
    content_id = models.UUIDField()
    
    class Meta:
        unique_together = [['profile', 'content_type', 'content_id']]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.profile} - {self.content_type}: {self.content_id}"
