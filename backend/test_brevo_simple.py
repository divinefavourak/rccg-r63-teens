"""
Simple Brevo Email Test (Windows-compatible)
Run with: python test_brevo_simple.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings

print("=" * 60)
print("BREVO EMAIL CONFIGURATION TEST")
print("=" * 60)

# Display configuration
print(f"Backend: {settings.EMAIL_BACKEND}")
print(f"Host: {settings.EMAIL_HOST}")
print(f"Port: {settings.EMAIL_PORT}")
print(f"Use SSL: {settings.EMAIL_USE_SSL}")
print(f"Use TLS: {settings.EMAIL_USE_TLS}")
print(f"User: {settings.EMAIL_HOST_USER}")
print(f"From Email: {settings.DEFAULT_FROM_EMAIL}")
print(f"Timeout: {settings.EMAIL_TIMEOUT}")
print("=" * 60)

# Check credentials
if not settings.EMAIL_HOST_USER:
    print("\nERROR: BREVO_SMTP_USER is not set")
    print("Add it to your .env file")
    exit(1)

if not settings.EMAIL_HOST_PASSWORD:
    print("\nERROR: BREVO_SMTP_KEY is not set")
    print("Add it to your .env file")
    exit(1)

# Check if Gmail credentials are being used (common mistake)
if '@gmail.com' in settings.EMAIL_HOST_USER and 'brevo' in settings.EMAIL_HOST:
    print("\nWARNING: You're using Gmail credentials with Brevo's server!")
    print("This will NOT work. You need Brevo SMTP credentials.")
    print("\nTo fix:")
    print("1. Go to https://app.brevo.com")
    print("2. Settings > SMTP & API > SMTP")
    print("3. Get your Brevo SMTP login and key")
    print("4. Update .env file with Brevo credentials")
    exit(1)

print("\nSending test email...")
print("=" * 60)

try:
    # Send simple test email
    test_recipient = settings.EMAIL_HOST_USER
    
    subject = "Brevo Email Test - RCCG R63"
    text_message = """
Hello!

Your Brevo email configuration is working correctly.

Configuration:
- Server: smtp-relay.brevo.com
- Port: 587
- Security: TLS

Your RCCG R63 Teens system can now send emails!

---
RCCG Region 63 Junior Church
"""
    
    html_message = """
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #8B0000;">Email Test Successful!</h2>
        <p>Your Brevo email configuration is working correctly.</p>
        <div style="background: #f0f0f0; padding: 15px; margin: 20px 0;">
            <h3>Configuration Details:</h3>
            <ul>
                <li><strong>Server:</strong> smtp-relay.brevo.com</li>
                <li><strong>Port:</strong> 587</li>
                <li><strong>Security:</strong> TLS</li>
                <li><strong>Status:</strong> Working</li>
            </ul>
        </div>
        <p>Your RCCG R63 Teens system can now send emails!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">RCCG Region 63 Junior Church</p>
    </body>
    </html>
    """
    
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[test_recipient]
    )
    msg.attach_alternative(html_message, "text/html")
    msg.send(fail_silently=False)
    
    print("\nSUCCESS! Email sent successfully!")
    print(f"Check your inbox: {test_recipient}")
    print("\nNext steps:")
    print("1. Check your email (including spam folder)")
    print("2. If received, your configuration is correct!")
    print("3. Your system is ready to send emails")
    
except Exception as e:
    print(f"\nFAILED: {type(e).__name__}")
    print(f"Error: {e}")
    print("\n" + "=" * 60)
    print("TROUBLESHOOTING")
    print("=" * 60)
    
    error_msg = str(e).lower()
    
    if "authentication" in error_msg or "535" in error_msg:
        print("\nAuthentication Error - Invalid Credentials")
        print("\nSteps to fix:")
        print("1. Log in to Brevo: https://app.brevo.com")
        print("2. Go to: Settings > SMTP & API > SMTP")
        print("3. Copy your SMTP credentials:")
        print("   - SMTP Login")
        print("   - SMTP Key")
        print("4. Update your .env file:")
        print("   BREVO_SMTP_USER=your-brevo-login")
        print("   BREVO_SMTP_KEY=your-brevo-smtp-key")
        print("5. Restart Django and try again")
        
    elif "connection" in error_msg or "timeout" in error_msg:
        print("\nConnection Error")
        print("Possible causes:")
        print("1. Firewall blocking port 587")
        print("2. Network issues")
        print("3. Try different network or disable VPN")
        
    else:
        print("\nUnexpected error")
        print("Check Brevo dashboard for account status")
    
    print("\n" + "=" * 60)
