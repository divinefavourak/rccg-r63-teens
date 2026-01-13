"""
Post-deployment email test command for Render
Runs automatically after deployment to verify email configuration
"""
import os
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings

# Try to import sender utilities, fall back if not available
try:
    from utils.email_senders import get_sender, get_all_senders
    HAS_SENDER_UTILS = True
except ImportError:
    HAS_SENDER_UTILS = False
    
    def get_sender(key='default'):
        """Fallback: return default from email"""
        senders = getattr(settings, 'EMAIL_SENDERS', {})
        if senders and key in senders:
            return senders[key]
        return settings.DEFAULT_FROM_EMAIL
    
    def get_all_senders():
        """Fallback: return EMAIL_SENDERS from settings"""
        return getattr(settings, 'EMAIL_SENDERS', {'default': settings.DEFAULT_FROM_EMAIL})


class Command(BaseCommand):
    help = 'Test email configuration after deployment'

    def add_arguments(self, parser):
        parser.add_argument(
            '--recipient',
            type=str,
            default=None,
            help='Email address to send test to (defaults to DEFAULT_FROM_EMAIL)'
        )
        parser.add_argument(
            '--sender',
            type=str,
            default='default',
            help='Sender key to test (support, no_reply, junior_church, default)'
        )
        parser.add_argument(
            '--all-senders',
            action='store_true',
            help='Test all configured senders'
        )
        parser.add_argument(
            '--quiet',
            action='store_true',
            help='Only output errors'
        )

    def handle(self, *args, **options):
        recipient = options['recipient'] or os.environ.get(
            'TEST_EMAIL_RECIPIENT',
            settings.DEFAULT_FROM_EMAIL
        )
        quiet = options['quiet']
        
        if not quiet:
            self.stdout.write(self.style.NOTICE('=' * 50))
            self.stdout.write(self.style.NOTICE('POST-DEPLOYMENT EMAIL TEST'))
            self.stdout.write(self.style.NOTICE('=' * 50))
            self.stdout.write(f'\nBackend: {settings.EMAIL_BACKEND}')
            self.stdout.write(f'Host: {settings.EMAIL_HOST}')
            self.stdout.write(f'Port: {settings.EMAIL_PORT}')
            self.stdout.write(f'Recipient: {recipient}\n')
        
        # Determine which senders to test
        if options['all_senders']:
            senders_to_test = list(get_all_senders().keys())
        else:
            senders_to_test = [options['sender']]
        
        all_success = True
        
        for sender_key in senders_to_test:
            try:
                from_email = get_sender(sender_key)
                
                if not quiet:
                    self.stdout.write(f'\nTesting sender: {sender_key}')
                    self.stdout.write(f'  From: {from_email}')
                
                result = send_mail(
                    subject=f'[Render Deploy] Email Test - {sender_key}',
                    message=f'Email test successful for sender: {sender_key}',
                    from_email=from_email,
                    recipient_list=[recipient],
                    html_message=f'''
                    <html>
                    <body style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2 style="color: #2E7D32;">✅ Render Deployment Email Test</h2>
                        <p><strong>Sender:</strong> {sender_key}</p>
                        <p><strong>From:</strong> {from_email}</p>
                        <p>Email configuration is working correctly after deployment.</p>
                        <p style="color: #666; font-size: 12px;">
                            Environment: {os.environ.get('RENDER', 'local')}<br>
                            Host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}
                        </p>
                    </body>
                    </html>
                    ''',
                    fail_silently=False,
                )
                
                if result:
                    if not quiet:
                        self.stdout.write(self.style.SUCCESS(f'  ✅ SUCCESS'))
                else:
                    all_success = False
                    self.stdout.write(self.style.WARNING(f'  ⚠️ send_mail returned 0'))
                    
            except Exception as e:
                all_success = False
                self.stdout.write(self.style.ERROR(f'  ❌ FAILED: {type(e).__name__}: {e}'))
        
        if not quiet:
            self.stdout.write('\n' + '=' * 50)
        
        if all_success:
            self.stdout.write(self.style.SUCCESS('All email tests passed!'))
        else:
            self.stdout.write(self.style.ERROR('Some email tests failed!'))
            # Exit with error code so Render knows something failed
            raise SystemExit(1)
