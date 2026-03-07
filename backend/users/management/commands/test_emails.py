"""
Management command for testing all email types.

Usage:
    # Dry-run — prints HTML to terminal, nothing sent:
    python manage.py test_emails --email you@gmail.com

    # Live — sends real emails via the configured SMTP (Brevo):
    python manage.py test_emails --email you@gmail.com --live

    # Single type:
    python manage.py test_emails --email you@gmail.com --live --type welcome
    python manage.py test_emails --email you@gmail.com --live --type registration_confirmed --gender female
    python manage.py test_emails --email you@gmail.com --live --type devotional
"""
import importlib
from contextlib import contextmanager

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


ALL_TYPES = [
    'welcome',
    'account_created',
    'password_changed',
    'password_reset',
    'registration_confirmation',
    'registration_confirmed',
    'devotional',
]

# Modules that expose _send_in_thread — patched to be synchronous during tests
_EMAIL_MODULES = [
    'users.email_service',
    'events.email_service',
]


@contextmanager
def _sync_send_patch(backend=None):
    """
    Temporarily replace every _send_in_thread with a synchronous version.
    This ensures emails are sent (and errors raised) before the process exits.

    Args:
        backend: optional Django email backend path to force (e.g. console).
    """
    from django.core.mail import EmailMultiAlternatives
    from django.utils.html import strip_tags
    from utils.email_senders import get_sender

    originals = {}
    modules = [importlib.import_module(m) for m in _EMAIL_MODULES]

    def _sync(subject, html, recipients, sender='default', fail_silently=False):
        plain = strip_tags(html)
        conn_kwargs = {}
        if backend:
            conn_kwargs['backend'] = backend
        from django.core.mail import get_connection
        conn = get_connection(**conn_kwargs)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain,
            from_email=get_sender(sender),
            to=recipients,
            connection=conn,
        )
        msg.attach_alternative(html, 'text/html')
        msg.send(fail_silently=fail_silently)

    for mod in modules:
        originals[mod] = mod._send_in_thread
        mod._send_in_thread = _sync

    try:
        yield
    finally:
        for mod, orig in originals.items():
            mod._send_in_thread = orig


