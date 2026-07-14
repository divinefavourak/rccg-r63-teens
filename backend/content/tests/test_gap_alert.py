"""Tests for the devotional pipeline gap alert (docs/07 §5 — "pages the admin")."""
from datetime import timedelta

from django.test import TestCase

from common.dates import app_today
from content.models import Devotional, MemoryVerse
from content.tasks import alert_devotional_gaps
from identity.tests.base import build_tree, make_user
from notifications import services as notification_services
from notifications.models import Notification, NotificationType


def grant(user, node, code):
    from identity.models import Permission, Role, RoleAssignment, RolePermission

    role, _ = Role.objects.get_or_create(
        code=f'test-{user.username}', defaults={'label': 'Test role'})
    permission, _ = Permission.objects.get_or_create(code=code, defaults={'label': code})
    RolePermission.objects.get_or_create(role=role, permission=permission)
    RoleAssignment.objects.get_or_create(user=user, role=role, node=node)


def make_devotional(on):
    devotional = Devotional.objects.create(
        date=on, title=f'D {on}', slug=f'd-{on}', content='Body.',
        status=Devotional.Status.PUBLISHED,
    )
    MemoryVerse.objects.create(
        devotional=devotional, is_primary=True,
        reference_display='John 3:16', text_override='...',
    )
    return devotional


class GapAlertTests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        self.editor = make_user('editor')
        self.teen = make_user('teen')
        grant(self.editor, self.tree['r1'], 'content.manage')
        notification_services.subscribe(
            self.editor, endpoint='https://push.example/editor', p256dh='k', auth='a')

    def test_a_gap_alerts_whoever_can_fix_it(self):
        sent = alert_devotional_gaps()

        self.assertEqual(sent, 1)
        notification = Notification.objects.get(user=self.editor)
        self.assertEqual(notification.notification_type, NotificationType.SYSTEM)
        self.assertIn('pipeline gap', notification.title)

    def test_a_teen_is_not_paged_about_the_pipeline(self):
        alert_devotional_gaps()

        self.assertEqual(Notification.objects.filter(user=self.teen).count(), 0)

    def test_a_covered_horizon_alerts_nobody(self):
        today = app_today()
        for offset in range(3):
            make_devotional(today + timedelta(days=offset))

        self.assertEqual(alert_devotional_gaps(), 0)
        self.assertEqual(Notification.objects.count(), 0)

    def test_rerunning_the_check_does_not_spam_the_console_team(self):
        alert_devotional_gaps()
        alert_devotional_gaps()

        self.assertEqual(Notification.objects.filter(user=self.editor).count(), 1)

    def test_the_alert_names_the_uncovered_dates(self):
        alert_devotional_gaps()

        notification = Notification.objects.get(user=self.editor)
        self.assertIn(app_today().isoformat(), notification.data['gaps'])
