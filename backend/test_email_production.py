#!/usr/bin/env python
"""
Production Email Test Utility for R63 Teens Registration System

This script tests email functionality with different providers.
Run this script to verify your email configuration is working.

Usage:
    python test_email_production.py
"""

import os
import sys
import django
from pathlib import Path

# Add the project root to Python path
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.mail import send_mail, EmailMessage
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def test_basic_email():
    """Test basic email sending"""
    print("🧪 Testing basic email...")
    
    try:
        send_mail(
            subject='[R63 Teens] Email Test - Basic',
            message='This is a test email from the R63 Teens Registration System.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=['test@example.com'],  # Replace with your test email
            fail_silently=False,
        )
        print("✅ Basic email test passed!")
        return True
    except Exception as e:
        print(f"❌ Basic email test failed: {e}")
        return False


def test_html_email():
    """Test HTML email sending"""
    print("🧪 Testing HTML email...")
    
    try:
        html_content = """
        <html>
        <body>
            <h2>R63 Teens Registration System</h2>
            <p>This is a <strong>test HTML email</strong> from the registration system.</p>
            <p>If you can see this formatted text, HTML emails are working correctly!</p>
            <hr>
            <p><small>This is an automated test email.</small></p>
        </body>
        </html>
        """
        
        text_content = strip_tags(html_content)
        
        email = EmailMessage(
            subject='[R63 Teens] Email Test - HTML',
            body=html_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=['test@example.com'],  # Replace with your test email
        )
        email.content_subtype = 'html'
        email.send()
        
        print("✅ HTML email test passed!")
        return True
    except Exception as e:
        print(f"❌ HTML email test failed: {e}")
        return False


def test_template_email():
    """Test template-based email"""
    print("🧪 Testing template email...")
    
    try:
        # Create a simple template content
        template_content = """
        <h2>Welcome to R63 Teens Camp!</h2>
        <p>Dear {{ name }},</p>
        <p>Your registration has been received with Ticket ID: <strong>{{ ticket_id }}</strong></p>
        <p>Status: {{ status }}</p>
        <p>Thank you for registering!</p>
        """
        
        context = {
            'name': 'Test User',
            'ticket_id': 'TKT-202501-00001',
            'status': 'Pending Approval'
        }
        
        # Render template
        from django.template import Template, Context
        template = Template(template_content)
        html_content = template.render(Context(context))
        
        email = EmailMessage(
            subject='[R63 Teens] Registration Confirmation - Test',
            body=html_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=['test@example.com'],  # Replace with your test email
        )
        email.content_subtype = 'html'
        email.send()
        
        print("✅ Template email test passed!")
        return True
    except Exception as e:
        print(f"❌ Template email test failed: {e}")
        return False


def print_email_config():
    """Print current email configuration"""
    print("\n📧 Current Email Configuration:")
    print(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
    print(f"EMAIL_HOST: {getattr(settings, 'EMAIL_HOST', 'Not set')}")
    print(f"EMAIL_PORT: {getattr(settings, 'EMAIL_PORT', 'Not set')}")
    print(f"EMAIL_USE_TLS: {getattr(settings, 'EMAIL_USE_TLS', 'Not set')}")
    print(f"EMAIL_USE_SSL: {getattr(settings, 'EMAIL_USE_SSL', 'Not set')}")
    print(f"EMAIL_HOST_USER: {getattr(settings, 'EMAIL_HOST_USER', 'Not set')}")
    print(f"EMAIL_HOST_PASSWORD: {'***' if getattr(settings, 'EMAIL_HOST_PASSWORD', '') else 'Not set'}")
    print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
    print(f"EMAIL_PROVIDER: {os.getenv('EMAIL_PROVIDER', 'default/gmail')}")


def main():
    """Main test function"""
    print("🚀 R63 Teens Email Configuration Test")
    print("=" * 50)
    
    # Print configuration
    print_email_config()
    print("\n" + "=" * 50)
    
    # Check if email is configured
    if not getattr(settings, 'EMAIL_HOST_USER', ''):
        print("⚠️  EMAIL_HOST_USER is not configured!")
        print("Please set up your email configuration in .env file")
        return
    
    # Run tests
    tests = [
        test_basic_email,
        test_html_email,
        test_template_email,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All email tests passed! Your email configuration is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check your email configuration.")
        print("\n💡 Common issues:")
        print("   - Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD")
        print("   - Verify EMAIL_HOST and EMAIL_PORT")
        print("   - Ensure EMAIL_USE_TLS/EMAIL_USE_SSL settings are correct")
        print("   - Check if your email provider requires app passwords")


if __name__ == '__main__':
    main()