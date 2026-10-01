"""
Serializers for the content app (devotionals, manuals, articles).
"""
from rest_framework import serializers
from .models import (
    Article, Devotional, DiscussionQuestion, Manual, ManualSeries, MemoryVerse,
    ScriptureReference,
)


# =====================
# SCRIPTURE SERIALIZERS
# =====================

class MemoryVerseSerializer(serializers.ModelSerializer):
    """
    The Verse of the Day payload.

    `text` resolves the override-or-Scripture rule in one place, and
    `attribution` carries the copyright line licensed translations require
    (`docs/08-bible-experience.md` §11).
    """

    text = serializers.CharField(read_only=True)
    devotional_date = serializers.DateField(source='devotional.date', read_only=True)
    # Method fields, not `source='translation.code'`: a memory verse may have no
    # translation linked yet (Scripture is not imported), and a dotted source
    # through a null FK makes DRF drop the key entirely rather than emit null.
    translation_code = serializers.SerializerMethodField()
    attribution = serializers.SerializerMethodField()

    class Meta:
        model = MemoryVerse
        fields = [
            'id', 'devotional', 'devotional_date', 'is_primary', 'reference_display',
            'text', 'text_override', 'translation', 'translation_code', 'attribution',
            'start_verse', 'end_verse', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_translation_code(self, obj):
        return obj.translation.code if obj.translation_id else None

    def get_attribution(self, obj):
        return obj.translation.attribution if obj.translation_id else None

    def validate(self, attrs):
        """
        Reject a second primary verse with a 400.

        The database already forbids it (partial unique index), but without this
        the client would see a 500 IntegrityError instead of a clear message.
        """
        is_primary = attrs.get(
            'is_primary', self.instance.is_primary if self.instance else True
        )
        devotional = attrs.get(
            'devotional', self.instance.devotional if self.instance else None
        )
        if is_primary and devotional is not None:
            clashing = MemoryVerse.objects.filter(devotional=devotional, is_primary=True)
            if self.instance is not None:
                clashing = clashing.exclude(pk=self.instance.pk)
            if clashing.exists():
                raise serializers.ValidationError(
                    'This devotional already has a primary memory verse — '
                    'it is the Verse of the Day, and there can be only one.'
                )
        return attrs


class ScriptureReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScriptureReference
        fields = [
            'id', 'devotional', 'kind', 'reference_display', 'book_osis',
            'chapter_number', 'start_verse_number', 'end_verse_number', 'order',
        ]


class DiscussionQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscussionQuestion
        fields = ['id', 'devotional', 'text', 'order']


# =====================
# DEVOTIONAL SERIALIZERS
# =====================

class DevotionalListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing devotionals."""
    
    has_audio = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Devotional
        fields = [
            'id',
            'date',
            'title',
            'slug',
            'title',
            'slug',
            'memory_verse_passage',
            'memory_verse_content',
            'cover_image',
            'has_audio',
            'view_count',
            'status',
            'published_at',
        ]


class DevotionalDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing a devotional."""

    has_audio = serializers.BooleanField(read_only=True)

    # The structured, Bible-linked layer. `memory_verse` is the primary one —
    # the Verse of the Day. The legacy `memory_verse_passage`/`_content` strings
    # below remain for the existing frontend contract.
    memory_verse = serializers.SerializerMethodField()
    scripture_references = ScriptureReferenceSerializer(many=True, read_only=True)
    discussion_questions = DiscussionQuestionSerializer(many=True, read_only=True)

    def get_memory_verse(self, obj):
        from .services.daily import primary_memory_verse
        verse = primary_memory_verse(obj)
        return MemoryVerseSerializer(verse).data if verse else None

    class Meta:
        model = Devotional
        fields = [
            'id',
            'date',
            'title',
            'slug',

            # Structured Scripture layer
            'memory_verse',
            'scripture_references',
            'discussion_questions',

            # Scripture
            'memory_verse_passage',
            'memory_verse_content',
            'bible_text_passage',
            'bible_text_content',
            'bible_in_one_year',

            # Legacy
            'anchor_scripture',
            'scripture_text',
            
            # Content
            'content',
            'key_point',
            'prayer',
            'confession',
            'action_point',
            'hymn',
            
            # Meta
            'author',
            'cover_image',
            
            # Audio
            'audio_url',
            'audio_file',
            'audio_duration_seconds',
            'has_audio',
            
            # Stats
            'view_count',
            'share_count',
            'read_count',
            'tags',
            
            # Status
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]


class DevotionalCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating devotionals (admin only)."""
    
    class Meta:
        model = Devotional
        fields = [
            # `title` was missing from this list. DRF silently ignores fields it
            # does not declare and Model.save() does not run full_clean(), so a
            # required CharField simply saved as '' — every devotional created or
            # edited through the API got an empty title, including the ones the
            # admin panel was faithfully submitting one for.
            'title',
            'date',
            'slug',
            'memory_verse_passage',
            'memory_verse_content',
            'bible_text_passage',
            'bible_text_content',
            'bible_in_one_year',

            # Legacy
            'anchor_scripture',
            'scripture_text',
            'content',
            'key_point',
            'prayer',
            'confession',
            'action_point',
            'hymn',
            'author',
            'cover_image',
            'audio_url',
            'audio_file',
            'audio_duration_seconds',
            'tags',
            'status',
            'published_at',
            'scheduled_for',
        ]
        extra_kwargs = {
            'slug': {'read_only': True},
            'anchor_scripture': {'required': False, 'allow_blank': True},
        }


# =====================
# MANUAL SERIALIZERS
# =====================

class ManualSeriesListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing manual series."""
    
    manual_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = ManualSeries
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'cover_image',
            'start_date',
            'end_date',
            'target_age_group',
            'manual_count',
            'status',
        ]


