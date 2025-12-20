#!/usr/bin/env python
"""
Email configuration test script
Run this to test if email settings are working correctly
"""

import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

def test_basic_email():
    """Test basic email sending"""
    try:
        send_mail(
            subject='RCCG R63 Teens - Email Test',
            message='This is a test email to verify email configuration.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=['test@example.com'],  # Replace with your email
            fail_silently=False,
        )
        print("✅ Basic email test passed!")
        return True
    except Exception as e:
        print(f"❌ Basic email test failed: {e}")
        return False

def test_html_email():
    """Test HTML email sending"""
    try:
        html_content = """
        <html>
        <body>
            <h2>RCCG R63 Teens - HTML Email Test</h2>
            <p>This is a test HTML email to verify email configuration.</p>
            <p><strong>Email settings are working correctly!</strong></p>
        </body>
        </html>
        """
        plain_content = strip_tags(html_content)
        
        send_mail(
            subject='RCCG R63 Teens - HTML Email Test',
            message=plain_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=['test@example.com'],  # Replace with your email
            html_message=html_content,
            fail_silently=False,
        )
        print("✅ HTML email test passed!")
        return True
    except Exception as e:
        print(f"❌ HTML email test failed: {e}")
        return False

def test_payment_confirmation_template():
    """Test payment confirmation email template"""
    try:
        # Mock payment data
        class MockPayment:
            reference = "RCCG_20241201_TEST123"
            amount = 3000.00
            payment_method = "Card"
            payer_name = "Test User"
            completed_at = None
            
            def get_status_display(self):
                return "Success"
            
            @property
            def ticket(self):
                return None
            
            @property
            def metadata(self):
                return {
                    'is_bulk': True,
                    'count': 2,
                    'ticket_refs': ['R63-TEST-001', 'R63-TEST-002']
                }
        
        from django.utils import timezone
        mock_payment = MockPayment()
        mock_payment.completed_at = timezone.now()
        
        context = {
            'payment': mock_payment,
        }
        
        html_message = render_to_string('emails/payment_confirmation.html', context)
        plain_message = strip_tags(html_message)
        
        send_mail(
            subject='RCCG R63 Teens - Payment Confirmation Test',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=['test@example.com'],  # Replace with your email
            html_message=html_message,
            fail_silently=False,
        )
        print("✅ Payment confirmation template test passed!")
        return True
    except Exception as e:
        print(f"❌ Payment confirmation template test failed: {e}")
        return False

def print_email_settings():
    """Print current email settings"""
    print("\n📧 Current Email Settings:")
    print(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
    print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
    print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
    print(f"EMAIL_USE_SSL: {getattr(settings, 'EMAIL_USE_SSL', False)}")
    print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
    print(f"EMAIL_HOST_PASSWORD: {'*' * len(settings.EMAIL_HOST_PASSWORD) if settings.EMAIL_HOST_PASSWORD else 'Not set'}")
    print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
    print(f"SERVER_EMAIL: {getattr(settings, 'SERVER_EMAIL', 'Not set')}")

if __name__ == "__main__":
    print("🧪 Testing Email Configuration...")
    print_email_settings()
    
    print("\n" + "="*50)
    print("IMPORTANT: Update recipient_list in this script with your actual email before running!")
    print("="*50)
    
    # Uncomment these tests after updating the recipient email
    # test_basic_email()
    # test_html_email()
    # test_payment_confirmation_template()
    
    print("\n✨ Email configuration setup complete!")
    print("\nTo use in production:")
    print("1. Update EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env")
    print("2. For Gmail: Use App Password, not regular password")
    print("3. For other providers: Update EMAIL_HOST and EMAIL_PORT accordingly")
    print("4. Test with the functions above")