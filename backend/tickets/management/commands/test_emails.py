"""
Django management command to test email functionality
Usage: python manage.py test_emails --email your@email.com
"""

from django.core.management.base import BaseCommand
from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings


class Command(BaseCommand):
    help = 'Test email functionality with Brevo'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Email address to send test emails to',
            required=True
        )
        parser.add_argument(
            '--test',
            type=str,
            default='all',
            choices=['basic', 'html', 'service', 'all'],
            help='Type of test to run (default: all)'
        )

    def handle(self, *args, **options):
        recipient_email = options['email']
        test_type = options['test']
        
        self.stdout.write(self.style.SUCCESS('\n' + '='*70))
        self.stdout.write(self.style.SUCCESS('  RCCG R63 TEENS - EMAIL TESTING SUITE'))
        self.stdout.write(self.style.SUCCESS('='*70 + '\n'))
        
        # Display configuration
        self.stdout.write(self.style.WARNING('📋 Email Configuration:'))
        self.stdout.write(f'   Backend: {settings.EMAIL_BACKEND}')
        self.stdout.write(f'   Host: {settings.EMAIL_HOST}')
        self.stdout.write(f'   Port: {settings.EMAIL_PORT}')
        self.stdout.write(f'   Use TLS: {settings.EMAIL_USE_TLS}')
        self.stdout.write(f'   Use SSL: {settings.EMAIL_USE_SSL}')
        self.stdout.write(f'   From Email: {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'   User: {settings.EMAIL_HOST_USER}')
        password_status = '✅ SET' if settings.EMAIL_HOST_PASSWORD else '❌ NOT SET'
        self.stdout.write(f'   Password: {password_status}\n')
        
        if not settings.EMAIL_HOST_PASSWORD:
            self.stdout.write(self.style.ERROR('❌ ERROR: EMAIL_HOST_PASSWORD not set!'))
            self.stdout.write(self.style.ERROR('   Please set BREVO_SMTP_KEY in your environment variables.\n'))
            return
        
        # Run tests based on selection
        if test_type in ['basic', 'all']:
            self.test_basic_email(recipient_email)
        
        if test_type in ['html', 'all']:
            self.test_html_email(recipient_email)
        
        if test_type in ['service', 'all']:
            self.test_email_service(recipient_email)
        
        self.stdout.write(self.style.SUCCESS('\n' + '='*70))
        self.stdout.write(self.style.SUCCESS('  ALL TESTS COMPLETED'))
        self.stdout.write(self.style.SUCCESS('='*70 + '\n'))
        self.stdout.write('📬 Check your inbox at: ' + recipient_email)
        self.stdout.write('💡 Don\'t forget to check spam folder!\n')

    def test_basic_email(self, recipient):
        """Test 1: Basic plain text email"""
        self.stdout.write(self.style.WARNING('\n🧪 TEST 1: Basic Plain Text Email'))
        self.stdout.write('-' * 70)
        
        try:
            result = send_mail(
                subject='🧪 Test Email - RCCG R63 Teens Backend',
                message='''Hello!

This is a plain text test email from your RCCG R63 Teens backend.

If you receive this email, it means:
✅ Your Django email settings are correct
✅ Brevo SMTP connection is working
✅ Email authentication is successful
✅ Emails can be delivered to recipients

Best regards,
RCCG Region 63 Junior Church Team''',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )
            
            if result == 1:
                self.stdout.write(self.style.SUCCESS('   ✅ Plain text email sent successfully!'))
                self.stdout.write(f'   📧 Sent to: {recipient}')
                self.stdout.write(f'   📤 From: {settings.DEFAULT_FROM_EMAIL}')
            else:
                self.stdout.write(self.style.WARNING('   ⚠️  Email might not have been sent'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Failed: {str(e)}'))

    def test_html_email(self, recipient):
        """Test 2: HTML formatted email"""
        self.stdout.write(self.style.WARNING('\n🎨 TEST 2: HTML Formatted Email'))
        self.stdout.write('-' * 70)
        
        try:
            subject = '🎨 HTML Email Test - RCCG R63 Teens'
            text_content = 'HTML Email Test - Plain text version'
            
            html_content = '''
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; line-height: 1.8; color: #333; }
        .success-badge { background: #10b981; color: white; padding: 15px 30px; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
        .footer { background: #2d3748; color: white; padding: 20px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ HTML Email Test</h1>
            <p style="margin: 10px 0 0 0;">RCCG Region 63 Junior Church</p>
        </div>
        <div class="content">
            <div class="success-badge">🎉 Success! HTML Emails Working!</div>
            <h2 style="color: #667eea;">Email System Status</h2>
            <p>Your email system is properly configured and working perfectly!</p>
            <ul>
                <li>✅ SMTP Connection: Working</li>
                <li>✅ Authentication: Successful</li>
                <li>✅ HTML Rendering: Perfect</li>
                <li>✅ Brevo Integration: Active</li>
            </ul>
        </div>
        <div class="footer">
            <p><strong>Powered by Brevo</strong></p>
            <p style="font-size: 12px;">Automated test email</p>
        </div>
    </div>
</body>
</html>
            '''
            
            msg = EmailMultiAlternatives(subject, text_content, settings.DEFAULT_FROM_EMAIL, [recipient])
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            
            self.stdout.write(self.style.SUCCESS('   ✅ HTML email sent successfully!'))
            self.stdout.write(f'   📧 Sent to: {recipient}')
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Failed: {str(e)}'))

    def test_email_service(self, recipient):
        """Test 3: EmailService methods"""
        self.stdout.write(self.style.WARNING('\n🎫 TEST 3: EmailService Integration'))
        self.stdout.write('-' * 70)
        
        try:
            from tickets.models import Ticket
            from tickets.services import EmailService
            
            self.stdout.write('   📝 Creating test ticket...')
            ticket, created = Ticket.objects.get_or_create(
                email=recipient,
                defaults={
                    'first_name': 'TestUser',
                    'last_name': 'EmailTest',
                    'phone': '08012345678',
                    'category': 'teen',
                    'church_name': 'Test Church',
                    'parent_name': 'Test Parent',
                    'parent_email': recipient,
                    'parent_phone': '08087654321',
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'   ✅ Created: {ticket.ticket_id}'))
            else:
                self.stdout.write(self.style.WARNING(f'   ⚠️  Using existing: {ticket.ticket_id}'))
            
            # Test emails
            self.stdout.write('\n   📧 Testing Welcome Email...')
            result = EmailService.send_welcome_email(ticket)
            self.stdout.write(self.style.SUCCESS('      ✅ Sent') if result else self.style.ERROR('      ❌ Failed'))
            
            self.stdout.write('   📧 Testing Confirmation...')
            result = EmailService.send_ticket_confirmation(ticket)
            self.stdout.write(self.style.SUCCESS('      ✅ Sent') if result else self.style.ERROR('      ❌ Failed'))
            
            self.stdout.write('   📧 Testing Payment Reminder...')
            result = EmailService.send_payment_reminder(ticket)
            self.stdout.write(self.style.SUCCESS('      ✅ Sent') if result else self.style.ERROR('      ❌ Failed'))
            
            self.stdout.write(self.style.SUCCESS(f'\n   ✅ Tests completed for {ticket.ticket_id}'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'   ❌ Failed: {str(e)}'))