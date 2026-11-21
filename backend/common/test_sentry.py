"""Tests for `common.sentry`: personal details never leave for Sentry."""
from unittest import mock

from django.test import SimpleTestCase

from common import sentry
from common.sentry import EMAIL_MARK, PHONE_MARK, scrub_event, scrub_log, scrub_text


class ScrubTextTests(SimpleTestCase):
    def test_email_addresses_are_blanked(self):
        self.assertEqual(
            scrub_text("Email failed to ['mum.ade@gmail.com', teen_1@yahoo.co.uk]"),
            f"Email failed to ['{EMAIL_MARK}', {EMAIL_MARK}]",
        )

    def test_nigerian_phone_numbers_are_blanked(self):
        for number in ('08031234567', '+2348031234567', '2349061234567', '0803 123 4567', '+234-803-123-4567'):
            with self.subTest(number=number):
                self.assertEqual(scrub_text(f'SMS to {number} failed'), f'SMS to {PHONE_MARK} failed')

    def test_other_numbers_are_left_alone(self):
        # Ids, amounts, timestamps and references must stay readable.
        for text in ('Batch GRP-20261121-0042', 'Paid 15000 for 3 seats', '1795243744.431109', 'row 080'):
            with self.subTest(text=text):
                self.assertEqual(scrub_text(text), text)


class ScrubEventTests(SimpleTestCase):
    def test_messages_and_local_variables_are_scrubbed(self):
        event = {
            'logentry': {'message': 'Email failed to %s', 'params': ['a@b.com'], 'formatted': 'Email failed to a@b.com'},
            'exception': {'values': [{
                'value': 'Could not reach 08031234567',
                'stacktrace': {'frames': [{'vars': {'recipients': ['a@b.com'], 'count': 2, 'ok': None}}]},
            }]},
            'tags': ('x@y.org',),
        }

        scrubbed = scrub_event(event, {})

        self.assertEqual(scrubbed['logentry']['params'], [EMAIL_MARK])
        self.assertEqual(scrubbed['logentry']['formatted'], f'Email failed to {EMAIL_MARK}')
        self.assertEqual(scrubbed['logentry']['message'], 'Email failed to %s')
        exc = scrubbed['exception']['values'][0]
        self.assertEqual(exc['value'], f'Could not reach {PHONE_MARK}')
        self.assertEqual(exc['stacktrace']['frames'][0]['vars'], {'recipients': [EMAIL_MARK], 'count': 2, 'ok': None})
        self.assertEqual(scrubbed['tags'], (EMAIL_MARK,))

    def test_a_log_is_scrubbed(self):
        log = {'body': 'Could not email kid@school.ng', 'attributes': {'sentry.message.parameter.0': 'kid@school.ng'}}
        scrubbed = scrub_log(log, {})
        self.assertEqual(scrubbed['body'], f'Could not email {EMAIL_MARK}')
        self.assertEqual(scrubbed['attributes']['sentry.message.parameter.0'], EMAIL_MARK)

    def test_a_failure_drops_the_report_rather_than_sending_it_unscrubbed(self):
        with mock.patch.object(sentry, '_scrub', side_effect=RuntimeError):
            self.assertIsNone(scrub_event({'message': 'a@b.com'}, {}))
            self.assertIsNone(scrub_log({'body': 'a@b.com'}, {}))
