"""
Email Test - Using Port 465 with SSL (alternative to blocked port 587)
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings
from django.core.mail import EmailMessage
from django.core.mail.backends.smtp import EmailBackend

print("=" * 50)
print("TRYING PORT 465 WITH SSL")
print("=" * 50)

# Try with port 465 and SSL
try:
    backend = EmailBackend(
        host='smtp.gmail.com',
        port=465,
        username=settings.EMAIL_HOST_USER,
        password=settings.EMAIL_HOST_PASSWORD,
        use_tls=False,
        use_ssl=True,  # Use SSL instead of TLS
        timeout=30
    )
    
    email = EmailMessage(
        subject='RCCG R63 Teens - Email Test (Port 465)',
        body='SUCCESS! This email was sent using port 465 with SSL.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.EMAIL_HOST_USER],
        connection=backend
    )
    
    result = email.send(fail_silently=False)
    
    if result == 1:
        print("\n✅ SUCCESS! Email sent via port 465!")
        print(f"   Check your inbox at: {settings.EMAIL_HOST_USER}")
        print("\n📝 UPDATE YOUR .env FILE:")
        print("   EMAIL_PORT=465")
        print("   EMAIL_USE_TLS=False")
        print("   EMAIL_USE_SSL=True")
    else:
        print("\n⚠️  Email returned 0")
        
except Exception as e:
    print(f"\n❌ Port 465 also failed: {e}")
    print("\n🔧 Your network is blocking Gmail SMTP entirely.")
    print("   Options:")
    print("   1. Use mobile hotspot or different network")
    print("   2. Use a third-party service like SendGrid, Brevo, or Mailgun")
    print("   3. Contact your ISP about unblocking SMTP ports")

print("\n" + "=" * 50)
