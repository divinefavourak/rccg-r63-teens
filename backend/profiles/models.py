from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
import uuid
from users.models import User


class TeenProfile(models.Model):
    """Extended profile for teen users"""
    
    class GradeLevel(models.TextChoices):
        JSS_1 = 'jss1', 'JSS 1'
        JSS_2 = 'jss2', 'JSS 2'
        JSS_3 = 'jss3', 'JSS 3'
        SS_1 = 'ss1', 'SS 1'
        SS_2 = 'ss2', 'SS 2'
        SS_3 = 'ss3', 'SS 3'
        UNIVERSITY = 'university', 'University'
        OTHER = 'other', 'Other'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='teen_profile'
    )
    
    # Personal details
    date_of_birth = models.DateField(null=True, blank=True)
    school = models.CharField(max_length=255, blank=True)
    grade_level = models.CharField(
        max_length=20,
        choices=GradeLevel.choices,
        blank=True
    )
    
    # Interests (comma-separated)
    interests = models.TextField(
        blank=True,
        help_text="Comma-separated list of interests"
    )
    favorite_topics = models.TextField(
        blank=True,
        help_text="Comma-separated list of favorite topics"
    )
    
    # Notification preferences
    devotional_reminder = models.BooleanField(
        default=True,
        help_text="Receive daily devotional reminders"
    )
    new_content_notification = models.BooleanField(
        default=True,
        help_text="Receive notifications for new content"
    )
    event_notification = models.BooleanField(
        default=True,
        help_text="Receive notifications for upcoming events"
    )
    
    # Engagement stats
    total_devotionals_read = models.IntegerField(default=0, editable=False)
    total_manuals_completed = models.IntegerField(default=0, editable=False)
    total_podcasts_played = models.IntegerField(default=0, editable=False)
    current_streak = models.IntegerField(default=0, editable=False)
    longest_streak = models.IntegerField(default=0, editable=False)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Teen Profile'
        verbose_name_plural = 'Teen Profiles'
    
    def __str__(self):
        return f"Profile: {self.user.username}"
    
    @property
    def interests_list(self):
        """Return interests as a list"""
        if self.interests:
            return [i.strip() for i in self.interests.split(',')]
        return []
    
    @property
    def favorite_topics_list(self):
        """Return favorite topics as a list"""
        if self.favorite_topics:
            return [t.strip() for t in self.favorite_topics.split(',')]
        return []
    
    def record_activity(self):
        """Record user activity and update streak"""
        today = timezone.now().date()
        
        if self.last_activity_at:
            last_date = self.last_activity_at.date()
            
            if last_date == today:
                # Already recorded today
                return
            elif last_date == today - timezone.timedelta(days=1):
                # Consecutive day - increment streak
                self.current_streak += 1
            else:
                # Streak broken
                self.current_streak = 1
        else:
            self.current_streak = 1
        
        if self.current_streak > self.longest_streak:
            self.longest_streak = self.current_streak
        
        self.last_activity_at = timezone.now()
        self.save()


class ContentProgress(models.Model):
    """Track content consumption progress"""
    
    class ProgressStatus(models.TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='content_progress'
    )
    
    # Generic relation to any content type
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Progress tracking
    status = models.CharField(
        max_length=20,
        choices=ProgressStatus.choices,
        default=ProgressStatus.NOT_STARTED
    )
    progress_percentage = models.IntegerField(
        default=0,
        help_text="0-100 percentage"
    )
    
    # For audio/video content
    last_position = models.DurationField(
        null=True,
        blank=True,
        help_text="Last playback position"
    )
    
    # User notes
    notes = models.TextField(blank=True)
    
    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_accessed_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Content Progress'
        verbose_name_plural = 'Content Progress Records'
        unique_together = ['user', 'content_type', 'object_id']
        ordering = ['-last_accessed_at']
        indexes = [
            models.Index(fields=['user', 'content_type']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.content_type.model} - {self.status}"
    
    def mark_started(self):
        """Mark content as started"""
        if not self.started_at:
            self.started_at = timezone.now()
        self.status = self.ProgressStatus.IN_PROGRESS
        self.save()
    
    def mark_completed(self):
        """Mark content as completed"""
        self.status = self.ProgressStatus.COMPLETED
        self.progress_percentage = 100
        self.completed_at = timezone.now()
        self.save()
        
        # Update profile stats
        if hasattr(self.user, 'teen_profile'):
            profile = self.user.teen_profile
            model_name = self.content_type.model
            
            if model_name == 'devotional':
                profile.total_devotionals_read += 1
            elif model_name == 'manual':
                profile.total_manuals_completed += 1
            elif model_name == 'podcast':
                profile.total_podcasts_played += 1
            
            profile.record_activity()


class SavedContent(models.Model):
    """Bookmarked/saved content for later"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='saved_content'
    )
    
    # Generic relation to any content type
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # User note (optional)
    note = models.CharField(max_length=500, blank=True)
    
    # Timestamps
    saved_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Saved Content'
        verbose_name_plural = 'Saved Content'
        unique_together = ['user', 'content_type', 'object_id']
        ordering = ['-saved_at']
        indexes = [
            models.Index(fields=['user', 'content_type']),
        ]
    
    def __str__(self):
        return f"{self.user.username} saved {self.content_type.model}"
