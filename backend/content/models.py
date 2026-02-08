from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, FileExtensionValidator
import uuid
from users.models import User


class Devotional(models.Model):
    """Daily devotional content - Teenage Open Heaven"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    date = models.DateField(unique=True, db_index=True)
    scripture = models.CharField(max_length=500, help_text="Bible reference (e.g., John 3:16)")
    scripture_text = models.TextField(help_text="Full scripture text")
    content = models.TextField(help_text="Main devotional content")
    prayer_points = models.TextField(blank=True, help_text="Prayer points for the day")
    memory_verse = models.CharField(max_length=500, blank=True)
    
    # Metadata
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='authored_devotionals'
    )
    featured_image = models.ImageField(upload_to='devotionals/', null=True, blank=True)
    
    # Status
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['is_published']),
        ]
        verbose_name = 'Devotional'
        verbose_name_plural = 'Devotionals'
    
    def __str__(self):
        return f"{self.date} - {self.title}"
    
    def publish(self):
        """Publish the devotional"""
        self.is_published = True
        self.published_at = timezone.now()
        self.save()
    
    @classmethod
    def get_today(cls):
        """Get today's devotional"""
        return cls.objects.filter(
            date=timezone.now().date(),
            is_published=True
        ).first()


class Manual(models.Model):
    """Sunday-to-Sunday teaching manuals"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    year = models.IntegerField(validators=[MinValueValidator(2020)])
    week_number = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text="Week number of the year (1-52)"
    )
    
    # Content
    theme = models.CharField(max_length=255)
    scripture_reference = models.CharField(max_length=500)
    scripture_text = models.TextField()
    lesson_content = models.TextField()
    discussion_questions = models.TextField(blank=True)
    practical_application = models.TextField(blank=True)
    take_home_points = models.TextField(blank=True)
    
    # Dates
    week_start = models.DateField(help_text="Sunday start date")
    week_end = models.DateField(help_text="Saturday end date")
    
    # Metadata
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='authored_manuals'
    )
    pdf_file = models.FileField(
        upload_to='manuals/',
        null=True,
        blank=True,
        validators=[FileExtensionValidator(['pdf'])]
    )
    
    # Status
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-year', '-week_number']
        unique_together = ['year', 'week_number']
        indexes = [
            models.Index(fields=['year', 'week_number']),
            models.Index(fields=['is_published']),
            models.Index(fields=['week_start', 'week_end']),
        ]
        verbose_name = 'Manual'
        verbose_name_plural = 'Manuals'
    
    def __str__(self):
        return f"Week {self.week_number}, {self.year} - {self.title}"
    
    def publish(self):
        """Publish the manual"""
        self.is_published = True
        self.published_at = timezone.now()
        self.save()
    
    @classmethod
    def get_current_week(cls):
        """Get the manual for the current week"""
        today = timezone.now().date()
        return cls.objects.filter(
            week_start__lte=today,
            week_end__gte=today,
            is_published=True
        ).first()


class Podcast(models.Model):
    """Podcast episodes with audio content"""
    
    class Category(models.TextChoices):
        TEACHING = 'teaching', 'Teaching'
        TESTIMONY = 'testimony', 'Testimony'
        DISCUSSION = 'discussion', 'Discussion'
        WORSHIP = 'worship', 'Worship'
        INTERVIEW = 'interview', 'Interview'
        OTHER = 'other', 'Other'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.TEACHING
    )
    
    # Audio
    audio_file = models.FileField(
        upload_to='podcasts/audio/',
        validators=[FileExtensionValidator(['mp3', 'wav', 'm4a', 'ogg'])]
    )
    duration = models.DurationField(
        null=True,
        blank=True,
        help_text="Duration in HH:MM:SS format"
    )
    
    # Visual
    thumbnail = models.ImageField(upload_to='podcasts/thumbnails/', null=True, blank=True)
    
    # Metadata
    host = models.CharField(max_length=255, blank=True)
    guests = models.TextField(blank=True, help_text="Comma-separated list of guests")
    episode_number = models.IntegerField(null=True, blank=True)
    season = models.IntegerField(null=True, blank=True)
    
    # Engagement
    play_count = models.IntegerField(default=0, editable=False)
    
    # Status
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-published_at', '-created_at']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['is_published']),
            models.Index(fields=['published_at']),
        ]
        verbose_name = 'Podcast'
        verbose_name_plural = 'Podcasts'
    
    def __str__(self):
        if self.episode_number:
            return f"Ep {self.episode_number}: {self.title}"
        return self.title
    
    def publish(self):
        """Publish the podcast"""
        self.is_published = True
        self.published_at = timezone.now()
        self.save()
    
    def increment_play_count(self):
        """Increment play count"""
        self.play_count += 1
        self.save(update_fields=['play_count'])


class Article(models.Model):
    """General articles and announcements"""
    
    class Category(models.TextChoices):
        ANNOUNCEMENT = 'announcement', 'Announcement'
        TESTIMONY = 'testimony', 'Testimony'
        EDUCATION = 'education', 'Education'
        INSPIRATION = 'inspiration', 'Inspiration'
        NEWS = 'news', 'News'
        EVENT = 'event', 'Event'
        OTHER = 'other', 'Other'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    excerpt = models.TextField(max_length=500, help_text="Short summary for previews")
    content = models.TextField()
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.ANNOUNCEMENT
    )
    
    # Visual
    featured_image = models.ImageField(upload_to='articles/', null=True, blank=True)
    
    # Metadata
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='authored_articles'
    )
    tags = models.CharField(
        max_length=500,
        blank=True,
        help_text="Comma-separated tags"
    )
    
    # Engagement
    view_count = models.IntegerField(default=0, editable=False)
    is_featured = models.BooleanField(default=False)
    
    # Status
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-published_at', '-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['category']),
            models.Index(fields=['is_published']),
            models.Index(fields=['is_featured']),
        ]
        verbose_name = 'Article'
        verbose_name_plural = 'Articles'
    
    def __str__(self):
        return self.title
    
    def publish(self):
        """Publish the article"""
        self.is_published = True
        self.published_at = timezone.now()
        self.save()
    
    def increment_view_count(self):
        """Increment view count"""
        self.view_count += 1
        self.save(update_fields=['view_count'])
