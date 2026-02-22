"""
Direct Brevo SMTP test - bypasses Django for debugging
"""
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("=" * 60)
print("BREVO DIRECT SMTP TEST")
print("=" * 60)

# Get credentials
smtp_user = os.getenv('BREVO_SMTP_USER', '')
smtp_key = os.getenv('BREVO_SMTP_KEY', '')

print(f"User: {smtp_user}")
print(f"Key: {'*' * 10 if smtp_key else 'NOT SET'}")
print("=" * 60)

if not smtp_user or not smtp_key:
    print("\nERROR: BREVO_SMTP_USER or BREVO_SMTP_KEY is not set")
    print("Please set them in your .env file")
    exit(1)

# Test email recipient - change this to your email
test_recipient = input("\nEnter test email recipient: ").strip()
if not test_recipient:
    test_recipient = smtp_user  # Fallback to sender

# Create message
msg = MIMEMultipart('alternative')
msg['Subject'] = 'Brevo SMTP Test - R63 Teens'
msg['From'] = smtp_user
msg['To'] = test_recipient

html_content = """
<html>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #2E7D32;">🎉 Brevo SMTP Test Successful!</h2>
    <p>If you're reading this, your Brevo email configuration is working correctly.</p>
    <p style="color: #666;">Sent from RCCG R63 Teens Event System</p>
</body>
</html>
"""

text_content = "Brevo SMTP Test Successful! Your email configuration is working."

msg.attach(MIMEText(text_content, 'plain'))
msg.attach(MIMEText(html_content, 'html'))

# Try different methods
print("\n--- Method 1: Port 587 with STARTTLS ---")
try:
    # Create unverified SSL context to bypass certificate issues
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    server = smtplib.SMTP('smtp-relay.brevo.com', 587, timeout=30)
    server.set_debuglevel(1)  # Show SMTP conversation
    server.ehlo()
    server.starttls(context=context)
    server.ehlo()
    server.login(smtp_user, smtp_key)
    server.sendmail(smtp_user, [test_recipient], msg.as_string())
    server.quit()
    print("\n✅ SUCCESS with Method 1!")
    print(f"   Email sent to: {test_recipient}")
    exit(0)
except Exception as e:
    print(f"\n❌ Method 1 failed: {type(e).__name__}: {e}")

print("\n--- Method 2: Port 465 with SSL ---")
try:
    # Create unverified SSL context
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    server = smtplib.SMTP_SSL('smtp-relay.brevo.com', 465, context=context, timeout=30)
    server.set_debuglevel(1)
    server.login(smtp_user, smtp_key)
    server.sendmail(smtp_user, [test_recipient], msg.as_string())
    server.quit()
    print("\n✅ SUCCESS with Method 2!")
    print(f"   Email sent to: {test_recipient}")
    exit(0)
except Exception as e:
    print(f"\n❌ Method 2 failed: {type(e).__name__}: {e}")

print("\n--- Method 3: Port 2525 (alternative) ---")
try:
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    server = smtplib.SMTP('smtp-relay.brevo.com', 2525, timeout=30)
    server.set_debuglevel(1)
    server.ehlo()
    server.starttls(context=context)
    server.ehlo()
    server.login(smtp_user, smtp_key)
    server.sendmail(smtp_user, [test_recipient], msg.as_string())
    server.quit()
    print("\n✅ SUCCESS with Method 3!")
    print(f"   Email sent to: {test_recipient}")
    exit(0)
except Exception as e:
    print(f"\n❌ Method 3 failed: {type(e).__name__}: {e}")

print("\n" + "=" * 60)
print("ALL METHODS FAILED")
print("=" * 60)
print("\nPossible issues:")
print("1. Firewall blocking SMTP ports")
print("2. Invalid Brevo credentials")
print("3. Network restrictions (try from a different network)")
print("4. Brevo account not activated")