class Command(BaseCommand):
    help = 'Send test emails to verify templates and delivery pipeline.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email', required=True,
            help='Target email address — all test emails go here.',
        )
        parser.add_argument(
            '--type', default='all', choices=ALL_TYPES + ['all'],
            help='Which email to test (default: all).',
        )
        parser.add_argument(
            '--live', action='store_true',
            help='Send via the real SMTP backend (Brevo). '
                 'Without this flag the email HTML is printed to the console.',
        )
        parser.add_argument(
            '--gender', default='female', choices=['male', 'female'],
            help='Gender for avatar in registration emails (default: female).',
        )

    def handle(self, *args, **options):
        target   = options['email']
        typ      = options['type']
        live     = options['live']
        gender   = options['gender']

        backend = None if live else 'django.core.mail.backends.console.EmailBackend'

        mode_label = 'LIVE (real SMTP)' if live else 'DRY-RUN (console)'
        self.stdout.write(f'\nMode : {self.style.WARNING(mode_label)}')
        self.stdout.write(f'To   : {target}')
        self.stdout.write('─' * 50)

        types = ALL_TYPES if typ == 'all' else [typ]

        user         = self._get_user(target)
        registration = self._make_registration(target, gender)
        devotional   = self._get_devotional() if 'devotional' in types else None

        passed = failed = 0

        with _sync_send_patch(backend=backend):
            for t in types:
                self.stdout.write(f'\n  → {t}', ending=' ')
                try:
                    self._dispatch(t, user, registration, devotional)
                    self.stdout.write(self.style.SUCCESS('✓'))
                    passed += 1
                except Exception as exc:
                    self.stdout.write(self.style.ERROR(f'✗  {exc}'))
                    failed += 1

        self.stdout.write('\n' + '─' * 50)
        self.stdout.write(
            self.style.SUCCESS(f'{passed} passed') +
            ('  ' + self.style.ERROR(f'{failed} failed') if failed else '')
        )

    # ------------------------------------------------------------------ #
    # Dispatch                                                             #
    # ------------------------------------------------------------------ #

    def _dispatch(self, typ, user, registration, devotional):
        from users.email_service import UserEmailService
        from events.email_service import EventEmailService

        dispatch = {
            'welcome':                   lambda: UserEmailService.send_welcome_email(user),
            'account_created':           lambda: UserEmailService.send_account_created_email(user),
            'password_changed':          lambda: UserEmailService.send_password_changed_email(user),
            'password_reset':            lambda: UserEmailService.send_password_reset_email(user),
            'registration_confirmation': lambda: EventEmailService.send_registration_confirmation(registration),
            'registration_confirmed':    lambda: EventEmailService.send_registration_confirmed(registration),
            'devotional':                lambda: self._send_devotional_sync(devotional),
        }
        dispatch[typ]()

    def _send_devotional_sync(self, devotional):
        """Send the devotional email synchronously (bypasses Celery)."""
        from django.conf import settings
        from django.core.mail import EmailMultiAlternatives
        from django.template.loader import render_to_string
        from django.utils.html import strip_tags
        from utils.email_senders import get_sender

        frontend_url = getattr(settings, 'FRONTEND_URL', '') or 'https://rccg-r63-juniorchurch.vercel.app'
        context = {
            'devotional':     devotional,
            'devotional_url': f"{frontend_url}/devotional/{devotional.slug}",
            'frontend_url':   frontend_url,
            'logo_url':       'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/logo.jpg',
            'faith_logo_url': 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/faith_logo.jpg',
        }
        html    = render_to_string('emails/daily_devotional.html', context)
        plain   = strip_tags(html)
        subject = f"Today's Devotional – {devotional.title} ({devotional.date.strftime('%B %d, %Y')})"

        # _send_in_thread is already patched to be synchronous at this point
        from users.email_service import _send_in_thread
        _send_in_thread(subject, html, [self._target_email], sender='junior_church', fail_silently=False)

    # ------------------------------------------------------------------ #
    # Object builders                                                      #
    # ------------------------------------------------------------------ #

    _target_email = ''  # set in _get_user for devotional fallback

    def _get_user(self, email):
        """
        Use a real User from the DB when one exists (needed for token generation).
        Falls back to a lightweight mock for environments with no data.
        """
        self._target_email = email

        from users.models import User
        real = User.objects.filter(is_active=True).first()
        if real:
            # Redirect the real user's email to the test target for this run
            real._test_email_override = email
            _patch_user_email(real, email)
            self.stdout.write(f'User : real ({real.username})')
            return real

        # No users in DB — build a minimal mock
        self.stdout.write(self.style.WARNING('User : mock (no users in DB)'))
        return _make_mock_user(email)

    def _make_registration(self, email, gender):
        from types import SimpleNamespace
        event = SimpleNamespace(
            pk='00000000-0000-0000-0000-000000000002',
            title='RCCG R63 Campout',
            slug='rccg-r63-campout',
            start_datetime=timezone.now(),
            end_datetime=timezone.now(),
            venue='Redemption City, Ogun State',
            city='Ogun State',
            state='Nigeria',
        )
        return SimpleNamespace(
            pk='00000000-0000-0000-0000-000000000003',
            registration_id='CAMP-20260307-00001',
            attendee_name='Test Attendee',
            attendee_email=email,
            attendee_gender=gender,
            attendee_category='Teen',
            guardian_email='',
            created_at=timezone.now(),
            approved_at=timezone.now(),
            event=event,
            qr_code=None,
        )

    def _get_devotional(self):
        from content.models import Devotional
        d = Devotional.objects.filter(status='published').order_by('-date').first()
        if not d:
            raise CommandError(
                'No published devotionals found. Run the scraper first:\n'
                '  python manage.py shell -c '
                '"from content.tasks import daily_devotional_scrape; '
                'daily_devotional_scrape.apply()"'
            )
        return d


# ------------------------------------------------------------------ #
# Helpers                                                             #
# ------------------------------------------------------------------ #

def _patch_user_email(user, override_email):
    """
    Make the user object deliver emails to override_email for this test run
    without modifying the DB.
    """
    # Set directly on the instance dict — bypasses the DB field descriptor
    # and avoids touching ModelBase metaclass machinery.
    user.__dict__['email'] = override_email


def _make_mock_user(email):
    """Minimal mock with all fields token_generator needs."""
    from types import SimpleNamespace
    from utils.avatars import get_peep_url

    user = SimpleNamespace(
        pk='00000000-0000-0000-0000-000000000001',
        username='test_user',
        email=email,
        first_name='Test',
        last_name='User',
        role='coordinator',
        province='lagos_province_9',
        profile_picture=None,
        email_notifications=True,
        password='pbkdf2_sha256$mock',
        last_login=None,
        teen_profile=None,
    )
    user.get_display_name     = lambda: 'Test User'
    user.get_role_display     = lambda: 'Coordinator'
    user.get_province_display = lambda: 'Lagos Province 9'

    # Patch avatar lookup to avoid DB query
    from utils import avatars as av
    av._mock_url = get_peep_url('test_user', gender='male', size=100)
    _orig_get_user_avatar = av.get_user_avatar
    av.get_user_avatar = lambda u, size=100: av._mock_url

    return user
