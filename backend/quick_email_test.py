"""
Quick Email Connection Test
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings
from django.core.mail import send_mail

print("=" * 60)
print("TESTING EMAIL CONNECTION")
print("=" * 60)
print(f"Backend: {settings.EMAIL_BACKEND}")
print(f"Host: {settings.EMAIL_HOST}")
print(f"Port: {settings.EMAIL_PORT}")
print(f"Use SSL: {settings.EMAIL_USE_SSL}")
print(f"Use TLS: {settings.EMAIL_USE_TLS}")
print(f"User: {settings.EMAIL_HOST_USER}")
print(f"Timeout: {getattr(settings, 'EMAIL_TIMEOUT', 'Not set')}")
print("=" * 60)

try:
    result = send_mail(
        subject='Test Email - RCCG R63',
        message='This is a test email to verify the connection is working.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.EMAIL_HOST_USER],
        fail_silently=False,
    )
    print(f"\n✅ SUCCESS! Email sent. Result: {result}")
    print("Connection is working properly!")
except Exception as e:
    print(f"\n❌ FAILED: {type(e).__name__}")
    print(f"Error: {e}")
    print("\nPossible fixes:")
    print("1. Generate new Gmail App Password")
    print("2. Wait 10-15 minutes for Gmail rate limit to reset")
    print("3. Try a different network (mobile hotspot)")
