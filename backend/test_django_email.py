"""
Quick Django Email Test - Uses the new custom email backend
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("=" * 60)
print("DJANGO EMAIL TEST (with custom Brevo backend)")
print("=" * 60)
print(f"Backend: {settings.EMAIL_BACKEND}")
print(f"Host: {settings.EMAIL_HOST}")
print(f"Port: {settings.EMAIL_PORT}")
print(f"SSL: {settings.EMAIL_USE_SSL}")
print(f"User: {settings.EMAIL_HOST_USER}")
print(f"From: {settings.DEFAULT_FROM_EMAIL}")
print("=" * 60)

# Get recipient
recipient = input("\nEnter recipient email (or press Enter for default): ").strip()
if not recipient:
    recipient = settings.DEFAULT_FROM_EMAIL

print(f"\nSending test email to: {recipient}")
print("-" * 40)

try:
    result = send_mail(
        subject='🎉 R63 Teens - Django Email Test',
        message='This is a test email from the R63 Teens Event System using Django.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        html_message='''
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2E7D32;">🎉 Django Email Test Successful!</h2>
            <p>Your email configuration is working correctly with the custom Brevo backend.</p>
            <p style="color: #666;">Sent from RCCG R63 Teens Event System</p>
        </body>
        </html>
        ''',
        fail_silently=False,
    )
    
    if result:
        print("\n✅ SUCCESS! Email sent.")
        print("   Check your inbox (and spam folder)")
    else:
        print("\n⚠️ send_mail returned 0 - email may not have been sent")
        
except Exception as e:
    print(f"\n❌ FAILED: {type(e).__name__}")
    print(f"   Error: {e}")
    print("\n💡 Make sure you've verified a sender in Brevo Dashboard!")

print("\n" + "=" * 60)
