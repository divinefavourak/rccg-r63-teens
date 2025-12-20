"""
Quick email test for production
Run this after deployment: python manage.py shell < quick_email_test.py
"""

from django.core.mail import send_mail
from django.conf import settings

print(f"Testing email with:")
print(f"  Host: {settings.EMAIL_HOST}")
print(f"  Port: {settings.EMAIL_PORT}")
print(f"  TLS: {settings.EMAIL_USE_TLS}")
print(f"  SSL: {settings.EMAIL_USE_SSL}")
print(f"  User: {settings.EMAIL_HOST_USER}")
print(f"  From: {settings.DEFAULT_FROM_EMAIL}")

try:
    send_mail(
        subject='Test Email from Render',
        message='If you receive this, email configuration is working correctly!',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.EMAIL_HOST_USER],  # Send to yourself
        fail_silently=False,
    )
    print("\n✅ Email sent successfully!")
    print("Check your inbox.")
except Exception as e:
    print(f"\n❌ Email failed: {e}")
    print("\nCheck your environment variables in Render.")
