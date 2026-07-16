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
        TODDLER   = 'toddler',   'Toddler (1-5)'
        CHILDREN  = 'children',  'Children (6-8)'
        PRE_TEEN  = 'pre_teen',  'Pre-Teen (9-12)'
        TEEN      = 'teen',      'Teen (13-19)'
        SUPERTEEN = 'superteen', 'Superteen (19+)'
    
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
    date_of_birth = models.DateField(null=True, blank=True)
    age_group = models.CharField(
        max_length=20,
        choices=AgeGroup.choices,
        blank=True,
        default=''
    )
    gender = models.CharField(max_length=20, choices=Gender.choices)
    bio = models.TextField(blank=True, max_length=500)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    
    # Church Hierarchy
    province = models.CharField(max_length=50, choices=Province.choices, blank=True)
    zone = models.CharField(max_length=100, blank=True)
    area = models.CharField(max_length=100, blank=True)
    parish = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)

    # Guardian Information
    guardian_name = models.CharField(max_length=255, blank=True)
    guardian_phone = models.CharField(max_length=20, blank=True)
    guardian_email = models.EmailField(blank=True)
    guardian_relationship = models.CharField(max_length=100, blank=True)
    
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
        elif age <= 8:
            return self.AgeGroup.CHILDREN
        elif age <= 12:
            return self.AgeGroup.PRE_TEEN
        elif age <= 19:
            return self.AgeGroup.TEEN
        else:
            return self.AgeGroup.SUPERTEEN
    
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
        """
        DEPRECATED — legacy streak counter. The authoritative streak now lives in
        the Progress engine (`progress.services.record_action` +
        `StreakState`/Grace Days). This is dual-written only to keep the existing
        `streak_days`/`longest_streak` API fields populated until the frontend
        reads from `/api/progress/`; it has no Grace Days and no tz-safe day
        boundary. Remove once the contract migration lands (audit H2).
        """
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


