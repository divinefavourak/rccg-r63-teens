"""
Common base models and mixins for the RCCG R63 Teens platform.
"""
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
import uuid


class TimestampMixin(models.Model):
    """Adds created_at and updated_at timestamps to any model."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDMixin(models.Model):
    """Provides UUID as primary key."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class PublishableMixin(models.Model):
    """Adds publishing status and scheduling for content models."""
    
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SCHEDULED = 'scheduled', 'Scheduled'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )
    published_at = models.DateTimeField(null=True, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def publish(self):
        """Publish the content immediately."""
        self.status = self.Status.PUBLISHED
        self.published_at = timezone.now()
        self.save()

    def schedule(self, publish_date):
        """Schedule the content for future publishing."""
        self.status = self.Status.SCHEDULED
        self.scheduled_for = publish_date
        self.save()

    def archive(self):
        """Archive the content."""
        self.status = self.Status.ARCHIVED
        self.save()

    @property
    def is_published(self):
        return self.status == self.Status.PUBLISHED

    @property
    def is_draft(self):
        return self.status == self.Status.DRAFT


class SlugMixin(models.Model):
    """Adds a slug field with auto-generation support."""
    slug = models.SlugField(max_length=300, unique=True, db_index=True)

    class Meta:
        abstract = True

    def generate_slug(self, source_field='title'):
        """Generate slug from a source field."""
        source = getattr(self, source_field, '')
        base_slug = slugify(source)[:250]
        slug = base_slug
        counter = 1
        
        while self.__class__.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        return slug


class OrderableMixin(models.Model):
    """Adds ordering capability to models."""
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        abstract = True
        ordering = ['order']


class ViewableMixin(models.Model):
    """Adds view count tracking."""
    view_count = models.PositiveIntegerField(default=0)

    class Meta:
        abstract = True

    def increment_view_count(self):
        """Thread-safe view count increment."""
        self.__class__.objects.filter(pk=self.pk).update(
            view_count=models.F('view_count') + 1
        )


class Province(models.TextChoices):
    """Church province choices - shared across apps."""
    LAGOS_PROVINCE_9 = 'lagos_province_9', 'Lagos Province 9'
    LAGOS_PROVINCE_28 = 'lagos_province_28', 'Lagos Province 28'
    LAGOS_PROVINCE_69 = 'lagos_province_69', 'Lagos Province 69'
    LAGOS_PROVINCE_84 = 'lagos_province_84', 'Lagos Province 84'
    LAGOS_PROVINCE_86 = 'lagos_province_86', 'Lagos Province 86'
    LAGOS_PROVINCE_104 = 'lagos_province_104', 'Lagos Province 104'
    REGIONAL_HQ = 'regional_hq', 'Regional Headquarter'
