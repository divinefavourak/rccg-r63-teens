"""
Enhanced Brevo Email Testing Script
Run with: python manage.py shell < test_brevo_email.py
"""

from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings
import sys

print("=" * 60)
print("BREVO EMAIL CONFIGURATION TEST")
print("=" * 60)

# Display current configuration
config_details = {
    "Backend": settings.EMAIL_BACKEND,
    "Host": settings.EMAIL_HOST,
    "Port": settings.EMAIL_PORT,
    "Use SSL": settings.EMAIL_USE_SSL,
    "Use TLS": settings.EMAIL_USE_TLS,
    "User": settings.EMAIL_HOST_USER,
    "From Email": settings.DEFAULT_FROM_EMAIL,
    "Timeout": settings.EMAIL_TIMEOUT,
}

for key, value in config_details.items():
    print(f"{key}: {value}")

print("=" * 60)

# Validation checks
if not settings.EMAIL_HOST_USER:
    print("\n❌ ERROR: BREVO_SMTP_USER is not set in environment variables")
    print("Please add it to your .env file")
    sys.exit(1)

if not settings.EMAIL_HOST_PASSWORD:
    print("\n❌ ERROR: BREVO_SMTP_KEY is not set in environment variables")
    print("Please add it to your .env file")
    sys.exit(1)

# Verify correct Brevo configuration
if settings.EMAIL_HOST != 'smtp-relay.brevo.com':
    print(f"\n⚠️  WARNING: Email host is '{settings.EMAIL_HOST}'")
    print("Expected: smtp-relay.brevo.com")

if settings.EMAIL_PORT != 587:
    print(f"\n⚠️  WARNING: Port is {settings.EMAIL_PORT}")
    print("Recommended Brevo port: 587")

if not settings.EMAIL_USE_TLS:
    print("\n⚠️  WARNING: TLS is disabled")
    print("Brevo requires TLS for port 587")

print("\n" + "=" * 60)
print("SENDING TEST EMAIL...")
print("=" * 60)

try:
    # Test recipient - will send to the configured SMTP user
    test_recipient = settings.EMAIL_HOST_USER
    
    # Create HTML email
    subject = "✅ Brevo Email Test - RCCG R63 Teens System"
    text_content = """
    Congratulations! 
    
    Your Brevo email configuration is working correctly.
    
    Email Details:
    - Server: smtp-relay.brevo.com
    - Port: 587
    - Security: TLS
    
    Your RCCG R63 Teens ticketing system can now send emails successfully!
    
    ---
    RCCG Region 63 Junior Church
    """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8B0000 0%, #660000 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #FFD700; margin: 0;">✅ Email Test Successful!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #8B0000;">Congratulations! 🎉</h2>
            <p>Your Brevo email configuration is working correctly.</p>
            
            <div style="background: white; border-left: 4px solid #FFD700; padding: 15px; margin: 20px 0;">
                <h3 style="color: #8B0000; margin-top: 0;">Configuration Details:</h3>
                <ul style="color: #666;">
                    <li><strong>Server:</strong> smtp-relay.brevo.com</li>
                    <li><strong>Port:</strong> 587</li>
                    <li><strong>Security:</strong> TLS</li>
                    <li><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">✅ Working</span></li>
                </ul>
            </div>
            
            <p style="color: #666;">
                Your <strong>RCCG R63 Teens ticketing system</strong> can now send emails successfully!
            </p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <strong>Email Types Available:</strong><br>
                • Registration confirmations<br>
                • Ticket approvals<br>
                • Payment reminders<br>
                • Welcome emails<br>
                • Final instructions
            </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
            <p>RCCG Region 63 Junior Church</p>
            <p>This is an automated test email</p>
        </div>
    </body>
    </html>
    """
    
    # Send email
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[test_recipient]
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=False)
    
    print("\n✅ SUCCESS! Email sent successfully!")
    print(f"📧 Check your inbox: {test_recipient}")
    print("\nWhat to do next:")
    print("1. Check your email inbox (including spam folder)")
    print("2. If you received it, your Brevo configuration is correct!")
    print("3. Your ticketing system is ready to send emails")
    
except Exception as e:
    print(f"\n❌ FAILED: {type(e).__name__}")
    print(f"Error: {e}")
    print("\n" + "=" * 60)
    print("TROUBLESHOOTING:")
    print("=" * 60)
    
    error_msg = str(e).lower()
    
    if "authentication" in error_msg or "535" in error_msg:
        print("\n🔑 Authentication Error - Invalid Credentials")
        print("\nSteps to fix:")
        print("1. Log in to Brevo: https://app.brevo.com")
        print("2. Go to: Settings → SMTP & API → SMTP")
        print("3. Copy your SMTP credentials:")
        print("   - SMTP Login (username)")
        print("   - SMTP Key (password)")
        print("4. Update your .env file:")
        print("   BREVO_SMTP_USER=your-brevo-login")
        print("   BREVO_SMTP_KEY=your-brevo-smtp-key")
        print("5. Restart Django server and try again")
        
    elif "connection" in error_msg or "timeout" in error_msg:
        print("\n🌐 Connection Error")
        print("\nPossible causes:")
        print("1. Firewall blocking port 587")
        print("2. Network issues")
        print("3. Try a different network or disable VPN")
        
    elif "recipient" in error_msg:
        print("\n📧 Recipient Error")
        print("\nCheck that your recipient email is valid")
        
    else:
        print("\nUnexpected error. Full error details above.")
        print("If issue persists, check Brevo dashboard for account status")
    
    print("\n" + "=" * 60)
