"""
Test script to verify email sending with different senders via Brevo
Run this to test all configured senders
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
from utils.email_senders import get_sender, get_all_senders, validate_sender

print("=" * 60)
print("MULTIPLE SENDERS TEST")
print("=" * 60)

# Show all configured senders
senders = get_all_senders()
print("\nConfigured Senders:")
for key, value in senders.items():
    print(f"  {key}: {value}")
print()

# Get recipient
recipient = input("Enter recipient email (or press Enter for default): ").strip()
if not recipient:
    recipient = settings.DEFAULT_FROM_EMAIL
    print(f"Using default: {recipient}")

print("\n" + "-" * 60)

# Test each sender
test_senders = ['junior_church', 'support', 'no_reply', 'default']

for sender_key in test_senders:
    if not validate_sender(sender_key):
        print(f"⚠️  Sender '{sender_key}' not configured, skipping")
        continue
    
    from_email = get_sender(sender_key)
    print(f"\nTesting: {sender_key}")
    print(f"  From: {from_email}")
    
    try:
        result = send_mail(
            subject=f'[{sender_key.upper()}] Sender Test - R63 Teens',
            message=f'This is a test email from the {sender_key} sender.',
            from_email=from_email,
            recipient_list=[recipient],
            html_message=f'''
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #2E7D32;">Sender Test: {sender_key.upper()}</h2>
                <p><strong>From:</strong> {from_email}</p>
                <p>This email was sent using the <code>{sender_key}</code> sender configuration.</p>
                <p style="color: #666;">RCCG R63 Teens Event System</p>
            </body>
            </html>
            ''',
            fail_silently=False,
        )
        
        if result:
            print(f"  ✅ SUCCESS!")
        else:
            print(f"  ⚠️ Result: {result}")
            
    except Exception as e:
        print(f"  ❌ FAILED: {type(e).__name__}: {e}")

print("\n" + "=" * 60)
print("Check Brevo Dashboard -> Transactional -> Logs")
print("to verify emails show correct 'From' addresses")
print("=" * 60)
