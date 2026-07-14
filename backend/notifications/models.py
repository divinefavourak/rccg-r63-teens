"""
Notifications — the habit infrastructure, and the restraint that makes it decent.

`docs/07-feature-specifications.md` §10 states the problem exactly: "habits need
cues; teens genuinely want help staying consistent. But push abuse or guilt-copy
would betray the product's character. The design resolves both: remind
persistently, word everything with grace, and stop instantly once the day is
done."

Three models carry that:

* `NotificationPreference` — what a teen has agreed to receive. One row per user,
  created lazily with documented defaults (Standard intensity, quiet hours
  21:30–06:00).
* `Notification` — the in-app inbox. Every push is mirrored here (§10), so the
  inbox is the durable record and push is merely the interruption.
* `PushSubscription` — a browser's PWA push endpoint. A user may have several
  (phone, shared family laptop).

The rules — presets, quiet hours, per-type consent, the announcement cap, the
step-down — are enforced in `notifications/services.py`, not here. §10:
"A central notification service enforces ladder logic, presets, quiet hours, and
step-down — no feature may send around it."
"""
from datetime import time

from django.conf import settings
from django.db import models

from common.models import TimestampMixin, UUIDMixin


class NotificationType(models.TextChoices):
    """
    What a notification is *for*. Consent is per-type (§10), so this is not a
    cosmetic label — it decides whether the teen agreed to be interrupted.
    """
    HABIT_REMINDER = 'habit_reminder', 'Habit reminder'
    EVENT = 'event', 'Event'
    ANNOUNCEMENT = 'announcement', 'Announcement'
    SYSTEM = 'system', 'System'
    # Receipts, tickets, payment confirmations. The teen just did something and is
    # waiting for the result — see `services.QUIET_HOURS_EXEMPT`.
    TRANSACTIONAL = 'transactional', 'Transactional'


class LadderRung(models.TextChoices):
    """
    The four rungs of the daily habit ladder (`docs/12-gamification.md`).

    Stored on the notification so analytics can answer §10's health question:
    "% of days resolved at rung 1 — most days should never need rung 3."
    """
    MORNING = 'morning', 'Morning'
    AFTERNOON = 'afternoon', 'Afternoon'
    EVENING = 'evening', 'Evening'
    FINAL = 'final', 'Final'


class Intensity(models.TextChoices):
    """
    How much help the teen asked for. "The app never chooses for them upward"
    (`docs/12-gamification.md`) — the step-down may lower this, nothing raises it
    but the teen.
    """
    GENTLE = 'gentle', 'Gentle (morning only)'
    STANDARD = 'standard', 'Standard (morning + evening)'
    COMMITTED = 'committed', 'Committed (full ladder)'


# Which rungs each preset fires. Standard is the default.
PRESET_RUNGS = {
    Intensity.GENTLE: [LadderRung.MORNING],
    Intensity.STANDARD: [LadderRung.MORNING, LadderRung.EVENING],
    Intensity.COMMITTED: [
        LadderRung.MORNING, LadderRung.AFTERNOON, LadderRung.EVENING, LadderRung.FINAL,
    ],
}

# The step-down order. COMMITTED -> STANDARD -> GENTLE -> (stays) GENTLE.
# Gentle does not step down to silence: one morning invitation is the floor, and
# a teen who wanted reminders keeps one.
STEP_DOWN = {
    Intensity.COMMITTED: Intensity.STANDARD,
    Intensity.STANDARD: Intensity.GENTLE,
    Intensity.GENTLE: Intensity.GENTLE,
}

# Default rung times from `docs/12-gamification.md`. The final rung sits before
# quiet hours "always" — 20:45 against a 21:30 start.
DEFAULT_RUNG_TIMES = {
    LadderRung.MORNING: time(6, 30),
    LadderRung.AFTERNOON: time(13, 30),
    LadderRung.EVENING: time(18, 30),
    LadderRung.FINAL: time(20, 45),
}

DEFAULT_QUIET_START = time(21, 30)
DEFAULT_QUIET_END = time(6, 0)

# "7 consecutive days of ignored reminders auto-steps intensity down one level"
IGNORED_DAYS_BEFORE_STEP_DOWN = 7


