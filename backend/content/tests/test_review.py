"""Tests for the content review gate — above all, the two-person rule."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from common.dates import app_today
from common.models import PublishableMixin
from content.models import Devotional, MemoryVerse
from content.services import calendar as calendar_service
from content.services import review
from identity.tests.base import build_tree, make_user

User = get_user_model()
Status = PublishableMixin.Status


def make_devotional(on=None, status=Status.DRAFT, with_verse=True, **kwargs):
    on = on or app_today()
    devotional = Devotional.objects.create(
        date=on, title=f'Devotional {on}', slug=f'devotional-{on}',
        content='Body.', status=status, **kwargs,
    )
    if with_verse:
        MemoryVerse.objects.create(
            devotional=devotional, is_primary=True,
            reference_display='John 3:16', text_override='For God so loved...',
        )
    return devotional


class TwoPersonRuleTests(TestCase):
    """docs/07-feature-specifications.md §5 — the rule this whole gate exists for."""

    def setUp(self):
        self.author = make_user('author')
        self.reviewer = make_user('reviewer')
        self.devotional = make_devotional()

    def test_the_author_cannot_approve_their_own_submission(self):
        review.submit_for_review(self.devotional, self.author)

        with self.assertRaises(PermissionDenied):
            review.approve(self.devotional, self.author)

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.IN_REVIEW)
        self.assertIsNone(self.devotional.approved_by)

    def test_a_second_person_can_approve(self):
        review.submit_for_review(self.devotional, self.author)

        review.approve(self.devotional, self.reviewer)

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.APPROVED)
        self.assertEqual(self.devotional.approved_by, self.reviewer)
        self.assertIsNotNone(self.devotional.approved_at)

    def test_an_unapproved_devotional_cannot_be_published(self):
        """The gate that makes the workflow real."""
        review.submit_for_review(self.devotional, self.author)

        with self.assertRaises(ValidationError):
            review.publish(self.devotional, self.reviewer)

    def test_a_draft_cannot_be_published_directly(self):
        with self.assertRaises(ValidationError):
            review.publish(self.devotional, self.reviewer)

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.DRAFT)

    def test_the_full_happy_path(self):
        review.submit_for_review(self.devotional, self.author)
        review.approve(self.devotional, self.reviewer)
        review.publish(self.devotional, self.reviewer)

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.PUBLISHED)
        self.assertIsNotNone(self.devotional.published_at)
        self.assertEqual(self.devotional.submitted_by, self.author)
        self.assertEqual(self.devotional.approved_by, self.reviewer)


class ReviewTransitionTests(TestCase):

    def setUp(self):
        self.author = make_user('author')
        self.reviewer = make_user('reviewer')
        self.devotional = make_devotional()

    def test_submitting_requires_a_draft(self):
        review.submit_for_review(self.devotional, self.author)

        with self.assertRaises(ValidationError):
            review.submit_for_review(self.devotional, self.author)

    def test_a_devotional_without_a_memory_verse_cannot_be_submitted(self):
        """The Verse of the Day gate, applied at the front of the workflow."""
        bare = make_devotional(on=app_today() + timedelta(days=1), with_verse=False)

        with self.assertRaises(ValidationError):
            review.submit_for_review(bare, self.author)

    def test_rejecting_returns_it_to_draft_with_notes(self):
        review.submit_for_review(self.devotional, self.author)

        review.reject(self.devotional, self.reviewer, notes='Please cite the passage.')

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.DRAFT)
        self.assertEqual(self.devotional.review_notes, 'Please cite the passage.')

    def test_a_rejected_devotional_can_be_resubmitted(self):
        """Rejection is not a dead end."""
        review.submit_for_review(self.devotional, self.author)
        review.reject(self.devotional, self.reviewer, notes='Fix it.')

        review.submit_for_review(self.devotional, self.author)

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.IN_REVIEW)
        self.assertEqual(self.devotional.review_notes, '')

    def test_resubmission_clears_a_previous_approval(self):
        """
        The subtle one: an old approval must not be mistaken for a current one.
        Approve -> edit -> resubmit must require a *fresh* approval.
        """
        review.submit_for_review(self.devotional, self.author)
        review.approve(self.devotional, self.reviewer)
        self.devotional.status = Status.DRAFT      # author reopens to edit
        self.devotional.save(update_fields=['status'])

        review.submit_for_review(self.devotional, self.author)

        self.devotional.refresh_from_db()
        self.assertIsNone(self.devotional.approved_by)
        self.assertIsNone(self.devotional.approved_at)
        with self.assertRaises(ValidationError):
            review.publish(self.devotional, self.reviewer)

    def test_approving_requires_in_review(self):
        with self.assertRaises(ValidationError):
            review.approve(self.devotional, self.reviewer)

    def test_scheduling_requires_approval(self):
        from django.utils import timezone
        review.submit_for_review(self.devotional, self.author)
        review.approve(self.devotional, self.reviewer)

        review.schedule(self.devotional, timezone.now() + timedelta(days=1), self.reviewer)

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.SCHEDULED)

    def test_a_scheduled_devotional_can_be_published(self):
        from django.utils import timezone
        review.submit_for_review(self.devotional, self.author)
        review.approve(self.devotional, self.reviewer)
        review.schedule(self.devotional, timezone.now() + timedelta(days=1), self.reviewer)

        review.publish(self.devotional, self.reviewer)

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.PUBLISHED)


class CalendarGapTests(TestCase):
    """docs/07 §5 — "calendar view with gap detection"."""

    def setUp(self):
        self.today = app_today()

    def test_a_published_day_is_covered(self):
        make_devotional(on=self.today, status=Status.PUBLISHED)

        self.assertEqual(calendar_service.gaps(self.today, self.today), [])

    def test_a_draft_day_is_a_gap(self):
        """An unreviewed devotional is not content, it is an intention."""
        make_devotional(on=self.today, status=Status.DRAFT)

        self.assertEqual(calendar_service.gaps(self.today, self.today), [self.today])

    def test_an_in_review_day_is_a_gap(self):
        make_devotional(on=self.today, status=Status.IN_REVIEW)

        self.assertEqual(calendar_service.gaps(self.today, self.today), [self.today])

    def test_approved_and_scheduled_days_are_covered(self):
        """Both will be live on the day; both count."""
        make_devotional(on=self.today, status=Status.APPROVED)
        make_devotional(on=self.today + timedelta(days=1), status=Status.SCHEDULED)

        self.assertEqual(
            calendar_service.gaps(self.today, self.today + timedelta(days=1)), [])

    def test_an_empty_day_is_a_gap(self):
        gaps = calendar_service.gaps(self.today, self.today + timedelta(days=2))

        self.assertEqual(len(gaps), 3)

    def test_the_calendar_includes_empty_days(self):
        """The empty days are the entire point of the view."""
        entries = calendar_service.calendar(self.today, self.today + timedelta(days=2))

        self.assertEqual(len(entries), 3)
        self.assertTrue(all(e['devotional'] is None for e in entries))

    def test_imminent_gaps_include_today(self):
        """A gap today is the most urgent kind there is."""
        self.assertIn(self.today, calendar_service.imminent_gaps(today=self.today))

    def test_imminent_gaps_are_empty_when_the_horizon_is_covered(self):
        for offset in range(3):
            make_devotional(on=self.today + timedelta(days=offset),
                            status=Status.PUBLISHED)

        self.assertEqual(calendar_service.imminent_gaps(today=self.today), [])

    def test_buffer_days_counts_consecutive_days_only(self):
        """60 devotionals with a hole on day 3 is a 3-day buffer, not a 60-day one."""
        for offset in [0, 1, 2, 4, 5]:      # day 3 missing
            make_devotional(on=self.today + timedelta(days=offset),
                            status=Status.PUBLISHED)

        self.assertEqual(calendar_service.buffer_days(today=self.today), 3)


def grant(user, node, *codes):
    """
    Give `user` the named capabilities at `node`.

    Uses a per-user ad-hoc role rather than a seeded one so a test can hand out
    exactly the capabilities it is exercising — the point of several tests below
    is what happens when someone holds `content.publish` but not the right to use
    it on their *own* submission.
    """
    from identity.models import Permission, Role, RoleAssignment, RolePermission

    role, _ = Role.objects.get_or_create(
        code=f'test-{user.username}', defaults={'label': 'Test role'})
    for code in codes:
        permission, _ = Permission.objects.get_or_create(
            code=code, defaults={'label': code})
        RolePermission.objects.get_or_create(role=role, permission=permission)
    RoleAssignment.objects.get_or_create(user=user, role=role, node=node)
    return role


class ReviewEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.tree = build_tree()
        self.node = self.tree['r1']
        self.author = make_user('author')
        self.reviewer = make_user('reviewer')
        self.devotional = make_devotional()
        grant(self.author, self.node, 'content.manage')
        grant(self.reviewer, self.node, 'content.manage', 'content.publish')

    def _url(self, name):
        return reverse(f'devotional-{name}', args=[self.devotional.id])

    def test_author_submits_then_reviewer_approves_and_publishes(self):
        self.client.force_authenticate(self.author)
        response = self.client.post(self._url('submit-for-review'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], Status.IN_REVIEW)

        self.client.force_authenticate(self.reviewer)
        self.assertEqual(self.client.post(self._url('approve')).status_code, 200)
        self.assertEqual(self.client.post(self._url('publish')).status_code, 200)

        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.PUBLISHED)

    def test_a_self_approval_is_a_403_even_with_the_publish_permission(self):
        """
        The rule compares identities, not capabilities: holding content.publish
        does not let you be both halves of a two-person check.
        """
        grant(self.author, self.node, 'content.publish')
        self.client.force_authenticate(self.author)
        self.client.post(self._url('submit-for-review'))

        response = self.client.post(self._url('approve'))

        self.assertEqual(response.status_code, 403)
        self.devotional.refresh_from_db()
        self.assertEqual(self.devotional.status, Status.IN_REVIEW)

    def test_an_author_without_publish_permission_cannot_approve(self):
        self.client.force_authenticate(self.author)
        self.client.post(self._url('submit-for-review'))

        self.assertEqual(self.client.post(self._url('approve')).status_code, 403)

    def test_publishing_an_unapproved_devotional_is_refused(self):
        self.client.force_authenticate(self.reviewer)

        response = self.client.post(self._url('publish'))

        self.assertEqual(response.status_code, 400)


class CalendarEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.tree = build_tree()
        self.leader = make_user('leader')
        grant(self.leader, self.tree['r1'], 'content.view')
        self.url = reverse('devotional-calendar')

    def test_calendar_reports_gaps_and_buffer(self):
        today = app_today()
        make_devotional(on=today, status=Status.PUBLISHED)
        self.client.force_authenticate(self.leader)

        response = self.client.get(self.url, {
            'start': today.isoformat(),
            'end': (today + timedelta(days=2)).isoformat(),
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['days']), 3)
        self.assertEqual(len(response.data['gaps']), 2)
        self.assertEqual(response.data['buffer_days'], 1)

    def test_the_calendar_is_leader_only(self):
        """A console surface, not a teen one."""
        teen = make_user('teen')
        self.client.force_authenticate(teen)

        self.assertEqual(self.client.get(self.url).status_code, 403)
