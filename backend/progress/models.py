"""
Progress domain — the one source of truth for spiritual activity, streaks and
(later) Grace Days (`docs/07-feature-specifications.md` §8,
`docs/12-gamification.md`).

**Layering.** `progress` is *foundational*: it imports nothing from `bible`,
`content`, `events` or `identity`. Feature apps record activity by calling
`progress.services.record_action(...)`; they are never imported here. To keep
that one-way dependency, `SpiritualAction` stores an opaque `source_reference`
string (e.g. ``"bible.chapter:<uuid>"``) rather than a foreign key into another
domain.
"""
from django.conf import settings
from django.db import models

from common.models import AppendOnlyModel, TimestampMixin, UUIDMixin


class ActionType(models.TextChoices):
    """The qualifying spiritual actions that power streaks and stats.

    Mirrors the documented event vocabulary
    (`docs/07-feature-specifications.md` §8). ``✧`` items are future surfaces
    that already have a home in the stream so nothing needs re-modelling later.
    """
    DEVOTIONAL_COMPLETED = 'devotional_completed', 'Devotional completed'
    CHAPTER_READ = 'chapter_read', 'Bible chapter read'
    CHALLENGE_COMPLETED = 'challenge_completed', 'Challenge completed'
    JOURNEY_STEP_COMPLETED = 'journey_step_completed', 'Journey step completed'
    VERSE_REVIEWED = 'verse_reviewed', 'Memory verse reviewed'


class SpiritualAction(UUIDMixin, AppendOnlyModel):
    """
    An append-only record that a user did one qualifying spiritual thing.

    Deliberately **not** a `TimestampMixin`: there is no `updated_at` because a
    logged action is never edited — the same immutability contract as
    `bible.ReadingHistory`. `occurred_on` is the *local* calendar day (see
    `common.dates.user_today`) and is the unit a streak is counted in; storing
    it once, at write time, means the streak engine never re-derives day
    boundaries from UTC instants.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='spiritual_actions',
    )
    action_type = models.CharField(max_length=32, choices=ActionType.choices)

    occurred_at = models.DateTimeField(auto_now_add=True)   # UTC instant
    occurred_on = models.DateField(db_index=True)           # tz-safe local day

    # Opaque provenance, e.g. "bible.chapter:<uuid>" / "content.devotional:<uuid>".
    # A string, not an FK, so `progress` need not import the source domain.
    source_reference = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', '-occurred_at']),
            models.Index(fields=['user', 'occurred_on']),
        ]
        ordering = ['-occurred_at']

    def __str__(self):
        return f'{self.user_id} {self.action_type} on {self.occurred_on}'


class StreakState(UUIDMixin, TimestampMixin):
    """
    A user's materialized streak — a high-water-mark cache over the append-only
    `SpiritualAction` stream, so reading "current streak" on Today is one row,
    not an aggregation.

    Truth still lives in the stream: this can always be rebuilt from it, and the
    engine only ever advances it forward. `longest_length` is never lowered by a
    reset — a broken streak is reframed as a fresh start while its record is
    preserved (`docs/12-gamification.md` — "history is honored, not erased").
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='streak_state',
    )
    current_length = models.PositiveIntegerField(default=0)
    longest_length = models.PositiveIntegerField(default=0)

    # The most recent local day that counted toward the streak, and the day the
    # current run began (for "Day 1 — fresh start" framing).
    last_active_on = models.DateField(null=True, blank=True)
    started_on = models.DateField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['user'])]

    def __str__(self):
        return f'{self.user_id}: {self.current_length}d (best {self.longest_length})'


class GraceReason(models.TextChoices):
    """Why a Grace-Day ledger entry exists."""
    MONTHLY_ALLOCATION = 'monthly_allocation', 'Monthly allocation'
    WEEKLY_EARNED = 'weekly_earned', 'Earned: completed 7-day week'
    JOURNEY_EARNED = 'journey_earned', 'Earned: completed Journey'
    STREAK_COVER = 'streak_cover', 'Consumed: covered a missed day'


class GraceDayLedger(UUIDMixin, AppendOnlyModel):
    """
    Append-only ledger of Grace-Day movements; a user's balance is the sum of
    `delta`. A ledger (not a bare counter) because grace is *earned and spent*
    over time and the product must be able to say exactly why a day was covered
    ("Grace covered Tuesday 🌱", `docs/12-gamification.md`).

    Grants are positive (`+2` monthly, `+1` earned); a cover is `-1` and records
    the `covered_on` day it bridged. The held cap of 4 is enforced at *grant*
    time (excess simply isn't written — "no hoarding economy"), so the summed
    balance never needs clamping on read.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='grace_ledger',
    )
    delta = models.SmallIntegerField()
    reason = models.CharField(max_length=32, choices=GraceReason.choices)

    # A cover records the missed local day it bridged; a monthly grant records
    # the month it belongs to so re-running allocation is idempotent.
    covered_on = models.DateField(null=True, blank=True)
    effective_month = models.DateField(null=True, blank=True)  # 1st of the month

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['user', 'created_at'])]
        ordering = ['-created_at']
        constraints = [
            # One monthly allocation per user per month, no matter how often the
            # allocation job runs. Paired with the check below (month is never
            # NULL for a monthly grant) so this partial index can't be bypassed
            # by NULLs — which Postgres treats as mutually distinct.
            models.UniqueConstraint(
                fields=['user', 'effective_month'],
                condition=models.Q(reason=GraceReason.MONTHLY_ALLOCATION),
                name='progress_one_monthly_allocation_per_month',
            ),
            # A monthly grant must carry the month it belongs to.
            models.CheckConstraint(
                condition=(
                    ~models.Q(reason=GraceReason.MONTHLY_ALLOCATION)
                    | models.Q(effective_month__isnull=False)
                ),
                name='progress_monthly_allocation_has_month',
            ),
            # A cover spends grace: its delta is negative.
            models.CheckConstraint(
                condition=(
                    ~models.Q(reason=GraceReason.STREAK_COVER)
                    | models.Q(delta__lt=0)
                ),
                name='progress_streak_cover_is_negative',
            ),
        ]

    def __str__(self):
        return f'{self.user_id} {self.delta:+d} ({self.reason})'