class NotificationPreference(UUIDMixin, TimestampMixin):
    """
    One row per user. What they agreed to, and when they may be interrupted.

    Created lazily by `services.preferences_for` rather than by a signal on user
    creation: a defaults row that exists only when first needed cannot drift out
    of sync with a user who was created before this app shipped.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='notification_preference',
    )

    intensity = models.CharField(
        max_length=16, choices=Intensity.choices, default=Intensity.STANDARD,
    )

    # Per-type consent (§10: "per-type preference toggles").
    habit_reminders_enabled = models.BooleanField(default=True)
    event_notifications_enabled = models.BooleanField(default=True)
    announcements_enabled = models.BooleanField(default=True)
    system_notifications_enabled = models.BooleanField(default=True)

    # Individually toggleable rungs (`docs/12-gamification.md`). These narrow the
    # preset; they never widen it — a teen on Gentle who enables the evening rung
    # is still on Gentle until they change the preset.
    morning_rung_enabled = models.BooleanField(default=True)
    afternoon_rung_enabled = models.BooleanField(default=True)
    evening_rung_enabled = models.BooleanField(default=True)
    final_rung_enabled = models.BooleanField(default=True)

    # User-adjustable rung times.
    morning_at = models.TimeField(default=DEFAULT_RUNG_TIMES[LadderRung.MORNING])
    afternoon_at = models.TimeField(default=DEFAULT_RUNG_TIMES[LadderRung.AFTERNOON])
    evening_at = models.TimeField(default=DEFAULT_RUNG_TIMES[LadderRung.EVENING])
    final_at = models.TimeField(default=DEFAULT_RUNG_TIMES[LadderRung.FINAL])

    # Quiet hours are absolute for everything but transactional messages.
    quiet_hours_start = models.TimeField(default=DEFAULT_QUIET_START)
    quiet_hours_end = models.TimeField(default=DEFAULT_QUIET_END)

    # Africa/Lagos by default; per-user because `docs/07` §8 requires tz-safe day
    # boundaries and a reminder must land in the teen's morning, not ours.
    timezone = models.CharField(max_length=64, default='Africa/Lagos')

    # Step-down bookkeeping (§10: "auto step-down ... software-enforced respect").
    consecutive_ignored_days = models.PositiveSmallIntegerField(default=0)
    last_stepped_down_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Notification Preference'
        verbose_name_plural = 'Notification Preferences'

    def __str__(self):
        return f'{self.user} — {self.get_intensity_display()}'

    # -- rung configuration ------------------------------------------------

    RUNG_TOGGLE_FIELDS = {
        LadderRung.MORNING: 'morning_rung_enabled',
        LadderRung.AFTERNOON: 'afternoon_rung_enabled',
        LadderRung.EVENING: 'evening_rung_enabled',
        LadderRung.FINAL: 'final_rung_enabled',
    }
    RUNG_TIME_FIELDS = {
        LadderRung.MORNING: 'morning_at',
        LadderRung.AFTERNOON: 'afternoon_at',
        LadderRung.EVENING: 'evening_at',
        LadderRung.FINAL: 'final_at',
    }

    def rung_time(self, rung):
        return getattr(self, self.RUNG_TIME_FIELDS[rung])

    def active_rungs(self):
        """
        The rungs that will actually fire: those in the preset AND individually
        enabled.

        Intersection, not union. A per-rung toggle narrows the preset it can never
        widen — otherwise "Gentle" would stop meaning "morning only", and the
        promise that "the app never chooses for them upward" would be empty.
        """
        return [
            rung for rung in PRESET_RUNGS[self.intensity]
            if getattr(self, self.RUNG_TOGGLE_FIELDS[rung])
        ]

    def type_enabled(self, notification_type):
        """Has the teen consented to this type of notification?"""
        return {
            NotificationType.HABIT_REMINDER: self.habit_reminders_enabled,
            NotificationType.EVENT: self.event_notifications_enabled,
            NotificationType.ANNOUNCEMENT: self.announcements_enabled,
            NotificationType.SYSTEM: self.system_notifications_enabled,
            # Never suppressed by preference: a teen who paid for a ticket is
            # owed the ticket. Consent to the purchase is consent to the receipt.
            NotificationType.TRANSACTIONAL: True,
        }.get(notification_type, True)

    def in_quiet_hours(self, at):
        """
        Is `at` (a local time) inside quiet hours?

        Handles the overnight wrap: 21:30–06:00 is not a simple `start <= t <= end`
        interval — it spans midnight, and the naive comparison would return False
        for every hour of the night it exists to protect.
        """
        start, end = self.quiet_hours_start, self.quiet_hours_end
        if start == end:
            return False
        if start < end:                      # a same-day window, e.g. 01:00–06:00
            return start <= at < end
        return at >= start or at < end       # the overnight case


class Notification(UUIDMixin, TimestampMixin):
    """
    One inbox item. Every push is mirrored here (§10), so a teen who misses the
    interruption still finds the message.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='notifications',
    )
    notification_type = models.CharField(
        max_length=20, choices=NotificationType.choices, db_index=True,
    )
    rung = models.CharField(
        max_length=16, choices=LadderRung.choices, blank=True,
        help_text='Set on habit reminders — which rung of the ladder this was.',
    )

    title = models.CharField(max_length=200)
    body = models.TextField()
    # Where tapping it goes. A reminder opens today's devotional, not the home
    # screen: "the notification is part of One Day. One Verse. One Message." (§10)
    deep_link = models.CharField(max_length=500, blank=True)
    data = models.JSONField(default=dict, blank=True)

    # Idempotence. The ladder runs on a scheduler that may fire twice; a rung must
    # not double-send because a worker was retried. Scoped per user.
    dedupe_key = models.CharField(max_length=200, blank=True, db_index=True)

    # Did it also go out as a push, or is it inbox-only (quiet hours, no
    # subscription, announcement cap already spent)?
    pushed_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'read_at']),
            models.Index(fields=['user', 'notification_type', '-created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'dedupe_key'],
                condition=models.Q(dedupe_key__gt=''),
                name='notifications_uniq_dedupe_key',
            ),
        ]

    def __str__(self):
        return f'{self.user} — {self.title}'

    @property
    def is_read(self):
        return self.read_at is not None


class PushSubscription(UUIDMixin, TimestampMixin):
    """
    A PWA push endpoint (`docs/07` §10: "Channels: PWA push").

    One user may hold several — a phone and a shared laptop. `endpoint` is unique
    globally, not per user: the browser vendor issues it, and if the same endpoint
    reappears under a different user (a shared device, re-signed-in), it must move
    to the new user rather than fan a push out to both.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='push_subscriptions',
    )
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=300, blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    # Set when the push service reports the endpoint is gone (HTTP 404/410), so a
    # dead subscription is retired rather than retried forever.
    failed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Push Subscription'
        verbose_name_plural = 'Push Subscriptions'
        indexes = [models.Index(fields=['user', 'is_active'])]

    def __str__(self):
        return f'{self.user} — {self.endpoint[:40]}...'
