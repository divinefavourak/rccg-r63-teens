"""
Paying for an event registration: what opens a checkout, what marks a place
paid, and what happens to a place nobody paid for.

No test here reaches Paystack. Every outbound call is mocked, and the webhook
is signed with the dummy key the way Paystack would sign it.
"""
import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from events import bedspaces
from events.models import EventRegistration, Hostel, RegistrationAuditLog
from events.test_registration_counters import make_event, make_registration
from payments import registrations
from payments.models import Payment
from payments.services import PaystackService
from payments.tests import paystack_signature, paystack_test_keys

User = get_user_model()
Status = EventRegistration.Status
Paid = EventRegistration.PaymentStatus

PRICE = Decimal('5000.00')
CALLBACK = 'https://api.example.com/api/v1/payments/return/'


def paid_event(**kwargs):
    return make_event(is_free=False, price=PRICE, **kwargs)


def unpaid(event, email='ada@example.com', **overrides):
    fields = dict(payment_status=Paid.PENDING, amount_due=PRICE)
    fields.update(overrides)
    return make_registration(event, email=email, **fields)


def paystack_opens():
    """What Paystack answers when a checkout is opened."""
    def answer(payload):
        return {'status': True, 'data': {
            'authorization_url': f'https://checkout.paystack.com/{payload["reference"]}',
            'access_code': 'code_' + payload['reference'],
            'reference': payload['reference'],
        }}
    return answer


def charge(payment, amount=500000, status='success'):
    return {
        'reference': payment.reference,
        'status': status,
        'amount': amount,
        'channel': 'card',
        'authorization': {'authorization_code': 'AUTH_x', 'channel': 'card'},
    }


def age(registration, hours):
    """Make a registration look as if it was made `hours` ago."""
    EventRegistration.objects.filter(pk=registration.pk).update(
        created_at=timezone.now() - timedelta(hours=hours))


@paystack_test_keys
class OpeningACheckoutTests(TestCase):

    def setUp(self):
        self.registration = unpaid(paid_event())

    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_the_payer_is_charged_the_price_on_the_registration(self, mock_open):
        payment = registrations.start(self.registration, CALLBACK)

        sent = mock_open.call_args.args[0]
        self.assertEqual(sent['amount'], 500000)  # kobo, with no fee added
        self.assertEqual(sent['callback_url'], CALLBACK)
        self.assertEqual(payment.amount, PRICE)
        self.assertEqual(payment.registration, self.registration)
        self.assertTrue(payment.authorization_url.startswith('https://checkout.paystack.com/'))

    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_a_second_tap_reopens_the_same_checkout(self, mock_open):
        first = registrations.start(self.registration, CALLBACK)
        second = registrations.start(self.registration, CALLBACK)

        self.assertEqual(second.pk, first.pk)
        mock_open.assert_called_once()
        self.assertEqual(Payment.objects.count(), 1)

    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_an_old_checkout_is_not_handed_out_again(self, mock_open):
        first = registrations.start(self.registration, CALLBACK)
        Payment.objects.filter(pk=first.pk).update(
            initiated_at=timezone.now() - registrations.REUSE_FOR - timedelta(minutes=1))

        second = registrations.start(self.registration, CALLBACK)

        self.assertNotEqual(second.pk, first.pk)

    @patch.object(PaystackService, 'initialize_payment')
    def test_a_checkout_still_being_opened_is_not_opened_twice(self, mock_open):
        Payment.objects.create(
            reference='IN_FLIGHT', amount=PRICE, registration=self.registration,
            description='x', payer_email='ada@example.com')

        with self.assertRaises(registrations.BeingPrepared):
            registrations.start(self.registration, CALLBACK)
        mock_open.assert_not_called()

    @patch.object(PaystackService, 'initialize_payment', side_effect=Exception('timeout'))
    def test_paystack_not_answering_is_said_plainly_and_recorded(self, _):
        with self.assertRaises(registrations.Unavailable):
            registrations.start(self.registration, CALLBACK)

        self.assertEqual(Payment.objects.get().status, Payment.Status.FAILED)

    @override_settings(PAYSTACK_SECRET_KEY='', PAYSTACK_PUBLIC_KEY='')
    def test_without_keys_nobody_is_sent_to_a_broken_page(self):
        with self.assertRaises(registrations.Unavailable):
            registrations.start(self.registration, CALLBACK)
        self.assertFalse(Payment.objects.exists())

    def test_what_cannot_be_paid_for(self):
        event = paid_event(title='Camp', slug='camp')
        free = make_registration(make_event(title='Free day', slug='free-day'), email='f@example.com')
        cases = {
            'free': free,
            'paid': unpaid(event, 'p@example.com', payment_status=Paid.PAID),
            'waitlisted': unpaid(event, 'w@example.com', status=Status.WAITLISTED),
            'cancelled by a person': unpaid(
                event, 'c@example.com', status=Status.CANCELLED, cancellation_reason='Changed my mind'),
        }
        for name, registration in cases.items():
            with self.subTest(name):
                self.assertIsNotNone(registrations.refusal(registration))
                with self.assertRaises(registrations.NotPayable):
                    registrations.start(registration, CALLBACK)


