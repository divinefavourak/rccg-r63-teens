"""The Termii SMS sender: what it posts, what it does on a refusal, and how the
OTP provider behaves when it is switched on."""
from unittest.mock import Mock, patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from backend.sms_backend import send_termii_sms
from users.otp_providers import EmailAndSmsOTPProvider

MESSAGE = 'Your Faith Tribe code is 482915. It expires in 10 minutes.'
TERMII = dict(
    TERMII_API_KEY='test-key',
    TERMII_BASE_URL='https://example.api.termii.com/',
    TERMII_SENDER_ID='FaithTribe',
    TERMII_SMS_CHANNEL='dnd',
)


@override_settings(**TERMII)
class SendTermiiSmsTests(SimpleTestCase):

    @patch('backend.sms_backend.requests.post')
    def test_it_posts_the_message_to_termii(self, post):
        post.return_value = Mock(status_code=200, text='{"code": "ok"}')

        send_termii_sms('+2348031234567', MESSAGE)

        (url,), kwargs = post.call_args
        self.assertEqual(url, 'https://example.api.termii.com/api/sms/send')
        self.assertEqual(kwargs['json'], {
            'api_key': 'test-key',
            'to': '2348031234567',
            'from': 'FaithTribe',
            'sms': MESSAGE,
            'type': 'plain',
            'channel': 'dnd',
        })

    @patch('backend.sms_backend.requests.post')
    def test_a_refusal_raises(self, post):
        post.return_value = Mock(status_code=400, text='{"message": "Insufficient balance"}')

        with self.assertRaises(RuntimeError) as raised:
            send_termii_sms('+2348031234567', MESSAGE)

        self.assertIn('Insufficient balance', str(raised.exception))
        self.assertNotIn('482915', str(raised.exception))
        self.assertNotIn('test-key', str(raised.exception))

    @patch('backend.sms_backend.requests.post', side_effect=OSError('no route'))
    def test_no_connection_raises(self, post):
        with self.assertRaises(OSError):
            send_termii_sms('+2348031234567', MESSAGE)

    @patch('backend.sms_backend.requests.post')
    def test_without_a_key_or_base_url_nothing_is_posted(self, post):
        for missing in ('TERMII_API_KEY', 'TERMII_BASE_URL'):
            with self.subTest(missing=missing), override_settings(**{missing: ''}):
                with self.assertRaises(ImproperlyConfigured):
                    send_termii_sms('+2348031234567', MESSAGE)

        post.assert_not_called()


@override_settings(
    OTP_SMS_BACKEND='backend.sms_backend.send_termii_sms',
    OTP_TTL_SECONDS=600,
    **TERMII,
)
class OtpProviderOverTermiiTests(SimpleTestCase):

    @patch('backend.sms_backend.requests.post')
    def test_an_sms_code_goes_out_through_termii(self, post):
        post.return_value = Mock(status_code=200, text='{"code": "ok"}')

        EmailAndSmsOTPProvider().send('+2348031234567', 'sms', '482915', 'verify')

        body = post.call_args.kwargs['json']
        self.assertEqual(body['to'], '2348031234567')
        self.assertEqual(body['sms'], MESSAGE)

    @patch('backend.sms_backend.requests.post')
    def test_a_termii_refusal_does_not_break_the_send(self, post):
        post.return_value = Mock(status_code=400, text='{"message": "Insufficient balance"}')

        with self.assertLogs('users.otp_providers', level='ERROR') as logs:
            EmailAndSmsOTPProvider().send('+2348031234567', 'sms', '482915', 'verify')

        self.assertIn('***4567', logs.output[0])
        self.assertNotIn('2348031234567', logs.output[0])
