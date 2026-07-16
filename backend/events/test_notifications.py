"""Tests for event lifecycle notifications routed through the central service."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from events import notifications as event_notifications
from events.models import Event, EventRegistration
from events.tasks import send_event_reminders
from notifications import services as notification_services
from notifications.models import Notification, NotificationType

User = get_user_model()


def make_user(username='teen'):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x')


def subscribe(user):
    return notification_services.subscribe(
        user, endpoint=f'https://push.example/{user.username}', p256dh='k', auth='a')


def make_event(**kwargs):
    defaults = dict(
        title='Regional Camp',
        description='Three days.',
        start_datetime=timezone.now() + timedelta(days=10),
        end_datetime=timezone.now() + timedelta(days=13),
        status=Event.Status.PUBLISHED,
    )
    defaults.update(kwargs)
    return Event.objects.create(**defaults)


def make_registration(event, user=None, **kwargs):
    # EventRegistration is unique on (event, attendee_email), so each attendee on a
    # given event needs their own address — otherwise a test that registers three
    # teens for one camp trips the constraint rather than testing what it meant to.
    name = user.username if user else 'guest'
    defaults = dict(
        event=event,
        user=user,
        attendee_name=name.title(),
        attendee_email=f'{name}@example.com',
        attendee_phone='08000000000',
        attendee_age=15,
        status=EventRegistration.Status.PENDING,
    )
    defaults.update(kwargs)
    return EventRegistration.objects.create(**defaults)


def notifications_for(user):
    return Notification.objects.filter(user=user)


class RegistrationNotificationTests(TestCase):

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)
        self.event = make_event()

    def test_registration_received_is_transactional(self):
        """
        Quiet-hours exempt on purpose: a teen who registers at 22:00 is watching the
        screen for the outcome.
        """
        registration = make_registration(self.event, self.user)

        event_notifications.notify_registration_received(registration)

        notification = notifications_for(self.user).get()
        self.assertEqual(notification.notification_type, NotificationType.TRANSACTIONAL)
        self.assertIn('24 hours', notification.body)   # unpaid holds expire

    def test_a_paid_registration_does_not_mention_the_payment_deadline(self):
        registration = make_registration(
            self.event, self.user,
            payment_status=EventRegistration.PaymentStatus.NOT_REQUIRED,
        )

        event_notifications.notify_registration_received(registration)

        self.assertNotIn('24 hours', notifications_for(self.user).get().body)

    def test_registration_confirmed_links_to_the_ticket(self):
        registration = make_registration(self.event, self.user)

        event_notifications.notify_registration_confirmed(registration)

        notification = notifications_for(self.user).get()
        self.assertEqual(notification.notification_type, NotificationType.TRANSACTIONAL)
        self.assertIn(str(registration.id), notification.deep_link)

    def test_a_registration_with_no_user_notifies_nobody(self):
        """
        A coordinator may register an attendee who has no account. That must be a
        no-op, not an error — a notification failure cannot break a registration.
        """
        registration = make_registration(self.event, user=None)

        result = event_notifications.notify_registration_received(registration)

        self.assertIsNone(result)
        self.assertEqual(Notification.objects.count(), 0)

    def test_notifying_twice_does_not_double_send(self):
        registration = make_registration(self.event, self.user)

        event_notifications.notify_registration_received(registration)
        event_notifications.notify_registration_received(registration)

        self.assertEqual(notifications_for(self.user).count(), 1)


class StatusChangeNotificationTests(TestCase):

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)
        self.event = make_event()

    def test_waitlist_promotion_is_transactional(self):
        """A promoted teen usually has a deadline; quiet hours could cost them the place."""
        registration = make_registration(
            self.event, self.user, status=EventRegistration.Status.WAITLISTED)

        event_notifications.notify_status_changed(
            registration,
            EventRegistration.Status.WAITLISTED,
            EventRegistration.Status.CONFIRMED,
        )

        notification = notifications_for(self.user).get()
        self.assertEqual(notification.notification_type, NotificationType.TRANSACTIONAL)
        self.assertIn('place opened up', notification.title)

    def test_a_cancellation_is_an_ordinary_event_notification(self):
        registration = make_registration(self.event, self.user)

        event_notifications.notify_status_changed(
            registration,
            EventRegistration.Status.CONFIRMED,
            EventRegistration.Status.CANCELLED,
        )

        notification = notifications_for(self.user).get()
        self.assertEqual(notification.notification_type, NotificationType.EVENT)

    def test_a_no_op_transition_notifies_nobody(self):
        registration = make_registration(self.event, self.user)

        result = event_notifications.notify_status_changed(
            registration,
            EventRegistration.Status.CONFIRMED,
            EventRegistration.Status.CONFIRMED,
        )

        self.assertIsNone(result)

    def test_each_distinct_transition_is_its_own_message(self):
        """Waitlisted -> promoted -> cancelled: the teen hears about each move."""
        registration = make_registration(self.event, self.user)

        event_notifications.notify_status_changed(
            registration, EventRegistration.Status.WAITLISTED,
            EventRegistration.Status.CONFIRMED)
        event_notifications.notify_status_changed(
            registration, EventRegistration.Status.CONFIRMED,
            EventRegistration.Status.CANCELLED)

        self.assertEqual(notifications_for(self.user).count(), 2)


class EventBroadcastTests(TestCase):

    def setUp(self):
        self.event = make_event()
        self.confirmed = make_user('confirmed')
        self.waitlisted = make_user('waitlisted')
        self.cancelled = make_user('cancelled')
        for user in (self.confirmed, self.waitlisted, self.cancelled):
            subscribe(user)

        make_registration(self.event, self.confirmed,
                          status=EventRegistration.Status.CONFIRMED)
        make_registration(self.event, self.waitlisted,
                          status=EventRegistration.Status.WAITLISTED)
        make_registration(self.event, self.cancelled,
                          status=EventRegistration.Status.CANCELLED)

    def test_a_change_reaches_confirmed_and_waitlisted_but_not_cancelled(self):
        """
        A waitlisted teen deciding whether to keep waiting deserves to know the venue
        moved. A cancelled one does not need the noise.
        """
        sent = event_notifications.notify_event_changed(
            self.event, 'The venue has moved to Parish B.')

        self.assertEqual(sent, 2)
        self.assertEqual(notifications_for(self.confirmed).count(), 1)
        self.assertEqual(notifications_for(self.waitlisted).count(), 1)
        self.assertEqual(notifications_for(self.cancelled).count(), 0)

    def test_cancellation_reaches_everyone_still_holding_a_place(self):
        sent = event_notifications.notify_event_cancelled(self.event)

        self.assertEqual(sent, 2)
        self.assertIn('cancelled', notifications_for(self.confirmed).get().title)

    def test_a_reminder_goes_only_to_confirmed_attendees(self):
        """Reminding an unpaid teen to turn up reads as a dunning notice."""
        sent = event_notifications.notify_event_reminder(self.event)

        self.assertEqual(sent, 1)
        self.assertEqual(notifications_for(self.confirmed).count(), 1)
        self.assertEqual(notifications_for(self.waitlisted).count(), 0)

    def test_a_reminder_is_sent_once_per_registration(self):
        event_notifications.notify_event_reminder(self.event)
        event_notifications.notify_event_reminder(self.event)

        self.assertEqual(notifications_for(self.confirmed).count(), 1)


class EventReminderTaskTests(TestCase):

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)

    def test_an_event_within_24h_is_reminded(self):
        event = make_event(start_datetime=timezone.now() + timedelta(hours=20))
        make_registration(event, self.user,
                          status=EventRegistration.Status.CONFIRMED)

        sent = send_event_reminders()

        self.assertEqual(sent, 1)
        self.assertIn('Coming up', notifications_for(self.user).get().title)

    def test_an_event_further_out_is_not_reminded_yet(self):
        event = make_event(start_datetime=timezone.now() + timedelta(days=5))
        make_registration(event, self.user,
                          status=EventRegistration.Status.CONFIRMED)

        self.assertEqual(send_event_reminders(), 0)

    def test_a_past_event_is_not_reminded(self):
        event = make_event(
            start_datetime=timezone.now() - timedelta(hours=2),
            end_datetime=timezone.now() - timedelta(hours=1),
        )
        make_registration(event, self.user,
                          status=EventRegistration.Status.CONFIRMED)

        self.assertEqual(send_event_reminders(), 0)

    def test_an_unpublished_event_is_not_reminded(self):
        event = make_event(
            start_datetime=timezone.now() + timedelta(hours=20),
            status=Event.Status.DRAFT,
        )
        make_registration(event, self.user,
                          status=EventRegistration.Status.CONFIRMED)

        self.assertEqual(send_event_reminders(), 0)

    def test_rerunning_the_task_does_not_double_remind(self):
        event = make_event(start_datetime=timezone.now() + timedelta(hours=20))
        make_registration(event, self.user,
                          status=EventRegistration.Status.CONFIRMED)

        send_event_reminders()
        send_event_reminders()

        self.assertEqual(notifications_for(self.user).count(), 1)
