"""
Content models for the RCCG R63 Teens platform.
Includes Devotionals (Teenage Open Heaven) and Manuals (weekly teaching material).
"""
from django.db import models
from django.conf import settings
from django.utils.text import slugify
from common.models import (
    TimestampMixin, UUIDMixin, PublishableMixin,
    SlugMixin, ViewableMixin
)
import uuid


class Devotional(UUIDMixin, TimestampMixin, PublishableMixin, ViewableMixin):
    """
    Daily devotional entry (Teenage Open Heaven).
    One devotional per day, date-based identification.
    """
    
    # Date-based identification (one per day)
    date = models.DateField(unique=True, db_index=True)
    
    # THEME
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, unique=True, db_index=True)
    
    # MEMORISE (Text + Reference)
    memory_verse_passage = models.CharField(max_length=255, blank=True)  # e.g., "John 3:16"
    memory_verse_content = models.TextField(blank=True)  # The actual verse text
    
    # BIBLE READING (Reference + Full Text)
    bible_text_passage = models.CharField(max_length=255, blank=True)  # e.g., "Psalm 139:14-15"
    bible_text_content = models.TextField(blank=True)  # The full text of the reading
    
    # MESSAGE
    content = models.TextField()  # Main devotional content (Markdown/rich text)
    
    # KEY POINT
    key_point = models.CharField(max_length=500, blank=True)
    
    # BIBLE IN ONE YEAR
    bible_in_one_year = models.CharField(max_length=255, blank=True) # e.g. "EXODUS 24-27"
    
    # AUTHOR
    author = models.CharField(max_length=255, default='Pastor E.A. Adeboye')
    
    # HYMN (Title + Lyrics)
    # Changed to TextField to support full lyrics with line breaks
    hymn = models.TextField(blank=True)
    
    # Legacy Fields (kept for backward compatibility or fallbacks)
    anchor_scripture = models.CharField(max_length=255, blank=True)
    scripture_text = models.TextField(blank=True)
    
    # Engagement elements
    prayer = models.TextField(blank=True)
    confession = models.TextField(blank=True)
    action_point = models.TextField(blank=True)
    
    # Resources
    cover_image = models.ImageField(upload_to='devotionals/', null=True, blank=True)
    audio_url = models.URLField(blank=True)
    audio_file = models.FileField(upload_to='devotional_audio/', blank=True)
    audio_duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    # Analytics
    share_count = models.PositiveIntegerField(default=0)
    read_count = models.PositiveIntegerField(default=0)
    likes_count = models.PositiveIntegerField(default=0)
    
    # Tags for categorization
    tags = models.JSONField(default=list, blank=True)
    
    class Meta:
        ordering = ['-date']
        verbose_name = 'Devotional'
        verbose_name_plural = 'Devotionals'
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['status', 'date']),
            models.Index(fields=['slug']),
        ]
    
    def __str__(self):
        return f"{self.date} - {self.title}"
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.date}-{self.title}")[:300]
        super().save(*args, **kwargs)
    
    @property
    def has_audio(self):
        return bool(self.audio_url or self.audio_file)
    
    def increment_read_count(self):
        """Thread-safe read count increment."""
        Devotional.objects.filter(pk=self.pk).update(
            read_count=models.F('read_count') + 1
        )


class ManualSeries(UUIDMixin, TimestampMixin, PublishableMixin):
    """
    A series/collection of manuals (e.g., Q1 2026 Sunday School).
    Groups weekly manuals together.
    """
    
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, unique=True, db_index=True)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to='manual_series/', null=True, blank=True)
    
    # Validity period
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Ordering
    order = models.PositiveIntegerField(default=0)
    
    # Target audience
    target_age_group = models.CharField(max_length=50, blank=True)
    
    class Meta:
        ordering = ['-start_date']
        verbose_name = 'Manual Series'
        verbose_name_plural = 'Manual Series'
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:300]
        super().save(*args, **kwargs)
    
    @property
    def manual_count(self):
        return self.manuals.count()


