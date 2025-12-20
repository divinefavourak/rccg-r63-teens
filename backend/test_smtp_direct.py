import smtplib
import os

print("Testing SMTP connection to Brevo...")
print(f"Host: smtp-relay.brevo.com")
print(f"Port: 587")
print(f"User: {os.getenv('BREVO_SMTP_USER', 'NOT SET')}")
print(f"Key: {'SET' if os.getenv('BREVO_SMTP_KEY') else 'NOT SET'}")
print()

try:
    server = smtplib.SMTP('smtp-relay.brevo.com', 587, timeout=10)
    server.ehlo()
    print("✅ Connection established")
    
    server.starttls()
    print("✅ TLS started")
    
    server.login(os.getenv('BREVO_SMTP_USER'), os.getenv('BREVO_SMTP_KEY'))
    print("✅ Authentication successful")
    
    server.quit()
    print("✅ All tests passed! SMTP is working!")
    
except Exception as e:
    print(f"❌ Failed: {e}")