@paystack_test_keys
class WebhookTests(APITestCase):
    """Paystack saying a charge succeeded is what marks a registration paid."""

    url = '/api/v1/payments/webhook'

    def setUp(self):
        self.user = User.objects.create_user(username='ada', email='ada@example.com', password='x')
        self.event = paid_event()
        self.registration = unpaid(self.event, user=self.user)
        with patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens()):
            self.payment = registrations.start(self.registration, CALLBACK)

    def deliver(self, payment=None, **overrides):
        raw = json.dumps({
            'event': 'charge.success',
            'data': charge(payment or self.payment, **overrides),
        }).encode('utf-8')
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                self.url, data=raw, content_type='application/json',
                HTTP_X_PAYSTACK_SIGNATURE=paystack_signature(raw))

    def reload(self):
        self.registration.refresh_from_db()
        return self.registration

    @patch('events.email_service.EventEmailService.send_registration_confirmed')
    @patch('events.notifications.notify_payment_received')
    def test_a_paid_place_is_confirmed_and_the_attendee_is_told(self, mock_notify, mock_email):
        response = self.deliver()

        self.assertEqual(response.status_code, 200)
        registration = self.reload()
        self.assertEqual(registration.payment_status, Paid.PAID)
        self.assertEqual(registration.status, Status.CONFIRMED)
        self.assertEqual(registration.amount_paid, PRICE)
        self.assertEqual(registration.payment, self.payment)
        self.assertEqual(registration.payment_reference, self.payment.reference)
        mock_notify.assert_called_once()
        mock_email.assert_called_once()
        self.assertTrue(RegistrationAuditLog.objects.filter(
            registration=registration, action='payment_update').exists())

    @patch('events.email_service.EventEmailService.send_registration_confirmed')
    @patch('events.notifications.notify_payment_received')
    def test_paystack_retrying_tells_the_attendee_once(self, mock_notify, _):
        self.deliver()
        self.deliver()

        mock_notify.assert_called_once()
        self.event.refresh_from_db()
        self.assertEqual(self.event.registration_count, 1)

    def test_the_wrong_amount_pays_for_nothing(self):
        self.deliver(amount=100)

        self.assertEqual(self.reload().payment_status, Paid.PENDING)
        self.assertEqual(self.reload().status, Status.PENDING)

    @patch('events.email_service.EventEmailService.send_registration_confirmed')
    @patch('events.notifications.notify_payment_received')
    def test_a_second_checkout_paid_as_well_is_kept_and_flagged(self, mock_notify, _):
        Payment.objects.filter(pk=self.payment.pk).update(
            initiated_at=timezone.now() - timedelta(hours=1))
        with patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens()):
            second = registrations.start(self.registration, CALLBACK)

        self.deliver()
        self.deliver(second)

        second.refresh_from_db()
        self.assertEqual(second.status, Payment.Status.SUCCESS)
        self.assertEqual(self.reload().payment, self.payment)
        mock_notify.assert_called_once()
        self.assertTrue(RegistrationAuditLog.objects.filter(
            registration=self.registration, new_values__paid_twice=second.reference).exists())

    @patch('events.email_service.EventEmailService.send_registration_confirmed')
    def test_the_held_bed_becomes_firm(self, _):
        event = paid_event(title='Camp', slug='camp', bedspaces_enabled=True)
        Hostel.objects.create(event=event, name='Hostel A', code='HA', gender='male', capacity=2)
        registration = unpaid(event, 'boy@example.com', attendee_gender='male')
        bedspaces.sync(registration)
        self.assertFalse(bedspaces.is_firm(registration))
        with patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens()):
            payment = registrations.start(registration, CALLBACK)

        self.deliver(payment)

        registration.refresh_from_db()
        self.assertTrue(bedspaces.is_firm(registration))
        self.assertIsNotNone(bedspaces.bed_of(registration))


