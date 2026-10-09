"""Deleting an account from the Console: what is refused and what is cleaned up."""
from rest_framework.test import APITestCase

from events.models import EventRegistration
from events.test_registration_counters import make_event, make_registration
from users.models import User

Status = EventRegistration.Status
Payment = EventRegistration.PaymentStatus


class DeleteUserTests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='admin', email='admin@example.com', password='x')
        self.target = User.objects.create_user(
            username='test1', email='test1@example.com', password='x')
        self.client.force_authenticate(self.admin)

    def delete(self, user):
        return self.client.delete(f'/api/v1/auth/users/{user.pk}/')

    def test_an_account_is_deleted(self):
        self.assertEqual(self.delete(self.target).status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.target.pk).exists())

    def test_you_cannot_delete_yourself(self):
        self.assertEqual(self.delete(self.admin).status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_someone_without_the_permission_is_refused(self):
        other = User.objects.create_user(
            username='other', email='other@example.com', password='x')
        self.client.force_authenticate(other)
        self.assertIn(self.delete(self.target).status_code, (403, 404))
        self.assertTrue(User.objects.filter(pk=self.target.pk).exists())

    def test_a_place_they_held_is_cancelled_and_the_row_kept(self):
        registration = make_registration(
            make_event(), email=self.target.email, user=self.target)
        self.assertEqual(self.delete(self.target).status_code, 204)
        registration.refresh_from_db()
        self.assertEqual(registration.status, Status.CANCELLED)
        self.assertIsNone(registration.user)

    def test_someone_who_has_paid_is_not_deleted(self):
        event = make_event(is_free=False, price=5000)
        make_registration(event, email=self.target.email, user=self.target,
                          payment_status=Payment.PAID)
        response = self.delete(self.target)
        self.assertEqual(response.status_code, 409)
        self.assertIn('Deactivate', response.data['detail'])
        self.assertTrue(User.objects.filter(pk=self.target.pk).exists())
