"""Serializers for the Progress read API."""
from rest_framework import serializers

from . import services
from .models import SpiritualAction, StreakPause, StreakState


class StreakStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StreakState
        fields = ['current_length', 'longest_length', 'last_active_on', 'started_on']


class SpiritualActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpiritualAction
        fields = ['id', 'action_type', 'occurred_on', 'occurred_at', 'source_reference']


class ProgressSummarySerializer(serializers.Serializer):
    """
    A read-only, composed view of a user's progress. Streak and Grace figures
    come from the Progress domain; `chapters_read`/`books_read` are composed from
    the Bible domain's public service in the view — Progress never reads Bible
    tables itself.
    """
    current_streak = serializers.IntegerField()
    longest_streak = serializers.IntegerField()
    last_active_on = serializers.DateField(allow_null=True)
    grace_balance = serializers.IntegerField()
    devotionals_completed = serializers.IntegerField()
    chapters_read = serializers.IntegerField()
    books_read = serializers.IntegerField()


class StreakPauseSerializer(serializers.ModelSerializer):
    class Meta:
        model = StreakPause
        fields = ['id', 'start_on', 'end_on', 'created_at']


class CreatePauseSerializer(serializers.Serializer):
    """Input for declaring a pause: a start date and a length in days."""
    start_on = serializers.DateField()
    days = serializers.IntegerField(min_value=1, max_value=services.MAX_PAUSE_DAYS)