class ManualSeriesDetailSerializer(serializers.ModelSerializer):
    """Full serializer for a manual series."""
    
    manual_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = ManualSeries
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'cover_image',
            'start_date',
            'end_date',
            'order',
            'target_age_group',
            'manual_count',
            'status',
            'created_at',
            'updated_at',
        ]


class ManualListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing manuals."""
    
    series_title = serializers.CharField(source='series.title', read_only=True)
    has_pdf = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Manual
        fields = [
            'id',
            'series',
            'series_title',
            'week_number',
            'week_start_date',
            'week_end_date',
            'title',
            'slug',
            'theme',
            'cover_image',
            'target_age_group',
            'has_pdf',
            'view_count',
            'status',
        ]


class ManualDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing a manual."""
    
    series_detail = ManualSeriesListSerializer(source='series', read_only=True)
    has_pdf = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Manual
        fields = [
            'id',
            'series',
            'series_detail',
            
            # Week info
            'week_number',
            'week_start_date',
            'week_end_date',
            
            # Content
            'title',
            'slug',
            'theme',
            'memory_verse',
            'memory_verse_text',
            'lesson_objectives',
            'lesson_content',
            'key_takeaways',
            'discussion_questions',
            'practical_application',
            'activity_suggestions',
            'opening_prayer_points',
            'closing_prayer',
            
            # Resources
            'cover_image',
            'pdf_url',
            'pdf_file',
            'additional_resources',
            'has_pdf',
            
            # Meta
            'target_age_group',
            'view_count',
            'download_count',
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]


class ManualCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating manuals (admin only)."""
    
    class Meta:
        model = Manual
        fields = [
            'series',
            'week_number',
            'week_start_date',
            'week_end_date',
            'title',
            'slug',
            'theme',
            'memory_verse',
            'memory_verse_text',
            'lesson_objectives',
            'lesson_content',
            'key_takeaways',
            'discussion_questions',
            'practical_application',
            'activity_suggestions',
            'opening_prayer_points',
            'closing_prayer',
            'cover_image',
            'pdf_url',
            'pdf_file',
            'additional_resources',
            'target_age_group',
            'status',
            'published_at',
            'published_at',
            'scheduled_for',
        ]
        extra_kwargs = {
            'slug': {'read_only': True},
        }


# =====================
# ARTICLE SERIALIZERS
# =====================

class ArticleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing articles."""
    
    class Meta:
        model = Article
        fields = [
            'id',
            'title',
            'slug',
            'excerpt',
            'category',
            'author_name',
            'cover_image',
            'read_time_minutes',
            'view_count',
            'is_featured',
            'published_at',
        ]


class ArticleDetailSerializer(serializers.ModelSerializer):
    """Full serializer for viewing an article."""

    class Meta:
        model = Article
        fields = [
            'id',
            'title',
            'slug',
            'excerpt',
            'content',
            'category',
            'tags',
            'author_name',
            'author_bio',
            'author_image',
            'cover_image',
            'featured_image_caption',
            'read_time_minutes',
            'view_count',
            'share_count',
            'is_featured',
            'is_pinned',
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]


class ManualTeacherDetailSerializer(ManualDetailSerializer):
    """
    Extended manual serializer for teachers, coordinators, and admins.
    Includes teacher edition fields: notes, resources, discussion guide.
    """

    class Meta(ManualDetailSerializer.Meta):
        fields = ManualDetailSerializer.Meta.fields + [
            'has_teacher_edition',
            'teacher_notes',
            'teacher_resources',
            'discussion_guide',
        ]
