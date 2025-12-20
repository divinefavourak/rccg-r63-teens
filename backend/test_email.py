"""
Email Configuration Test Script
Run this to verify your email settings are working correctly.
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings
from django.core.mail import send_mail

print("=" * 50)
print("EMAIL CONFIGURATION TEST")
print("=" * 50)

# Show current settings (hide password)
print(f"\nCurrent Settings:")
print(f"  EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
print(f"  EMAIL_HOST: {settings.EMAIL_HOST}")
print(f"  EMAIL_PORT: {settings.EMAIL_PORT}")
print(f"  EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
print(f"  EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
print(f"  EMAIL_HOST_PASSWORD: {'*' * len(str(settings.EMAIL_HOST_PASSWORD)) if settings.EMAIL_HOST_PASSWORD else '(empty)'}")
print(f"  DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")

# Check if using console backend
if 'console' in settings.EMAIL_BACKEND.lower():
    print("\n⚠️  WARNING: You are using the Console Backend!")
    print("   Emails will only print to terminal, not actually send.")
    print("   Change EMAIL_BACKEND to 'django.core.mail.backends.smtp.EmailBackend' for real emails.")
    sys.exit(1)

# Check for empty credentials
if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
    print("\n❌ ERROR: Email credentials are empty!")
    print("   Please set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in your .env file.")
    sys.exit(1)

# Try to send a test email
print("\n📧 Attempting to send test email...")
print(f"   Sending to: {settings.EMAIL_HOST_USER}")

try:
    result = send_mail(
        subject='RCCG R63 Teens - Email Test',
        message='If you receive this email, your email configuration is working correctly!',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.EMAIL_HOST_USER],
        fail_silently=False,
    )
    
    if result == 1:
        print("\n✅ SUCCESS! Email sent successfully!")
        print(f"   Check your inbox at: {settings.EMAIL_HOST_USER}")
    else:
        print("\n⚠️  Email returned 0 - may not have been sent.")
        
except Exception as e:
    print(f"\n❌ FAILED to send email!")
    print(f"   Error: {e}")
    print("\n   Common fixes:")
    print("   1. Use Gmail App Password (not regular password)")
    print("   2. Enable 2-Step Verification first")
    print("   3. Check if your network allows port 587")

print("\n" + "=" * 50)