class TeacherProfile(UUIDMixin, TimestampMixin):
    """
    Profile for teacher users — assigned under a coordinator, scoped to age groups.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teacher_profile'
    )
    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supervised_teachers'
    )
    province = models.CharField(max_length=50, blank=True)
    assigned_age_groups = models.JSONField(
        default=list,
        blank=True,
        help_text="Age groups this teacher is assigned to e.g. ['children', 'pre_teen']"
    )
    bio = models.TextField(blank=True, max_length=500)

    class Meta:
        verbose_name = 'Teacher Profile'
        verbose_name_plural = 'Teacher Profiles'

    def __str__(self):
        return f"{self.user.get_display_name()}'s Teacher Profile"


class ChildGameProfile(UUIDMixin, TimestampMixin):
    """
    Gamification profile for children (6-8). Stores coins, level, mascot.
    """
    profile = models.OneToOneField(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='game_profile'
    )
    coins = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=1)
    mascot_style = models.CharField(max_length=50, default='default')
    total_coins_earned = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Child Game Profile'
        verbose_name_plural = 'Child Game Profiles'

    def __str__(self):
        return f"{self.profile} — {self.coins} coins"

    def award_coins(self, amount):
        self.coins += amount
        self.total_coins_earned += amount
        self.save()

    def spend_coins(self, amount):
        if self.coins >= amount:
            self.coins -= amount
            self.save()
            return True
        return False


class Badge(UUIDMixin, TimestampMixin):
    """Badge definition — earned by children/preteens/teens for milestones."""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=100, blank=True)
    eligible_age_groups = models.JSONField(
        default=list,
        blank=True,
        help_text="Empty = all age groups. e.g. ['children', 'pre_teen']"
    )
    coins_reward = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Badge'
        verbose_name_plural = 'Badges'

    def __str__(self):
        return self.name


class UserBadge(UUIDMixin, TimestampMixin):
    """Awarded badge for a specific profile."""
    profile = models.ForeignKey(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='earned_badges'
    )
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='awarded_to')
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['profile', 'badge']]
        verbose_name = 'User Badge'
        verbose_name_plural = 'User Badges'
        ordering = ['-earned_at']

    def __str__(self):
        return f"{self.profile} — {self.badge.name}"


class Certificate(UUIDMixin, TimestampMixin):
    """Certificate definition — major milestones."""
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    requirement = models.TextField(blank=True)
    eligible_age_groups = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = 'Certificate'
        verbose_name_plural = 'Certificates'

    def __str__(self):
        return self.name


class UserCertificate(UUIDMixin, TimestampMixin):
    """Earned certificate for a profile."""
    profile = models.ForeignKey(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='earned_certificates'
    )
    certificate = models.ForeignKey(Certificate, on_delete=models.CASCADE, related_name='awarded_to')
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['profile', 'certificate']]
        verbose_name = 'User Certificate'
        verbose_name_plural = 'User Certificates'
        ordering = ['-earned_at']

    def __str__(self):
        return f"{self.profile} — {self.certificate.name}"


class DailyRewardClaim(UUIDMixin, TimestampMixin):
    """Tracks daily reward claims for children."""
    profile = models.ForeignKey(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='daily_reward_claims'
    )
    claimed_date = models.DateField()
    coins_awarded = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [['profile', 'claimed_date']]
        verbose_name = 'Daily Reward Claim'
        verbose_name_plural = 'Daily Reward Claims'
        ordering = ['-claimed_date']

    def __str__(self):
        return f"{self.profile} — {self.claimed_date} ({self.coins_awarded} coins)"


class FaithJourney(UUIDMixin, TimestampMixin):
    """Faith journey/track definition for teens and preteens."""
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    topic = models.CharField(max_length=100, blank=True)
    total_steps = models.PositiveIntegerField(default=1)
    target_age_groups = models.JSONField(
        default=list,
        blank=True,
        help_text="Empty = all. e.g. ['teen', 'superteen']"
    )
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Faith Journey'
        verbose_name_plural = 'Faith Journeys'
        ordering = ['order', 'title']

    def __str__(self):
        return self.title


class UserJourneyProgress(UUIDMixin, TimestampMixin):
    """Tracks a user's progress through a FaithJourney."""
    profile = models.ForeignKey(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='journey_progress'
    )
    journey = models.ForeignKey(FaithJourney, on_delete=models.CASCADE, related_name='user_progress')
    steps_completed = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [['profile', 'journey']]
        verbose_name = 'User Journey Progress'
        verbose_name_plural = 'User Journey Progress'

    def __str__(self):
        return f"{self.profile} — {self.journey.title} ({self.steps_completed}/{self.journey.total_steps})"

    @property
    def completion_percentage(self):
        if self.journey.total_steps == 0:
            return 0
        return int((self.steps_completed / self.journey.total_steps) * 100)


class MoodEntry(UUIDMixin, TimestampMixin):
    """Daily mood check-in for teens/preteens."""
    profile = models.ForeignKey(
        TeenProfile,
        on_delete=models.CASCADE,
        related_name='mood_entries'
    )
    mood = models.PositiveSmallIntegerField(
        help_text="1=Very Sad, 2=Sad, 3=Neutral, 4=Happy, 5=Very Happy"
    )
    note = models.TextField(blank=True, max_length=300)
    entry_date = models.DateField()

    class Meta:
        unique_together = [['profile', 'entry_date']]
        verbose_name = 'Mood Entry'
        verbose_name_plural = 'Mood Entries'
        ordering = ['-entry_date']

    def __str__(self):
        return f"{self.profile} — {self.entry_date} (mood: {self.mood})"


class DailyChallenge(UUIDMixin, TimestampMixin):
    """Daily or weekly challenge (memory verse, prayer task, etc.)."""
    title = models.CharField(max_length=200)
    description = models.TextField()
    challenge_date = models.DateField(db_index=True)
    target_age_groups = models.JSONField(
        default=list,
        blank=True,
        help_text="Empty = all age groups"
    )
    coins_reward = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Daily Challenge'
        verbose_name_plural = 'Daily Challenges'
        ordering = ['-challenge_date']

    def __str__(self):
        return f"{self.challenge_date} — {self.title}"
