"""
Django admin configuration for the content app.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Article, Devotional, DiscussionQuestion, Manual, ManualSeries, MemoryVerse,
    ScriptureReference,
)


class MemoryVerseInline(admin.TabularInline):
    """
    The day's verse, edited on the devotional itself.

    Exactly one row may have `is_primary` ticked — a partial unique index makes a
    second primary impossible at the database level. That primary verse *is* the
    Verse of the Day.
    """

    model = MemoryVerse
    extra = 1
    fields = ('is_primary', 'reference_display', 'translation', 'text_override',
              'start_verse', 'end_verse')
    raw_id_fields = ('translation', 'start_verse', 'end_verse')


class ScriptureReferenceInline(admin.TabularInline):
    model = ScriptureReference
    extra = 0
    fields = ('kind', 'reference_display', 'book_osis', 'chapter_number',
              'start_verse_number', 'end_verse_number', 'order')
    ordering = ('order',)


class DiscussionQuestionInline(admin.TabularInline):
    model = DiscussionQuestion
    extra = 0
    fields = ('order', 'text')
    ordering = ('order',)


@admin.register(Devotional)
class DevotionalAdmin(admin.ModelAdmin):
    """Admin for Devotional model."""

    inlines = [MemoryVerseInline, ScriptureReferenceInline, DiscussionQuestionInline]

    list_display = [
        'date',
        'title',
        'primary_memory_verse',
        'status',
        'view_count',
        'read_count',
        'has_audio_icon',
        'published_at',
    ]
    list_filter = [
        'status',
        'date',
        'created_at',
    ]
    search_fields = [
        'title',
        'content',
        'anchor_scripture',
        'key_point',
    ]
    date_hierarchy = 'date'
    ordering = ['-date']
    
    readonly_fields = [
        'id', 'slug', 'view_count', 'share_count', 'read_count',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Identification', {
            'fields': ('date', 'title', 'slug')
        }),
        ('Memory Verse', {
            'fields': ('memory_verse_passage', 'memory_verse_content')
        }),
        ('Bible Reading', {
            'fields': ('bible_text_passage', 'bible_text_content', 'bible_in_one_year')
        }),
        ('Content', {
            'fields': ('content', 'key_point', 'prayer', 'confession', 'action_point', 'hymn')
        }),
        ('Media', {
            'fields': ('cover_image', 'audio_url', 'audio_file', 'audio_duration_seconds')
        }),
        ('Metadata', {
            'fields': ('author', 'tags')
        }),
        ('Publishing', {
            'fields': ('status', 'published_at', 'scheduled_for')
        }),
        ('Stats', {
            'fields': ('view_count', 'share_count', 'read_count'),
            'classes': ('collapse',)
        }),
        ('Legacy / Debug', {
             'fields': ('anchor_scripture', 'scripture_text'),
             'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        # `primary_memory_verse` reads the prefetched rows — without this the
        # changelist issues one extra query per devotional.
        return super().get_queryset(request).prefetch_related('memory_verses')

    @admin.display(description='Verse of the Day')
    def primary_memory_verse(self, obj):
        from .services.daily import primary_memory_verse
        verse = primary_memory_verse(obj)
        if verse:
            return verse.reference_display
        return format_html('<span style="color: #b00;">— missing —</span>')

    def has_audio_icon(self, obj):
        if obj.has_audio:
            return format_html('<span style="color: green;">✓</span>')
        return format_html('<span style="color: #ccc;">—</span>')
    has_audio_icon.short_description = 'Audio'

    actions = ['publish_selected', 'archive_selected']

    @admin.action(description='Publish selected devotionals')
    def publish_selected(self, request, queryset):
        """
        Publish, enforcing the memory-verse gate.

        A devotional without a primary memory verse cannot be published — that
        verse is the Verse of the Day, and publishing without one would leave the
        whole day without a verse (docs/07-feature-specifications.md §5).
        """
        from django.contrib import messages
        from django.core.exceptions import ValidationError
        from .services.daily import validate_publishable

        publishable, blocked = [], []
        for devotional in queryset.prefetch_related('memory_verses'):
            try:
                validate_publishable(devotional)
            except ValidationError:
                blocked.append(devotional)
            else:
                publishable.append(devotional)

        # `publish()` per row, not `queryset.update(status='published')`: the bulk
        # update skips the model and leaves `published_at` null, so anything that
        # orders or filters by publication time silently misses these rows.
        for devotional in publishable:
            devotional.publish()

        if publishable:
            self.message_user(
                request, f'Published {len(publishable)} devotional(s).', messages.SUCCESS
            )
        if blocked:
            names = ', '.join(str(d.date) for d in blocked)
            self.message_user(
                request,
                f'Skipped {len(blocked)} devotional(s) with no primary memory verse: {names}.',
                messages.WARNING,
            )
    
    @admin.action(description='Archive selected devotionals')
    def archive_selected(self, request, queryset):
        queryset.update(status='archived')


@admin.register(ManualSeries)
class ManualSeriesAdmin(admin.ModelAdmin):
    """Admin for ManualSeries model."""
    
    list_display = [
        'title',
        'start_date',
        'end_date',
        'manual_count',
        'status',
    ]
    list_filter = ['status', 'start_date']
    search_fields = ['title', 'description']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    def manual_count(self, obj):
        return obj.manuals.count()
    manual_count.short_description = 'Manuals'


@admin.register(Manual)
class ManualAdmin(admin.ModelAdmin):
    """Admin for Manual model."""
    
    list_display = [
        'week_number',
        'title',
        'series',
        'week_start_date',
        'target_age_group',
        'status',
        'view_count',
        'download_count',
    ]
    list_filter = [
        'status',
        'series',
        'target_age_group',
        'week_start_date',
    ]
    search_fields = ['title', 'theme', 'memory_verse']
    date_hierarchy = 'week_start_date'
    ordering = ['-week_start_date']
    
    readonly_fields = [
        'id', 'slug', 'view_count', 'download_count',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Week Info', {
            'fields': ('series', 'week_number', 'week_start_date', 'week_end_date')
        }),
        ('Content', {
            'fields': ('title', 'slug', 'theme', 'memory_verse', 'memory_verse_text')
        }),
        ('Lesson Content', {
            'fields': (
                'lesson_objectives', 'lesson_content', 'key_takeaways',
                'discussion_questions', 'practical_application', 'activity_suggestions'
            )
        }),
        ('Prayer', {
            'fields': ('opening_prayer_points', 'closing_prayer'),
            'classes': ('collapse',)
        }),
        ('Resources', {
            'fields': ('cover_image', 'pdf_url', 'pdf_file', 'additional_resources')
        }),
        ('Publishing', {
            'fields': ('target_age_group', 'status', 'published_at', 'scheduled_for')
        }),
        ('Stats', {
            'fields': ('view_count', 'download_count'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    """Admin for Article model."""
    
    list_display = [
        'title',
        'category',
        'author_name',
        'is_featured',
        'status',
        'view_count',
        'published_at',
    ]
    list_filter = ['status', 'category', 'is_featured', 'is_pinned']
    search_fields = ['title', 'content', 'excerpt', 'author_name']
    ordering = ['-published_at']
    
    readonly_fields = [
        'id', 'slug', 'view_count', 'share_count', 'read_time_minutes',
        'created_at', 'updated_at'
    ]
    
    fieldsets = (
        ('Content', {
            'fields': ('title', 'slug', 'excerpt', 'content')
        }),
        ('Categorization', {
            'fields': ('category', 'tags')
        }),
        ('Author', {
            'fields': ('author_name', 'author_bio', 'author_image')
        }),
        ('Media', {
            'fields': ('cover_image', 'featured_image_caption')
        }),
        ('Publishing', {
            'fields': ('status', 'is_featured', 'is_pinned', 'published_at', 'scheduled_for')
        }),
        ('Stats', {
            'fields': ('view_count', 'share_count', 'read_time_minutes'),
            'classes': ('collapse',)
        }),
    )


@admin.register(MemoryVerse)
class MemoryVerseAdmin(admin.ModelAdmin):
    """
    Standalone memory-verse admin. Most editing happens inline on the devotional;
    this view exists to audit the pipeline — filter on `is_primary` to spot days
    whose Verse of the Day is missing or duplicated.
    """

    list_display = ('reference_display', 'devotional_date', 'is_primary',
                    'translation', 'is_linked')
    list_filter = ('is_primary', 'translation')
    search_fields = ('reference_display', 'text_override', 'devotional__title')
    list_select_related = ('devotional', 'translation')
    raw_id_fields = ('devotional', 'translation', 'start_verse', 'end_verse')
    ordering = ('-devotional__date',)

    @admin.display(description='Date', ordering='devotional__date')
    def devotional_date(self, obj):
        return obj.devotional.date

    @admin.display(description='Linked to Scripture', boolean=True)
    def is_linked(self, obj):
        return obj.start_verse_id is not None


@admin.register(ScriptureReference)
class ScriptureReferenceAdmin(admin.ModelAdmin):
    list_display = ('reference_display', 'kind', 'devotional', 'book_osis',
                    'chapter_number', 'order')
    list_filter = ('kind', 'book_osis')
    search_fields = ('reference_display', 'book_osis', 'devotional__title')
    list_select_related = ('devotional',)
    raw_id_fields = ('devotional',)
    ordering = ('order',)


@admin.register(DiscussionQuestion)
class DiscussionQuestionAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'devotional', 'order')
    search_fields = ('text', 'devotional__title')
    list_select_related = ('devotional',)
    raw_id_fields = ('devotional',)
    ordering = ('order',)
