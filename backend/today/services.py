"""
The Today assembler — the daily heartbeat, composed once.

`docs/07-feature-specifications.md` §4 lists what Today renders: date/greeting,
streak state, the memory verse / Verse of the Day card, today's devotional card,
today's Scripture card, the daily challenge card, and the continue-reading card.
The backend audit flagged the assembler as the missing piece: every part existed,
nothing put them together, so a client had to make six calls to draw one screen.

**This app owns no models and adds no tables.** It is a composition layer, and it
composes strictly downward — `today` imports from `content`, `bible`, `progress`
and `profiles`; none of them import `today`. Nothing here re-derives a fact that
another domain already owns:

  * the Verse of the Day comes from `content.services.daily` (the one resolution
    path, so no competing daily verse can exist — `docs/08` §7);
  * the streak comes from `progress.services`;
  * the resumable position comes from `bible.services`.

Guests get the public half (devotional, verse, challenge) and null personal
sections. Today is the first screen a curious teen sees, and requiring an account
to see it would waste the moment (`docs/06-user-flows.md`).
"""
from bible import services as bible_services
from common.dates import app_today
from content.models import UserReadLog
from content.services import daily
from profiles.models import DailyChallenge
from progress import services as progress_services
from progress.models import ActionType, SpiritualAction

# `source_reference` prefix under which a challenge completion is recorded in the
# spiritual-action stream. The stream *is* the completion record — there is no
# separate ChallengeCompletion table, because `docs/07` §8 says the action stream
# "powers everything", and a second source of truth for "did they do it today"
# would be a second thing to keep in sync.
CHALLENGE_SOURCE_PREFIX = 'profiles.dailychallenge'


def challenge_source_reference(challenge):
    return f'{CHALLENGE_SOURCE_PREFIX}:{challenge.id}'


def greeting_for(now_hour):
    """
    Morning / afternoon / evening. Warm, never performative
    (`docs/11-content-strategy.md`).
    """
    if now_hour < 12:
        return 'Good morning'
    if now_hour < 17:
        return 'Good afternoon'
    return 'Good evening'


def todays_challenge(user=None, on=None):
    """
    Today's challenge, or None.

    One per day (`docs/07` §4: "one per day, skippable without penalty"). Where
    several are configured for the same date, the most recently created wins —
    an editor fixing a typo by adding a new row should see the new one.

    Note what is *not* read here: `DailyChallenge.coins_reward`. Coin
    gamification is banned by `docs/12-gamification.md` and parked by the backend
    audit (§6); the column survives on the legacy model but no Today surface may
    render it.
    """
    on = on or app_today()
    challenges = DailyChallenge.objects.filter(challenge_date=on, is_active=True)

    age_group = _age_group_for(user)
    if age_group:
        # Empty target_age_groups means "all age groups" (the model's own
        # contract), so an untargeted challenge must not be filtered out.
        challenges = [
            c for c in challenges
            if not c.target_age_groups or age_group in c.target_age_groups
        ]
        return max(challenges, key=lambda c: c.created_at, default=None)

    return challenges.order_by('-created_at').first()


def _age_group_for(user):
    if not user or not user.is_authenticated:
        return None
    profile = getattr(user, 'teen_profile', None)
    return getattr(profile, 'age_group', None) if profile else None


def challenge_completed(user, challenge, on=None):
    """Has the user completed this challenge today? Answered from the action stream."""
    if not user or not user.is_authenticated or challenge is None:
        return False
    return SpiritualAction.objects.filter(
        user=user,
        action_type=ActionType.CHALLENGE_COMPLETED,
        source_reference=challenge_source_reference(challenge),
        occurred_on=on or app_today(),
    ).exists()


def complete_challenge(user, challenge):
    """
    Record a challenge completion. Idempotent within the day.

    Returns `(action, created)`. Completing twice must not log two spiritual
    actions — the streak counts *days with a qualifying action*, but the stats
    tiles count actions, and a double-tap should not inflate them.
    """
    on = app_today()
    if challenge_completed(user, challenge, on=on):
        return None, False

    action = progress_services.record_action(
        user,
        ActionType.CHALLENGE_COMPLETED,
        occurred_on=on,
        source_reference=challenge_source_reference(challenge),
        metadata={'title': challenge.title},
    )
    return action, True


def devotional_completed(user, devotional):
    """
    Has the user completed today's devotional?

    `content.UserReadLog` is the completion record (it is what makes `mark_read`
    idempotent), so this asks it rather than inventing a second answer.
    """
    if not user or not user.is_authenticated or devotional is None:
        return False
    return UserReadLog.objects.filter(user=user, devotional=devotional).exists()


def scripture_cards(devotional):
    """
    Today's Scripture card(s): the devotional's anchor references.

    Returned as addresses, not resolved verse text. Each is a live link into the
    reader (`docs/08` §12 — "any Scripture reference, anywhere, is a live link"),
    and resolving them here would force a translation choice that belongs to the
    reader, not to Today.
    """
    if devotional is None:
        return []
    return [
        reference for reference in devotional.scripture_references.all()
        if reference.kind in (
            reference.Kind.ANCHOR, reference.Kind.READING,
        )
    ]


def assemble(user, now=None):
    """
    Everything the Today screen renders, in one dict.

    A pipeline gap (no devotional published for today) is a *state*, not an
    error: `devotional` is None and `has_devotional` is False, and the client
    renders the empty state from `docs/06-user-flows.md` flow 5. Today must still
    render — the streak, the challenge and continue-reading are all still true.
    """
    from django.utils import timezone as dj_timezone

    now = now or dj_timezone.localtime()
    on = app_today()

    devotional = daily.todays_devotional()
    memory_verse = daily.primary_memory_verse(devotional)
    challenge = todays_challenge(user=user, on=on)

    payload = {
        'date': on,
        'greeting': greeting_for(now.hour),
        'devotional': devotional,
        'has_devotional': devotional is not None,
        'memory_verse': memory_verse,
        'scripture_references': scripture_cards(devotional),
        'challenge': challenge,
        # Personal sections. None/False for guests rather than absent, so the
        # client renders one shape and does not branch on key presence.
        'devotional_completed': False,
        'challenge_completed': False,
        'streak': None,
        'grace_balance': 0,
        'continue_reading': None,
    }

    if user and user.is_authenticated:
        payload.update({
            'devotional_completed': devotional_completed(user, devotional),
            'challenge_completed': challenge_completed(user, challenge, on=on),
            'streak': progress_services.streak_for(user),
            'grace_balance': progress_services.grace_balance(user),
            'continue_reading': bible_services.get_continue_reading(user),
        })

    return payload