@paystack_test_keys
class ReleasedPlaceTests(TestCase):
    """A place is held for 24 hours, then given up; paying late can bring it back."""

    def setUp(self):
        self.event = paid_event(max_attendees=1, waitlist_enabled=False)
        self.registration = unpaid(self.event)

    def status(self, registration=None):
        registration = registration or self.registration
        registration.refresh_from_db()
        return registration.status

    def test_a_place_not_paid_for_in_time_is_released(self):
        age(self.registration, hours=25)

        with self.captureOnCommitCallbacks(execute=True):
            released = registrations.expire_unpaid()

        self.assertEqual(released, 1)
        self.assertEqual(self.status(), Status.CANCELLED)
        self.assertTrue(registrations.lapsed(self.registration))
        self.assertFalse(self.event.is_full)

    def test_a_place_still_inside_its_time_is_kept(self):
        age(self.registration, hours=23)

        self.assertEqual(registrations.expire_unpaid(), 0)
        self.assertEqual(self.status(), Status.PENDING)

    def test_a_paid_place_and_a_leader_confirmed_place_are_kept(self):
        event = paid_event(title='Camp', slug='camp')
        paid = unpaid(event, 'p@example.com', payment_status=Paid.PAID, status=Status.CONFIRMED)
        vouched = unpaid(event, 'v@example.com', status=Status.CONFIRMED)
        for registration in (paid, vouched):
            age(registration, hours=48)

        self.assertEqual(registrations.expire_unpaid(), 0)
        self.assertEqual(self.status(paid), Status.CONFIRMED)
        self.assertEqual(self.status(vouched), Status.CONFIRMED)

    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_someone_in_the_middle_of_paying_is_left_alone(self, _):
        registrations.start(self.registration, CALLBACK)
        age(self.registration, hours=25)

        self.assertEqual(registrations.expire_unpaid(), 0)
        self.assertEqual(self.status(), Status.PENDING)

    @override_settings(PAYSTACK_SECRET_KEY='')
    def test_nothing_is_released_while_nobody_can_pay(self):
        age(self.registration, hours=25)

        self.assertEqual(registrations.expire_unpaid(), 0)

    @override_settings(UNPAID_REGISTRATION_HOLD_HOURS=0)
    def test_the_hold_can_be_turned_off(self):
        age(self.registration, hours=500)

        self.assertEqual(registrations.expire_unpaid(), 0)
        self.assertIsNone(registrations.pay_by(self.registration))

    @patch('events.email_service.EventEmailService.send_registration_confirmed')
    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_paying_late_brings_the_place_back_while_there_is_room(self, *_):
        age(self.registration, hours=25)
        registrations.expire_unpaid()
        self.registration.refresh_from_db()
        self.assertIsNone(registrations.refusal(self.registration))

        payment = registrations.start(self.registration, CALLBACK)
        registrations.PaymentService()._complete(payment.reference, charge(payment))

        self.assertEqual(self.status(), Status.CONFIRMED)
        self.assertEqual(self.registration.payment_status, Paid.PAID)

    @patch('events.notifications.notify_payment_received')
    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_paying_late_for_a_place_someone_else_took(self, _, mock_notify):
        payment = registrations.start(self.registration, CALLBACK)
        Payment.objects.filter(pk=payment.pk).update(
            initiated_at=timezone.now() - timedelta(hours=2))
        age(self.registration, hours=25)
        registrations.expire_unpaid()
        unpaid(self.event, 'bisi@example.com')
        self.registration.refresh_from_db()
        self.assertIsNotNone(registrations.refusal(self.registration))

        # The checkout opened before the place was released is paid anyway.
        with self.captureOnCommitCallbacks(execute=True):
            registrations.PaymentService()._complete(payment.reference, charge(payment))

        self.assertEqual(self.status(), Status.CANCELLED)
        self.assertEqual(self.registration.payment_status, Paid.PAID)
        self.assertTrue(mock_notify.call_args.kwargs['place_gone'])


