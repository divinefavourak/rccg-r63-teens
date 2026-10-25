"""
Paying by bank transfer: a coordinator sends a receipt, someone who
reconciles that part of the church checks it, and only then is the money
recorded and the seats confirmed. Also a group paid through the gateway.
"""
import io
import shutil
import tempfile
from datetime import date, timedelta
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APITestCase

from events import batches
from events.models import Event, EventRegistration, RegistrationBatch
from events.test_batches import PRICE, grant, group_event
from events.test_registration_counters import make_registration
from identity.models import Permission, Role, RolePermission
from identity.tests.base import build_tree, make_user, seed_rbac
from payments import receipts, registrations
from payments.models import Payment, PaymentReceipt
from payments.services import SquadService
from payments.tests import squad_signature, squad_test_keys, squad_webhook

Status = EventRegistration.Status
Paid = EventRegistration.PaymentStatus
BatchStatus = RegistrationBatch.Status

class TempReceiptStorage:
    """
    Receipts go to a temporary folder for the class, not `PRIVATE_MEDIA_ROOT`.
    `override_settings` cannot do this: the field's storage was built when the
    model was imported.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._folder = tempfile.mkdtemp(prefix='receipts-test-')
        field = PaymentReceipt._meta.get_field('file')
        cls._storage = field.storage
        field.storage = FileSystemStorage(location=cls._folder)

    @classmethod
    def tearDownClass(cls):
        PaymentReceipt._meta.get_field('file').storage = cls._storage
        shutil.rmtree(cls._folder, ignore_errors=True)
        super().tearDownClass()


def png(name='receipt.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (200, 200), 'white').save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


def pdf(name='receipt.pdf', body=b'%PDF-1.4\n%fake\n'):
    return SimpleUploadedFile(name, body, content_type='application/pdf')


def manual_event(**kwargs):
    return group_event(
        payment_method=Event.PaymentMethod.MANUAL, bank_name='Zenith Bank',
        bank_account_number='1234567890', bank_account_name='RCCG Teens', **kwargs)


class ReceiptTestCase(TempReceiptStorage, TestCase):
    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        self.coordinator = make_user('coord')
        grant(self.coordinator, 'province_coordinator', self.tree['prov'])
        self.regional = make_user('regional')
        grant(self.regional, 'regional_coordinator', self.tree['r1'])
        self.event = manual_event()
        self.batch = batches.create(self.coordinator, self.event, self.tree['prov'], 2, 1)

    def send(self, amount=PRICE * 3, file=None, **kwargs):
        return receipts.submit(
            self.coordinator, self.batch, amount=amount, paid_on=date.today(),
            file=file or png(), **kwargs)

    def batch_now(self):
        return RegistrationBatch.objects.get(pk=self.batch.pk)


class SubmitTests(ReceiptTestCase):
    def test_a_receipt_puts_the_group_under_review(self):
        receipt = self.send(bank_reference='TRF123')
        self.assertEqual(receipt.status, PaymentReceipt.Status.SUBMITTED)
        self.assertEqual(len(receipt.file_sha256), 64)
        self.assertEqual(self.batch_now().status, BatchStatus.UNDER_REVIEW)
        # Nothing is paid until someone checks it.
        self.assertFalse(Payment.objects.exists())
        self.assertTrue(all(s.payment_status == Paid.PENDING for s in self.batch.seats.all()))

    def test_not_for_an_event_paid_online(self):
        online = group_event(title='Online Camp')
        batch = batches.create(self.coordinator, online, self.tree['prov'], 1, 0)
        with self.assertRaisesMessage(receipts.ReceiptError, 'paid for online'):
            receipts.submit(self.coordinator, batch, amount=PRICE, paid_on=date.today(), file=png())

    def test_files_that_are_not_receipts_are_refused(self):
        with self.assertRaisesMessage(receipts.ReceiptError, 'not a PDF'):
            self.send(file=pdf(body=b'MZ not a pdf'))
        with self.assertRaisesMessage(receipts.ReceiptError, 'not a picture'):
            self.send(file=SimpleUploadedFile('r.png', b'nope', content_type='image/png'))
        with self.assertRaisesMessage(receipts.ReceiptError, 'JPG, PNG'):
            self.send(file=SimpleUploadedFile('r.exe', b'%PDF-', content_type='application/pdf'))
        with override_settings(MAX_RECEIPT_SIZE=10):
            with self.assertRaisesMessage(receipts.ReceiptError, 'larger than'):
                self.send(file=pdf())

    def test_the_stored_type_comes_from_the_file_not_the_browser(self):
        lying = pdf(body=b'%PDF-1.4\n<html><script>alert(1)</script></html>')
        lying.content_type = 'text/html'
        receipt = self.send(file=lying)
        self.assertEqual(receipt.file_type, 'application/pdf')
        disguised = png(name='receipt.png')
        disguised.content_type = 'text/html'
        self.assertEqual(self.send(file=disguised).file_type, 'image/png')

    def test_a_group_cannot_be_cancelled_while_a_receipt_is_checked(self):
        self.send()
        with self.assertRaisesMessage(batches.BatchError, 'being checked'):
            batches.cancel(self.coordinator, self.batch)
        self.assertEqual(self.batch_now().status, BatchStatus.UNDER_REVIEW)

    def test_a_future_date_is_refused(self):
        with self.assertRaisesMessage(receipts.ReceiptError, 'future'):
            receipts.submit(self.coordinator, self.batch, amount=PRICE,
                            paid_on=date.today() + timedelta(days=2), file=png())

    def test_someone_who_does_not_run_the_group_cannot_send_one(self):
        stranger = make_user('stranger')
        with self.assertRaisesMessage(receipts.ReceiptError, 'cannot send'):
            receipts.submit(stranger, self.batch, amount=PRICE, paid_on=date.today(), file=png())

    def test_the_same_receipt_twice_is_flagged(self):
        first = self.send(file=pdf(), bank_reference='TRF-9')
        second = batches.create(self.coordinator, self.event, self.tree['prov'], 1, 0)
        again = receipts.submit(self.coordinator, second, amount=PRICE, paid_on=date.today(),
                                file=pdf(), bank_reference='trf-9')
        self.assertEqual(list(receipts.duplicates(again)), [first])


class VerifyTests(ReceiptTestCase):
    def test_the_full_amount_confirms_every_seat(self):
        receipt = self.send()
        with self.captureOnCommitCallbacks(execute=True):
            receipts.verify(self.regional, receipt)

        batch = self.batch_now()
        self.assertEqual(batch.status, BatchStatus.PAID)
        self.assertEqual(batch.amount_paid, PRICE * 3)
        payment = Payment.objects.get()
        self.assertEqual(payment.status, Payment.Status.SUCCESS)
        self.assertEqual(payment.channel, 'manual_transfer')
        self.assertEqual(payment.batch, batch)
        receipt.refresh_from_db()
        self.assertEqual(receipt.payment, payment)
        for seat in batch.seats.all():
            self.assertEqual(seat.payment_status, Paid.PAID)
            self.assertEqual(seat.status, Status.CONFIRMED)
        self.event.refresh_from_db()
        self.assertEqual(self.event.registration_count, 3)

    def test_the_coordinator_is_emailed_at_the_address_given_with_the_group(self):
        RegistrationBatch.objects.filter(pk=self.batch.pk).update(
            contact_email='working@example.com')
        receipt = self.send()
        with patch('events.email_service._send_in_thread') as sent, \
                self.captureOnCommitCallbacks(execute=True):
            receipts.verify(self.regional, receipt)
        recipients = [call.args[2] for call in sent.call_args_list]
        self.assertIn(['working@example.com'], recipients)
        self.assertNotIn([self.coordinator.email], recipients)
        self.assertEqual(Payment.objects.get().payer_email, 'working@example.com')

    def test_part_of_the_money_then_the_rest(self):
        receipts.verify(self.regional, self.send(amount=PRICE * 3), amount=PRICE)
        batch = self.batch_now()
        self.assertEqual(batch.status, BatchStatus.PART_PAID)
        self.assertEqual(batch.balance, PRICE * 2)
        self.assertTrue(all(s.status == Status.PENDING for s in batch.seats.all()))

        receipts.verify(self.regional, self.send(amount=PRICE * 2))
        self.assertEqual(self.batch_now().status, BatchStatus.PAID)

    def test_rejecting_sends_the_group_back_to_waiting(self):
        receipt = self.send()
        with self.assertRaisesMessage(receipts.ReceiptError, 'Say why'):
            receipts.reject(self.regional, receipt, reason=' ')
        receipts.reject(self.regional, receipt, reason='Nothing arrived on that date.')
        receipt.refresh_from_db()
        self.assertEqual(receipt.status, PaymentReceipt.Status.REJECTED)
        self.assertEqual(self.batch_now().status, BatchStatus.AWAITING_PAYMENT)
        with self.assertRaisesMessage(receipts.ReceiptError, 'already been rejected'):
            receipts.verify(self.regional, receipt)

    def test_only_a_reconciler_over_that_province_may_check_it(self):
        receipt = self.send()
        with self.assertRaisesMessage(receipts.ReceiptError, 'cannot verify'):
            receipts.verify(self.coordinator, receipt)
        elsewhere = make_user('elsewhere')
        grant(elsewhere, 'regional_coordinator', self.tree['r2'])
        with self.assertRaisesMessage(receipts.ReceiptError, 'cannot verify'):
            receipts.verify(elsewhere, receipt)
        national = make_user('national')
        grant(national, 'national_coordinator', self.tree['national'])
        receipts.verify(national, receipt)

    def test_a_single_registration_on_a_manual_event(self):
        teen = make_user('ada')
        registration = make_registration(
            self.event, email=teen.email, user=teen, payment_status=Paid.PENDING,
            amount_due=PRICE)
        receipt = receipts.submit(teen, registration, amount=PRICE, paid_on=date.today(), file=png())
        # It has no place in the tree, so it is checked by someone who holds
        # the permission over the whole of it.
        with self.assertRaisesMessage(receipts.ReceiptError, 'cannot verify'):
            receipts.verify(self.regional, receipt)
        national = make_user('national')
        grant(national, 'national_coordinator', self.tree['national'])
        with self.captureOnCommitCallbacks(execute=True):
            receipts.verify(national, receipt)
        registration.refresh_from_db()
        self.assertEqual(registration.payment_status, Paid.PAID)
        self.assertEqual(registration.status, Status.CONFIRMED)

    def test_reviewers_are_the_reconcilers_above_the_node(self):
        emails = {u.email for u in receipts.reviewers(self.tree['prov'])}
        self.assertIn(self.regional.email, emails)
        self.assertNotIn(self.coordinator.email, emails)


class HoldTests(ReceiptTestCase):
    @squad_test_keys
    def test_unpaid_seats_and_manual_events_are_not_given_up(self):
        online = group_event(title='Online Camp')
        mine = make_registration(online, email='late@example.com', payment_status=Paid.PENDING,
                                 amount_due=PRICE)
        online_batch = batches.create(self.coordinator, online, self.tree['prov'], 1, 0)
        transfer = make_registration(self.event, email='t@example.com',
                                     payment_status=Paid.PENDING, amount_due=PRICE)
        old = registrations.timezone.now() - timedelta(hours=100)
        EventRegistration.objects.update(created_at=old)

        self.assertEqual(registrations.expire_unpaid(), 1)
        mine.refresh_from_db()
        transfer.refresh_from_db()
        self.assertEqual(mine.status, Status.CANCELLED)
        self.assertEqual(transfer.status, Status.PENDING)
        self.assertFalse(online_batch.seats.filter(status=Status.CANCELLED).exists())

    def test_no_gateway_checkout_for_a_seat_or_a_manual_event(self):
        seat = self.batch.seats.first()
        self.assertIn('paid for with its group', registrations.refusal(seat))
        alone = make_registration(self.event, email='x@example.com', payment_status=Paid.PENDING,
                                  amount_due=PRICE)
        self.assertIn('bank transfer', registrations.refusal(alone))


class ReceiptApiTests(TempReceiptStorage, APITestCase):
    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        self.coordinator = make_user('coord')
        grant(self.coordinator, 'province_coordinator', self.tree['prov'])
        self.regional = make_user('regional')
        grant(self.regional, 'regional_coordinator', self.tree['r1'])
        self.event = manual_event()
        self.batch = batches.create(self.coordinator, self.event, self.tree['prov'], 1, 1)

    def upload(self, **extra):
        self.client.force_authenticate(self.coordinator)
        return self.client.post('/api/v1/payments/receipts/', {
            'batch': str(self.batch.id), 'amount': '20000', 'paid_on': date.today().isoformat(),
            'bank_reference': 'TRF1', 'file': png(), **extra,
        }, format='multipart')

    def test_send_check_and_reconcile(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.data)
        receipt_id = response.data['id']
        self.assertEqual(response.data['target']['reference'], self.batch.reference)

        # The coordinator cannot verify their own receipt.
        response = self.client.post(f'/api/v1/payments/receipts/{receipt_id}/verify/')
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(self.regional)
        waiting = self.client.get('/api/v1/payments/receipts/', {'status': 'submitted'})
        items = waiting.data['results'] if 'results' in waiting.data else waiting.data
        self.assertEqual([r['id'] for r in items], [receipt_id])

        file = self.client.get(f'/api/v1/payments/receipts/{receipt_id}/file/')
        self.assertEqual(file.status_code, 200)
        self.assertEqual(file['Cache-Control'], 'private, no-store')
        self.assertTrue(b''.join(file.streaming_content).startswith(b'\x89PNG'))

        response = self.client.post(
            f'/api/v1/payments/receipts/{receipt_id}/verify/', {'amount': '20000'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'verified')

        summary = self.client.get('/api/v1/payments/reconciliation/', {'event': str(self.event.id)})
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(summary.data['summary']['expected'], '20000.00')
        self.assertEqual(summary.data['summary']['received_manual'], '20000.00')
        self.assertEqual(summary.data['summary']['outstanding'], '0.00')
        self.assertEqual(len(summary.data['ledger']), 1)
        csv = self.client.get('/api/v1/payments/reconciliation/',
                              {'event': str(self.event.id), 'export': 'csv'})
        self.assertIn(self.batch.reference, csv.content.decode('utf-8'))

    def test_an_unchecked_type_is_only_ever_downloaded(self):
        receipt_id = self.upload().data['id']
        PaymentReceipt.objects.filter(pk=receipt_id).update(file_type='text/html')
        self.client.force_authenticate(self.regional)
        response = self.client.get(f'/api/v1/payments/receipts/{receipt_id}/file/')
        self.assertEqual(response['Content-Type'], 'application/octet-stream')
        self.assertIn('attachment', response['Content-Disposition'])

    def test_claim_codes_are_for_the_groups_coordinators_only(self):
        self.client.force_authenticate(self.coordinator)
        mine = self.client.get(f'/api/v1/events/batches/{self.batch.id}/')
        self.assertTrue(all(seat['claim_code'] for seat in mine.data['seats']))
        viewer = make_user('viewer')
        role = Role.objects.create(code='payments_viewer', label='Payments viewer',
                                   allowed_node_types=['region'])
        RolePermission.objects.create(
            role=role, permission=Permission.objects.get(code='payments.reconcile'))
        grant(viewer, 'payments_viewer', self.tree['r1'])
        self.client.force_authenticate(viewer)
        theirs = self.client.get(f'/api/v1/events/batches/{self.batch.id}/')
        self.assertEqual(theirs.status_code, 200)
        self.assertTrue(all('claim_code' not in seat for seat in theirs.data['seats']))

    def test_ids_that_are_not_ids(self):
        self.client.force_authenticate(self.coordinator)
        self.assertEqual(self.client.get('/api/v1/events/batches/not-an-id/').status_code, 404)
        response = self.client.get('/api/v1/payments/receipts/', {'event': 'abc'})
        self.assertEqual(response.status_code, 400)

    def test_the_file_is_hidden_from_everyone_else(self):
        receipt_id = self.upload().data['id']
        stranger = make_user('stranger')
        self.client.force_authenticate(stranger)
        self.assertEqual(
            self.client.get(f'/api/v1/payments/receipts/{receipt_id}/file/').status_code, 404)
        elsewhere = make_user('elsewhere')
        grant(elsewhere, 'regional_coordinator', self.tree['r2'])
        self.client.force_authenticate(elsewhere)
        self.assertEqual(
            self.client.get(f'/api/v1/payments/receipts/{receipt_id}/file/').status_code, 404)
        self.assertEqual(
            self.client.post(f'/api/v1/payments/receipts/{receipt_id}/verify/').status_code, 404)

    def test_a_province_coordinator_sees_status_but_not_the_reconciliation_of_others(self):
        self.client.force_authenticate(make_user('teen'))
        response = self.client.get('/api/v1/payments/reconciliation/', {'event': str(self.event.id)})
        self.assertEqual(response.status_code, 403)


@squad_test_keys
class OnlineBatchTests(APITestCase):
    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        self.coordinator = make_user('coord')
        grant(self.coordinator, 'province_coordinator', self.tree['prov'])
        self.event = group_event()
        self.batch = batches.create(self.coordinator, self.event, self.tree['prov'], 1, 1)

    @patch.object(SquadService, 'open_checkout',
                  side_effect=lambda reference, **_: f'https://sandbox-pay.squadco.com/{reference}')
    def test_the_gateway_pays_for_the_whole_group(self, opened):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(f'/api/v1/payments/batches/{self.batch.id}/checkout/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['amount'], '20000.00')
        # A second tap reopens the same checkout.
        again = self.client.post(f'/api/v1/payments/batches/{self.batch.id}/checkout/')
        self.assertEqual(again.data['reference'], response.data['reference'])
        self.assertEqual(opened.call_count, 1)

        body = squad_webhook(response.data['reference'], amount=2000000)
        with self.captureOnCommitCallbacks(execute=True):
            hook = self.client.post('/api/v1/payments/webhook', data=body,
                                    content_type='application/json',
                                    HTTP_X_SQUAD_ENCRYPTED_BODY=squad_signature(body))
        self.assertEqual(hook.status_code, 200)
        batch = RegistrationBatch.objects.get(pk=self.batch.pk)
        self.assertEqual(batch.status, BatchStatus.PAID)
        self.assertTrue(all(s.status == Status.CONFIRMED for s in batch.seats.all()))

    def test_a_manual_event_has_no_gateway_checkout(self):
        Event.objects.filter(pk=self.event.pk).update(
            payment_method=Event.PaymentMethod.MANUAL, bank_name='Z',
            bank_account_number='1', bank_account_name='R')
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(f'/api/v1/payments/batches/{self.batch.id}/checkout/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('bank transfer', response.data['detail'])
