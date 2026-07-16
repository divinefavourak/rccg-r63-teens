"""
The content review gate — draft → in-review → approved → scheduled/published.

`docs/07-feature-specifications.md` §5 requires a "two-person rule for
region-wide+ publishing". The rule is one sentence and one line of code: **the
person who approves may not be the person who submitted.** Everything else here
exists to make that rule unbypassable.

Why a service and not `save()` overrides: a state machine smeared across model
hooks is a state machine nobody can read, and one that any `.update()` sidesteps.
Every transition is a function here, each one validating the state it is leaving
before it writes the state it is entering.

**On "region-wide+":** content does not yet carry a hierarchy scope — that
belongs to a later phase (the backend audit's C2/M1). Until it does, Region 63 is
the only region and every devotional *is* region-wide, so the gate applies to all
reviewed content. `requires_two_person_review()` is the single predicate to relax
when scoping lands; nothing else needs to change.
"""
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from common.models import PublishableMixin

from .daily import validate_publishable

Status = PublishableMixin.Status

# The states from which an item may be sent for review. Re-submitting a rejected
# item is the normal path — rejection returns it to DRAFT, not to a dead end.
SUBMITTABLE_FROM = {Status.DRAFT}
PUBLISHABLE_FROM = {Status.APPROVED, Status.SCHEDULED}


def requires_two_person_review(item):
    """
    Does this item need a second pair of eyes before it publishes?

    Today: yes, always. See the module docstring — every devotional is region-wide
    while Region 63 is the only region. This is the one place to teach the rule
    about scope once content carries a hierarchy node.
    """
    return True


def _validate_content(item):
    """Type-specific publish preconditions."""
    # A devotional's memory verse is the Verse of the Day; without it the whole
    # day has no verse (`docs/08-bible-experience.md` §7). The existing gate.
    if hasattr(item, 'memory_verses'):
        validate_publishable(item)


@transaction.atomic
def submit_for_review(item, user):
    """Author sends the item up. draft -> in_review."""
    if item.status not in SUBMITTABLE_FROM:
        raise ValidationError(
            f'Only a draft can be submitted for review (this is {item.status}).'
        )
    _validate_content(item)

    item.status = Status.IN_REVIEW
    item.submitted_by = user
    item.submitted_at = timezone.now()
    # A fresh submission starts a fresh review: clear the previous verdict so an
    # old approval can never be mistaken for a current one.
    item.approved_by = None
    item.approved_at = None
    item.review_notes = ''
    item.save(update_fields=[
        'status', 'submitted_by', 'submitted_at', 'approved_by', 'approved_at',
        'review_notes', 'updated_at',
    ])
    return item


@transaction.atomic
def approve(item, user):
    """
    Reviewer approves. in_review -> approved.

    **The two-person rule.** A reviewer who is also the submitter is refused, and
    that refusal is a `PermissionDenied` rather than a validation error — it is
    not a malformed request, it is one person trying to be both halves of a
    two-person check.
    """
    if item.status != Status.IN_REVIEW:
        raise ValidationError(
            f'Only an item in review can be approved (this is {item.status}).'
        )

    if requires_two_person_review(item) and item.submitted_by_id == getattr(user, 'id', None):
        raise PermissionDenied(
            'The two-person rule: content must be approved by someone other than '
            'the person who submitted it.'
        )

    _validate_content(item)

    item.status = Status.APPROVED
    item.approved_by = user
    item.approved_at = timezone.now()
    item.review_notes = ''
    item.save(update_fields=[
        'status', 'approved_by', 'approved_at', 'review_notes', 'updated_at',
    ])
    return item


@transaction.atomic
def reject(item, user, notes=''):
    """
    Reviewer sends it back. in_review -> draft, with a reason.

    Rejection is not a punishment state: the item returns to the author's drafts
    with notes, and re-submitting is the normal next step
    (`docs/11-content-strategy.md` — the voice applies to the console too).
    """
    if item.status != Status.IN_REVIEW:
        raise ValidationError(
            f'Only an item in review can be rejected (this is {item.status}).'
        )

    item.status = Status.DRAFT
    item.approved_by = None
    item.approved_at = None
    item.review_notes = notes
    item.save(update_fields=[
        'status', 'approved_by', 'approved_at', 'review_notes', 'updated_at',
    ])
    return item


@transaction.atomic
def publish(item, user):
    """
    approved/scheduled -> published.

    The gate that makes the whole workflow real: publishing an item that never
    passed review is refused here, so no view, admin action or console button can
    route around the two-person rule by calling `item.publish()` on a draft.
    """
    if item.status not in PUBLISHABLE_FROM:
        raise ValidationError(
            f'Only approved or scheduled content can be published (this is '
            f'{item.status}). Submit it for review first.'
        )
    if requires_two_person_review(item) and item.approved_by_id is None:
        raise PermissionDenied(
            'This content has not been approved by a second person and cannot be '
            'published.'
        )

    _validate_content(item)

    item.status = Status.PUBLISHED
    item.published_at = timezone.now()
    item.save(update_fields=['status', 'published_at', 'updated_at'])
    return item


@transaction.atomic
def schedule(item, publish_at, user):
    """approved -> scheduled. Same approval requirement as publishing."""
    if item.status != Status.APPROVED:
        raise ValidationError(
            f'Only approved content can be scheduled (this is {item.status}).'
        )
    if requires_two_person_review(item) and item.approved_by_id is None:
        raise PermissionDenied(
            'This content has not been approved by a second person and cannot be '
            'scheduled.'
        )

    item.status = Status.SCHEDULED
    item.scheduled_for = publish_at
    item.save(update_fields=['status', 'scheduled_for', 'updated_at'])
    return item