class Manual(UUIDMixin, TimestampMixin, PublishableMixin, ViewableMixin):
    """
    Weekly Sunday-to-Sunday teaching manual for RCCG Teenagers Church.
    """
    
    class TargetAgeGroup(models.TextChoices):
        ALL = 'all', 'All Ages'
        PRE_TEEN = 'pre_teen', 'Pre-Teens (8-12)'
        TEEN = 'teen', 'Teens (13-17)'
        YOUNG_ADULT = 'young_adult', 'Young Adults (18-19)'
    
    # Series relationship
    series = models.ForeignKey(
        ManualSeries,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manuals'
    )
    
    # Week identification
    week_number = models.PositiveIntegerField()
    week_start_date = models.DateField(db_index=True)  # Sunday
    week_end_date = models.DateField()  # Following Saturday
    
    # Content identification
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, unique=True, db_index=True)
    theme = models.CharField(max_length=255, blank=True)  # e.g., "Faith & Trust"
    
    # Memory verse
    memory_verse = models.CharField(max_length=255)  # e.g., "Hebrews 11:1"
    memory_verse_text = models.TextField()
    
    # Teaching content
    lesson_objectives = models.JSONField(default=list)  # List of learning objectives
    lesson_content = models.TextField()  # Main lesson content (Markdown/rich text)
    key_takeaways = models.JSONField(default=list, blank=True)  # Bullet points
    
    # Application
    discussion_questions = models.JSONField(default=list)
    practical_application = models.TextField(blank=True)
    activity_suggestions = models.JSONField(default=list, blank=True)
    
    # Opening/Closing
    opening_prayer_points = models.JSONField(default=list, blank=True)
    closing_prayer = models.TextField(blank=True)
    
    # Resources
    cover_image = models.ImageField(upload_to='manuals/', null=True, blank=True)
    pdf_url = models.URLField(blank=True)
    pdf_file = models.FileField(upload_to='manual_pdfs/', blank=True)
    additional_resources = models.JSONField(default=list, blank=True)  # Links to videos, etc.
    
    # Target age group
    target_age_group = models.CharField(
        max_length=50,
        choices=TargetAgeGroup.choices,
        default=TargetAgeGroup.ALL
    )
    
    # Analytics
    download_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['-week_start_date']
        unique_together = [['series', 'week_number']]
        verbose_name = 'Manual'
        verbose_name_plural = 'Manuals'
        indexes = [
            models.Index(fields=['week_start_date']),
            models.Index(fields=['status', 'week_start_date']),
            models.Index(fields=['series', 'week_number']),
        ]
    
    def __str__(self):
        return f"Week {self.week_number}: {self.title}"
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.week_start_date}-{self.title}")[:300]
        super().save(*args, **kwargs)
    
    @property
    def has_pdf(self):
        return bool(self.pdf_url or self.pdf_file)
    
    def increment_download_count(self):
        """Thread-safe download count increment."""
        Manual.objects.filter(pk=self.pk).update(
            download_count=models.F('download_count') + 1
        )


class Article(UUIDMixin, TimestampMixin, PublishableMixin, ViewableMixin):
    """
    General articles and blog posts for teens.
    """
    
    class Category(models.TextChoices):
        FAITH = 'faith', 'Faith & Spirituality'
        RELATIONSHIPS = 'relationships', 'Relationships'
        EDUCATION = 'education', 'Education & Career'
        HEALTH = 'health', 'Health & Wellness'
        LIFESTYLE = 'lifestyle', 'Lifestyle'
        TESTIMONIES = 'testimonies', 'Testimonies'
        NEWS = 'news', 'News & Updates'
    
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=300, unique=True, db_index=True)
    excerpt = models.CharField(max_length=500, blank=True)  # Short summary
    
    content = models.TextField()  # Markdown/rich text
    
    # Categorization
    category = models.CharField(max_length=20, choices=Category.choices)
    tags = models.JSONField(default=list, blank=True)
    
    # Author
    author_name = models.CharField(max_length=255)
    author_bio = models.TextField(blank=True, max_length=500)
    author_image = models.ImageField(upload_to='article_authors/', null=True, blank=True)
    
    # Media
    cover_image = models.ImageField(upload_to='articles/')
    featured_image_caption = models.CharField(max_length=255, blank=True)
    
    # Analytics
    share_count = models.PositiveIntegerField(default=0)
    read_time_minutes = models.PositiveIntegerField(default=5)
    
    # Featured
    is_featured = models.BooleanField(default=False, db_index=True)
    is_pinned = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-published_at', '-created_at']
        verbose_name = 'Article'
        verbose_name_plural = 'Articles'
        indexes = [
            models.Index(fields=['status', 'published_at']),
            models.Index(fields=['category']),
            models.Index(fields=['is_featured', 'status']),
        ]
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:300]

        # Calculate read time (approx 200 words per minute)
        if self.content:
            word_count = len(self.content.split())
            self.read_time_minutes = max(1, word_count // 200)

        super().save(*args, **kwargs)


class UserReadLog(models.Model):
    """
    Lightweight per-user devotional read tracking.
    Works for ALL authenticated users regardless of whether they have a TeenProfile.
    The unique_together constraint prevents double-counting atomically.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='devotional_reads',
    )
    devotional = models.ForeignKey(
        Devotional,
        on_delete=models.CASCADE,
        related_name='user_reads',
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'devotional']]
        ordering = ['-read_at']

    def __str__(self):
        return f'{self.user.username} read {self.devotional}'


class UserLikeLog(models.Model):
    """Per-user like/unlike tracking for devotionals. No TeenProfile required."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='devotional_likes',
    )
    devotional = models.ForeignKey(
        Devotional,
        on_delete=models.CASCADE,
        related_name='user_likes',
    )
    liked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'devotional']]

    def __str__(self):
        return f'{self.user.username} liked {self.devotional}'
