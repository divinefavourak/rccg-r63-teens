"""The HTTPS mail backend: what it sends to Brevo, and what it does on a refusal."""
from unittest.mock import Mock, patch

from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase, override_settings

from backend.email_backend import BrevoApiEmailBackend


def message():
    mail = EmailMultiAlternatives(
        subject='Your Faith Tribe code',
        body='Your code is 482915.',
        from_email='RCCG Junior Church <rccgjuniorchurch@thefaithtribe.live>',
        to=['teen@example.com'],
    )
    mail.attach_alternative('<p>Your code is <b>482915</b>.</p>', 'text/html')
    return mail


@override_settings(BREVO_API_KEY='test-key')
class BrevoApiEmailBackendTests(SimpleTestCase):

    @patch('backend.email_backend.requests.post')
    def test_it_posts_the_message_to_brevo(self, post):
        post.return_value = Mock(status_code=201, text='{"messageId": "x"}')

        sent = BrevoApiEmailBackend().send_messages([message()])

        self.assertEqual(sent, 1)
        (url,), kwargs = post.call_args
        self.assertEqual(url, 'https://api.brevo.com/v3/smtp/email')
        self.assertEqual(kwargs['headers']['api-key'], 'test-key')
        self.assertEqual(kwargs['json']['sender'], {
            'name': 'RCCG Junior Church', 'email': 'rccgjuniorchurch@thefaithtribe.live'})
        self.assertEqual(kwargs['json']['to'], [{'email': 'teen@example.com'}])
        self.assertEqual(kwargs['json']['subject'], 'Your Faith Tribe code')
        self.assertIn('482915', kwargs['json']['htmlContent'])
        self.assertIn('482915', kwargs['json']['textContent'])

    @patch('backend.email_backend.requests.post')
    def test_a_refusal_is_reported_as_nothing_sent(self, post):
        post.return_value = Mock(status_code=401, text='{"message": "Key not found"}')

        sent = BrevoApiEmailBackend(fail_silently=True).send_messages([message()])

        self.assertEqual(sent, 0)

    @patch('backend.email_backend.requests.post')
    def test_a_refusal_raises_when_asked_to(self, post):
        post.return_value = Mock(status_code=401, text='{"message": "Key not found"}')

        with self.assertRaises(RuntimeError):
            BrevoApiEmailBackend(fail_silently=False).send_messages([message()])

    @patch('backend.email_backend.requests.post', side_effect=OSError('no route'))
    def test_no_connection_is_reported_as_nothing_sent(self, post):
        sent = BrevoApiEmailBackend(fail_silently=True).send_messages([message()])

        self.assertEqual(sent, 0)
