"""
Serializers for the Today screen.

Every serializer here reuses the owning domain's serializer for its own data
(`MemoryVerseSerializer` for the verse, `ContinueReadingSerializer` for the
position). Today composes; it does not restate other domains' payload shapes,
because two descriptions of the same object drift.
"""
from rest_framework import serializers

from bible.serializers import ContinueReadingSerializer
from content.serializers import MemoryVerseSerializer
from profiles.models import DailyChallenge


class TodayDevotionalSerializer(serializers.Serializer):
    """
    The devotional *card* — not the devotional reader payload.

    Today shows enough to decide to tap: title, excerpt, minutes. The body arrives
    from `/content/devotionals/{id}/` when the teen opens it, which keeps the
    Today response small on a Nigerian mobile connection
    (`docs/03-user-personas.md`).
    """

    # Average adult reading speed. Used to render "3 min read" on the card, which
    # is a promise about effort — the docs' whole argument for the daily habit is
    # that it is small (`docs/01-vision.md`).
    WORDS_PER_MINUTE = 200

    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(read_only=True)
    date = serializers.DateField(read_only=True)
    author = serializers.CharField(read_only=True)
    excerpt = serializers.SerializerMethodField()
    reading_time_minutes = serializers.SerializerMethodField()

    def get_excerpt(self, devotional):
        """The devotional's own key point, falling back to the opening line."""
        if devotional.key_point:
            return devotional.key_point
        body = (devotional.content or '').strip()
        return f'{body[:197]}...' if len(body) > 200 else body

    def get_reading_time_minutes(self, devotional):
        words = len((devotional.content or '').split())
        return max(1, round(words / self.WORDS_PER_MINUTE)) if words else 0


class TodayScriptureReferenceSerializer(serializers.Serializer):
    """
    A Scripture card: an *address*, not resolved text.

    The client turns this into a live link into the reader (`docs/08` §12).
    Resolving the verses here would force a translation choice that belongs to the
    reader, not to Today.
    """

    reference_display = serializers.CharField(read_only=True)
    kind = serializers.CharField(read_only=True)
    book_osis = serializers.CharField(read_only=True)
    chapter_number = serializers.IntegerField(read_only=True)
    start_verse_number = serializers.IntegerField(read_only=True, allow_null=True)
    end_verse_number = serializers.IntegerField(read_only=True, allow_null=True)


class TodayChallengeSerializer(serializers.ModelSerializer):
    """
    The daily challenge card.

    `coins_reward` is deliberately absent from `fields`. The column still exists
    on the legacy model, but coin/point gamification is banned by
    `docs/12-gamification.md` and parked by the backend audit — Today must not
    render it, and listing fields explicitly is what guarantees it cannot leak in.
    """

    class Meta:
        model = DailyChallenge
        fields = ['id', 'title', 'description', 'challenge_date']


class TodayStreakSerializer(serializers.Serializer):
    """
    Streak state for the Today header.

    No "days missed", no deficit, no red: `docs/12-gamification.md` requires warm,
    non-shaming streak copy, so the payload carries only what a teen has *done*
    plus the grace they hold.
    """

    current_length = serializers.IntegerField(read_only=True)
    longest_length = serializers.IntegerField(read_only=True)
    last_active_on = serializers.DateField(read_only=True, allow_null=True)


class TodaySharedSerializer(serializers.Serializer):
    """
    The half of Today that is the same for everyone reading the same day.

    Split out of `TodaySerializer` so it can be cached. Nothing here depends on
    who is asking beyond their age group — the devotional, the Verse of the Day
    and the Scripture cards are one editorial decision per calendar day, and the
    challenge is one decision per day per age group. Rebuilding all of it per
    request was the bulk of the ~12 queries on the product's busiest endpoint.

    `greeting` is deliberately NOT here: it is derived from the hour, so caching
    it for a day would wish everyone good morning at 9pm.
    """

    date = serializers.DateField(read_only=True)

    has_devotional = serializers.BooleanField(read_only=True)
    devotional = TodayDevotionalSerializer(read_only=True, allow_null=True)

    # The Verse of the Day. Same serializer as /content/today/memory-verse/,
    # because it is the same object — "One Day. One Verse. One Message."
    memory_verse = MemoryVerseSerializer(read_only=True, allow_null=True)
    scripture_references = TodayScriptureReferenceSerializer(many=True, read_only=True)

    challenge = TodayChallengeSerializer(read_only=True, allow_null=True)


class TodayPersonalSerializer(serializers.Serializer):
    """The half of Today that belongs to one teen. Never cached."""

    devotional_completed = serializers.BooleanField(read_only=True)
    challenge_completed = serializers.BooleanField(read_only=True)
    streak = TodayStreakSerializer(read_only=True, allow_null=True)
    grace_balance = serializers.IntegerField(read_only=True)
    continue_reading = ContinueReadingSerializer(read_only=True, allow_null=True)


class TodaySerializer(serializers.Serializer):
    """The whole Today screen in one payload.

    Kept as the single description of the response shape. The view assembles the
    same keys from `TodaySharedSerializer` + `TodayPersonalSerializer` so the
    shared half can come from cache; the union of those two plus `greeting` must
    stay exactly equal to the fields below.
    """

    date = serializers.DateField(read_only=True)
    greeting = serializers.CharField(read_only=True)

    has_devotional = serializers.BooleanField(read_only=True)
    devotional = TodayDevotionalSerializer(read_only=True, allow_null=True)
    devotional_completed = serializers.BooleanField(read_only=True)

    memory_verse = MemoryVerseSerializer(read_only=True, allow_null=True)
    scripture_references = TodayScriptureReferenceSerializer(many=True, read_only=True)

    challenge = TodayChallengeSerializer(read_only=True, allow_null=True)
    challenge_completed = serializers.BooleanField(read_only=True)

    streak = TodayStreakSerializer(read_only=True, allow_null=True)
    grace_balance = serializers.IntegerField(read_only=True)
    continue_reading = ContinueReadingSerializer(read_only=True, allow_null=True)
