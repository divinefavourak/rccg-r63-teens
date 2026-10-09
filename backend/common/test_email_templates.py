"""
Every email template renders with the context its sender passes.

The senders live in four apps (users, events, tickets, content) and build
their contexts by hand, so a template that names a variable or filter that
is not there only fails when a real email goes out. These render each one
with a stand-in of exactly what its sender passes, and check the plain-text
part keeps the links people need.
"""
from datetime import date, datetime, timezone as dt_timezone
from decimal import Decimal
from types import SimpleNamespace

from django.template.loader import render_to_string
from django.test import SimpleTestCase

from utils.email_text import html_to_text

FRONTEND = 'https://faithtribe.live'
LOGOS = {
    'logo_url': 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/logo.jpg',
    'faith_logo_url': 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/faith_logo.jpg',
}
AVATAR = 'https://api.dicebear.com/8.x/open-peeps/png?seed=ada&size=100'


def _user():
    return SimpleNamespace(
        username='ada_o', email='ada@example.com', province='lagos_province_9',
        get_role_display=lambda: 'Coordinator',
        get_province_display=lambda: 'Lagos Province 9',
        get_display_name=lambda: 'Ada Okafor',
    )


def _event():
    return SimpleNamespace(
        title='Teens Camp 2026', slug='teens-camp-2026',
        # 09:00 UTC is 10:00 in Lagos, which is what the email should print.
        start_datetime=datetime(2026, 12, 18, 9, 0, tzinfo=dt_timezone.utc),
        end_datetime=datetime(2026, 12, 20, 15, 0, tzinfo=dt_timezone.utc),
        venue='Redemption Camp', city='Mowe', state='Ogun',
    )


def _registration(name='Ada Okafor', reg_id='CAMP-20261218-00001', category='Teen'):
    return SimpleNamespace(
        attendee_name=name, registration_id=reg_id, attendee_category=category,
        event=_event(),
    )


def _registration_context():
    """What events.email_service._base_context builds."""
    return {
        'event': _event(),
        'ticket_id': 'CAMP-20261218-00001',
        'full_name': 'Ada Okafor',
        'category': 'Teen',
        'registered_at': datetime(2026, 10, 3, 14, 30, tzinfo=dt_timezone.utc),
        'registration_url': f'{FRONTEND}/events/teens-camp-2026/registration/CAMP-20261218-00001',
        'avatar_url': AVATAR,
        'frontend_url': FRONTEND,
        'parish': 'Grace Parish',
        'amount_due': Decimal('15000'),
        'bed_note': '',
        'waitlisted': False,
        **LOGOS,
    }


def _ticket(name='Tobi Adeyemi', ticket_id='R63-0042'):
    return SimpleNamespace(full_name=name, ticket_id=ticket_id, get_category_display=lambda: 'Teen')