@paystack_test_keys
class AskingPaystackTests(TestCase):

    def setUp(self):
        self.registration = unpaid(paid_event())
        with patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens()):
            self.payment = registrations.start(self.registration, CALLBACK)

    @patch('events.email_service.EventEmailService.send_registration_confirmed')
    @patch.object(PaystackService, 'verify_payment')
    def test_a_success_marks_the_registration_paid(self, mock_verify, _):
        mock_verify.return_value = {'status': True, 'data': charge(self.payment)}

        self.assertTrue(registrations.check_registration(self.registration))

        self.registration.refresh_from_db()
        self.assertEqual(self.registration.payment_status, Paid.PAID)

    @patch.object(PaystackService, 'verify_payment')
    def test_an_unfinished_checkout_is_left_open(self, mock_verify):
        # What Paystack says while someone is in their bank's app making the transfer.
        mock_verify.return_value = {
            'status': True, 'data': charge(self.payment, status='abandoned')}

        self.assertFalse(registrations.check_registration(self.registration))

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.Status.PENDING)

    @patch.object(PaystackService, 'verify_payment', side_effect=Exception('timeout'))
    def test_paystack_not_answering_is_not_an_error(self, _):
        self.assertFalse(registrations.check_registration(self.registration))


@paystack_test_keys
@override_settings(PUBLIC_API_URL='https://api.example.com')
class EndpointTests(APITestCase):

    def setUp(self):
        self.ada = User.objects.create_user(username='ada', email='ada@example.com', password='x')
        self.bisi = User.objects.create_user(username='bisi', email='bisi@example.com', password='x')
        self.registration = unpaid(paid_event(), user=self.ada)
        self.checkout = f'/api/v1/payments/registrations/{self.registration.pk}/checkout/'

    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_the_owner_gets_a_checkout_and_a_link_for_a_parent(self, mock_open):
        self.client.force_authenticate(self.ada)

        response = self.client.post(
            self.checkout, {'return_to': 'faithtribe://ticket/abc'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['authorization_url'].startswith('https://checkout.paystack.com/'))
        self.assertTrue(response.data['pay_link'].startswith('https://api.example.com/api/v1/payments/pay/'))
        self.assertEqual(
            mock_open.call_args.args[0]['callback_url'],
            'https://api.example.com/api/v1/payments/return/')
        self.assertEqual(Payment.objects.get().metadata['return_to'], 'faithtribe://ticket/abc')

    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_a_way_back_to_somewhere_that_is_not_ours_is_dropped(self, _):
        self.client.force_authenticate(self.ada)

        self.client.post(self.checkout, {'return_to': 'https://evil.example/x'}, format='json')

        self.assertEqual(Payment.objects.get().metadata['return_to'], '')

    def test_someone_elses_registration_is_not_found(self):
        self.client.force_authenticate(self.bisi)

        response = self.client.post(self.checkout)

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Payment.objects.exists())

    def test_logged_out_is_refused(self):
        self.assertEqual(self.client.post(self.checkout).status_code, 401)

    def test_nothing_to_pay_is_a_400_with_the_reason(self):
        EventRegistration.objects.filter(pk=self.registration.pk).update(payment_status=Paid.PAID)
        self.client.force_authenticate(self.ada)

        response = self.client.post(self.checkout)

        self.assertEqual(response.status_code, 400)
        self.assertIn('already been paid', response.data['detail'])

    def test_my_tickets_says_what_can_be_paid_and_by_when(self):
        self.client.force_authenticate(self.ada)

        ticket = self.client.get('/api/v1/events/registrations/mine/').data[0]

        self.assertTrue(ticket['can_pay'])
        self.assertIsNotNone(ticket['pay_by'])
        self.assertEqual(
            registrations.from_pay_token(ticket['pay_token']).pk, self.registration.pk)

    @patch('events.email_service.EventEmailService.send_registration_confirmed')
    @patch.object(PaystackService, 'verify_payment')
    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_checking_returns_the_ticket_as_it_now_stands(self, _, mock_verify, __):
        self.client.force_authenticate(self.ada)
        self.client.post(self.checkout)
        mock_verify.return_value = {'status': True, 'data': charge(Payment.objects.get())}

        response = self.client.post(
            f'/api/v1/payments/registrations/{self.registration.pk}/check/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['payment_status'], 'paid')
        self.assertFalse(response.data['can_pay'])
        self.assertIsNone(response.data['pay_token'])


@paystack_test_keys
@override_settings(PUBLIC_API_URL='https://api.example.com')
class PayerPagesTests(TestCase):
    """The pages a parent opens: no login, and nothing happens until Pay is pressed."""

    def setUp(self):
        self.registration = unpaid(paid_event())
        self.link = f'/api/v1/payments/pay/{registrations.pay_token(self.registration)}/'

    @patch.object(PaystackService, 'initialize_payment')
    def test_opening_the_link_shows_what_is_owed_and_opens_no_checkout(self, mock_open):
        response = self.client.get(self.link)

        self.assertContains(response, 'Teens Conference')
        self.assertContains(response, 'Ada Obi')
        self.assertContains(response, '5,000')
        mock_open.assert_not_called()
        self.assertFalse(Payment.objects.exists())

    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_pressing_pay_goes_to_paystack(self, _):
        response = self.client.post(self.link)

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response['Location'].startswith('https://checkout.paystack.com/'))

    def test_a_link_that_was_altered_does_not_work(self):
        response = self.client.get(self.link[:-3] + 'xx/')

        self.assertEqual(response.status_code, 404)

    def test_a_paid_registration_says_so(self):
        EventRegistration.objects.filter(pk=self.registration.pk).update(payment_status=Paid.PAID)

        self.assertContains(self.client.get(self.link), 'Already paid')

    @patch('events.email_service.EventEmailService.send_registration_confirmed')
    @patch.object(PaystackService, 'verify_payment')
    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_coming_back_from_paystack_confirms_and_offers_the_way_back(self, _, mock_verify, __):
        payment = registrations.start(
            self.registration, CALLBACK, return_to='faithtribe://ticket/abc')
        mock_verify.return_value = {'status': True, 'data': charge(payment)}

        response = self.client.get('/api/v1/payments/return/', {'reference': payment.reference})

        self.assertContains(response, 'Payment received')
        self.assertContains(response, 'faithtribe://ticket/abc')
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.payment_status, Paid.PAID)

    @patch.object(PaystackService, 'verify_payment')
    @patch.object(PaystackService, 'initialize_payment', side_effect=paystack_opens())
    def test_coming_back_before_the_bank_has_answered(self, _, mock_verify):
        payment = registrations.start(self.registration, CALLBACK)
        mock_verify.return_value = {
            'status': True, 'data': charge(payment, status='abandoned')}

        response = self.client.get('/api/v1/payments/return/', {'reference': payment.reference})

        self.assertContains(response, 'waiting to hear from your bank')

    def test_an_unknown_reference(self):
        response = self.client.get('/api/v1/payments/return/', {'reference': 'NOPE'})

        self.assertEqual(response.status_code, 404)
