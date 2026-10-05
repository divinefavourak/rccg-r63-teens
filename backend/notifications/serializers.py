"""Serializers for the notification inbox, preferences and push subscriptions."""
from rest_framework import serializers

from .models import Notification, NotificationPreference, PushDevice, PushSubscription


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'rung', 'title', 'body', 'deep_link',
            'data', 'is_read', 'read_at', 'pushed_at', 'created_at',
        ]
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """
    The settings screen.

    `active_rungs` is exposed read-only so the client can *show* the teen exactly
    which reminders will fire, rather than re-deriving the preset∩toggle rule in
    JavaScript and eventually disagreeing with the server about it.

    `consecutive_ignored_days` and `last_stepped_down_at` are read-only: the
    step-down is something the system does *to* the settings and reports honestly,
    not a field a client may edit.
    """

    active_rungs = serializers.SerializerMethodField()

    class Meta:
        model = NotificationPreference
        fields = [
            'intensity',
            'habit_reminders_enabled', 'event_notifications_enabled',
            'announcements_enabled', 'system_notifications_enabled',
            'morning_rung_enabled', 'afternoon_rung_enabled',
            'evening_rung_enabled', 'final_rung_enabled',
            'morning_at', 'afternoon_at', 'evening_at', 'final_at',
            'quiet_hours_start', 'quiet_hours_end', 'timezone',
            'active_rungs', 'last_stepped_down_at',
        ]
        read_only_fields = ['active_rungs', 'last_stepped_down_at']

    def get_active_rungs(self, preference):
        return preference.active_rungs()

    def validate_timezone(self, value):
        import zoneinfo
        try:
            zoneinfo.ZoneInfo(value)
        except Exception:
            raise serializers.ValidationError(f'{value!r} is not a known timezone.')
        return value


class PushSubscriptionSerializer(serializers.ModelSerializer):
    """
    What the browser's PushManager hands back.

    `user` is never accepted from the client — ownership comes from the request,
    or one teen could register a push endpoint against another's account.
    """

    class Meta:
        model = PushSubscription
        fields = ['id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'created_at']
        read_only_fields = ['id', 'created_at']


class PushDeviceSerializer(serializers.ModelSerializer):
    """
    A phone's push token, as the native app reports it.

    `token` drops the model's uniqueness validator on purpose: the app reports
    the same token on every launch, and the view upserts it through
    `services.register_device` rather than creating a row each time.
    """

    token = serializers.CharField(max_length=255)

    class Meta:
        model = PushDevice
        fields = ['id', 'token', 'platform', 'device_name', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_token(self, value):
        value = value.strip()
        # Expo's tokens have exactly this shape. Refusing anything else keeps a
        # stray string from ever being posted to the push service.
        if not (value.startswith(('ExponentPushToken[', 'ExpoPushToken['))
                and value.endswith(']')):
            raise serializers.ValidationError('This is not an Expo push token.')
        return value


class MarkReadSerializer(serializers.Serializer):
    """Empty `ids` marks everything read — the "clear inbox" gesture."""

    ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True,
    )