def sample_contexts():
    """Template name -> the context its sender passes. Also used for previews."""
    user = _user()
    user_base = {'frontend_url': FRONTEND, 'avatar_url': AVATAR, **LOGOS}
    ticket_base = {'full_name': 'Tobi Adeyemi', 'ticket_id': 'R63-0042', 'frontend_url': FRONTEND, **LOGOS}
    devotional = SimpleNamespace(
        title='Shine Where You Are', slug='shine-where-you-are', date=date(2026, 10, 3),
        cover_image=None, author='Pastor E. A. Adeboye',
        memory_verse_passage='Matthew 5:16',
        memory_verse_content='Let your light so shine before men, that they may see your good works.',
        bible_text_passage='Matthew 5:13-16',
        bible_text_content='Ye are the salt of the earth: but if the salt have lost his savour, '
                           'wherewith shall it be salted?',
        content='<p>You do not need a stage to shine. ' + 'Small faithful acts matter. ' * 30 + '</p>',
        key_point='Your everyday kindness is a sermon people can see.',
        bible_in_one_year='Isaiah 1-3',
    )
    payment = SimpleNamespace(
        payer_name='Mrs Okafor', reference='PAY-7F3K29', amount=Decimal('15000'),
        payment_method='bank_transfer', completed_at=datetime(2026, 10, 3, 11, 5, tzinfo=dt_timezone.utc),
        get_status_display=lambda: 'Completed', ticket=_ticket(), metadata={},
    )
    return {
        'otp_code': {**LOGOS, 'frontend_url': FRONTEND, 'code': '482913', 'minutes': 10, 'is_login': True},
        'account_welcome': {**user_base, 'user': user, 'full_name': 'Ada Okafor', 'login_url': f'{FRONTEND}/login'},
        'account_created': {
            **user_base, 'user': user, 'full_name': 'Ada Okafor', 'username': 'ada_o', 'role': 'Coordinator',
            'created_by': SimpleNamespace(get_display_name=lambda: 'Pastor Femi'),
            'set_password_url': f'{FRONTEND}/set-password?uid=MQ&token=abc-123',
        },
        'password_changed': {**user_base, 'user': user, 'full_name': 'Ada Okafor'},
        'password_reset': {
            **user_base, 'user': user, 'full_name': 'Ada Okafor',
            'reset_url': f'{FRONTEND}/reset-password?uid=MQ&token=abc-123',
        },
        'daily_devotional': {
            'devotional': devotional, 'devotional_url': f'{FRONTEND}/devotional/shine-where-you-are',
            'frontend_url': FRONTEND, **LOGOS,
        },
        'ticket_confirmation': _registration_context(),
        'ticket_approved': {**_registration_context(), 'qr_code_base64': 'iVBORw0KGgo='},
        'status_update': {**_registration_context(), 'old_status': 'pending', 'new_status': 'waitlisted'},
        'bulk_registration_confirmation': {
            'coordinator_name': 'Bro. Segun', 'ticket_count': 3, 'event': _event(),
            'registrations': [
                _registration(),
                _registration('Chidi Eze', 'CAMP-20261218-00002', 'Teen'),
                _registration('Zainab Bello', 'CAMP-20261218-00003', 'Teacher'),
            ],
            'frontend_url': FRONTEND, **LOGOS,
        },
        'bulk_ticket_confirmation': {
            'coordinator_name': 'Bro. Segun', 'ticket_count': 3,
            'tickets_by_category': {
                'Teen': [_ticket(), _ticket('Chidi Eze', 'R63-0043')],
                'Teacher': [_ticket('Zainab Bello', 'R63-0044')],
            },
        },
        'batch_status_update': {
            'tickets': [_ticket(), _ticket('Chidi Eze', 'R63-0043')], 'status': 'APPROVED',
            'coordinator_name': 'Bro. Segun', 'ticket_count': 2,
        },
        'payment_confirmation': {'payment': payment},
        'payment_reminder': ticket_base,
        'welcome_email': ticket_base,
        'final_instructions': {**ticket_base, 'event_location': 'Redemption City'},
    }


class EmailTemplateRenderTests(SimpleTestCase):
    def test_every_template_renders(self):
        for name, context in sample_contexts().items():
            with self.subTest(template=name):
                html = render_to_string(f'emails/{name}.html', context)
                self.assertIn('Faith Tribe', html)
                self.assertNotIn('{{', html)
                self.assertNotIn('{%', html)

    def test_event_times_are_shown_in_lagos_time(self):
        html = render_to_string('emails/ticket_confirmation.html', _registration_context())
        self.assertIn('10:00 AM', html)

    def test_registration_received_carries_the_details(self):
        context = {
            **_registration_context(),
            'parish': 'Grace Parish', 'amount_due': Decimal('15000'),
            'bed_note': 'Bedspace HA-004 in Hostel A is held for you until payment is confirmed.',
            'waitlisted': False,
        }
        html = render_to_string('emails/ticket_confirmation.html', context)
        self.assertIn('Grace Parish', html)
        self.assertIn('15,000.00', html)
        self.assertIn('HA-004', html)
        self.assertIn('Waiting for approval', html)

    def test_a_waitlisted_registration_is_told_so_and_asked_for_no_money(self):
        context = {**_registration_context(), 'amount_due': Decimal('15000'), 'waitlisted': True}
        html = render_to_string('emails/ticket_confirmation.html', context)
        self.assertIn('On the waitlist', html)
        self.assertNotIn('Waiting for approval', html)
        self.assertNotIn('Amount due', html)

    def test_status_codes_read_as_words(self):
        context = {**_registration_context(), 'old_status': 'checked_in', 'new_status': 'no_show'}
        html = render_to_string('emails/status_update.html', context)
        self.assertIn('Checked in', html)
        self.assertIn('No show', html)

    def test_payment_amount_is_grouped(self):
        html = render_to_string('emails/payment_confirmation.html', sample_contexts()['payment_confirmation'])
        self.assertIn('15,000.00', html)


class PlainTextTests(SimpleTestCase):
    def test_plain_text_keeps_the_reset_link(self):
        html = render_to_string('emails/password_reset.html', sample_contexts()['password_reset'])
        text = html_to_text(html)
        self.assertIn(f'{FRONTEND}/reset-password?uid=MQ&token=abc-123', text)

    def test_plain_text_leaves_out_styles_and_blank_runs(self):
        html = render_to_string('emails/otp_code.html', sample_contexts()['otp_code'])
        text = html_to_text(html)
        self.assertIn('482913', text)
        self.assertNotIn('@media', text)
        self.assertNotIn('\n\n\n', text)

    def test_a_link_whose_text_is_its_address_is_not_repeated(self):
        text = html_to_text('<p><a href="https://x.example">https://x.example</a></p>')
        self.assertEqual(text, 'https://x.example')
