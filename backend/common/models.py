"""
Common base models and mixins for the RCCG R63 Teens platform.
"""
from django.conf import settings
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


class AppendOnlyError(Exception):
    """Raised when code tries to modify an append-only record."""


class _AppendOnlyQuerySet(models.QuerySet):
    def update(self, *args, **kwargs):
        raise AppendOnlyError(f'{self.model.__name__} is append-only; rows cannot be updated.')

    def bulk_update(self, *args, **kwargs):
        raise AppendOnlyError(f'{self.model.__name__} is append-only; rows cannot be updated.')

    def bulk_create(self, objs, *args, update_conflicts=False, **kwargs):
        # Plain inserts are the point of an append-only log; only the upsert form
        # (`update_conflicts=True`) would rewrite existing rows behind `save()`.
        if update_conflicts:
            raise AppendOnlyError(
                f'{self.model.__name__} is append-only; upserts are not allowed.'
            )
        return super().bulk_create(objs, *args, update_conflicts=update_conflicts, **kwargs)


class AppendOnlyModel(models.Model):
    """
    A model whose rows may be inserted and (for account erasure) deleted, but
    never edited — enforcing at the persistence boundary the immutability that an
    event log only *claims* in its docstring. `save()` refuses to rewrite an
    existing row, and the manager refuses `update()`/`bulk_update()`; `delete()`
    is intentionally left open so an account cascade can erase a user's history.
    """

    objects = _AppendOnlyQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise AppendOnlyError(
                f'{type(self).__name__} is append-only; existing rows cannot be modified.'
            )
        super().save(*args, **kwargs)


class PublishableMixin(models.Model):
    """Adds publishing status and scheduling for content models."""

    class Status(models.TextChoices):
        # The documented pipeline (`docs/07-feature-specifications.md` §5):
        # draft -> in-review -> approved -> scheduled -> published -> archived.
        # IN_REVIEW and APPROVED are the two states the review gate needs; models
        # that do not run a review (events, media) simply never enter them.
        DRAFT = 'draft', 'Draft'
        IN_REVIEW = 'in_review', 'In review'
        APPROVED = 'approved', 'Approved'
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


class ReviewableMixin(models.Model):
    """
    Authorship and review provenance for content that passes a two-person gate.

    `docs/07-feature-specifications.md` §5 requires a "two-person rule for
    region-wide+ publishing". Enforcing it needs two facts the publishing status
    alone cannot carry: who put the item up for review, and who approved it. The
    rule is then simply that they are not the same person.

    Applied only to the models that actually run a review (the `content` app).
    Events and media publish without one, and giving them dormant reviewer columns
    would imply a workflow that does not exist.

    The transitions live in `content.services.review`, never on the model: a state
    machine spread across `save()` overrides is a state machine nobody can read.
    """

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='%(class)s_submitted',
        help_text='Who submitted this for review.',
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='%(class)s_approved',
        help_text='Who approved this. Never the same person as submitted_by.',
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Why it was sent back, shown to the author. Cleared on re-submission.
    review_notes = models.TextField(blank=True)

    class Meta:
        abstract = True


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
