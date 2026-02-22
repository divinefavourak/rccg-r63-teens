"""
Network Diagnostic Tool for Brevo SMTP
Tests connectivity to Brevo's SMTP server
"""

import socket
import sys

print("=" * 60)
print("BREVO SMTP NETWORK DIAGNOSTIC")
print("=" * 60)

# Brevo SMTP server details
smtp_host = "smtp-relay.brevo.com"
smtp_port = 587
timeout = 10

print(f"\nTesting connection to: {smtp_host}:{smtp_port}")
print(f"Timeout: {timeout} seconds")
print("\n" + "=" * 60)

# Test 1: DNS Resolution
print("\n[1] Testing DNS resolution...")
try:
    ip_address = socket.gethostbyname(smtp_host)
    print(f"    SUCCESS: {smtp_host} resolves to {ip_address}")
except socket.gaierror as e:
    print(f"    FAILED: Cannot resolve hostname")
    print(f"    Error: {e}")
    print("\n    This suggests DNS issues or no internet connection")
    sys.exit(1)

# Test 2: Port Connectivity
print(f"\n[2] Testing connection to port {smtp_port}...")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(timeout)

try:
    result = sock.connect_ex((smtp_host, smtp_port))
    if result == 0:
        print(f"    SUCCESS: Port {smtp_port} is open and reachable!")
        sock.close()
        
        print("\n" + "=" * 60)
        print("DIAGNOSTIC RESULT: CONNECTION SUCCESSFUL")
        print("=" * 60)
        print("\nYour network can reach Brevo's SMTP server.")
        print("If emails still fail, the issue is with credentials.")
        
    else:
        print(f"    FAILED: Cannot connect to port {smtp_port}")
        print(f"    Error code: {result}")
        raise ConnectionError("Port blocked or unreachable")
        
except socket.timeout:
    print(f"    FAILED: Connection timed out after {timeout} seconds")
    print("\n" + "=" * 60)
    print("DIAGNOSTIC RESULT: CONNECTION BLOCKED")
    print("=" * 60)
    print("\nPossible causes:")
    print("1. Windows Firewall blocking outbound SMTP")
    print("2. Antivirus/Security software blocking connection")
    print("3. ISP blocking SMTP ports (port 587)")
    print("4. Corporate network/VPN restrictions")
    
    print("\nSOLUTIONS:")
    print("\nOption 1: Try port 465 instead (SSL)")
    print("  - Update settings.py: EMAIL_PORT = 465")
    print("  - Update settings.py: EMAIL_USE_SSL = True")
    print("  - Update settings.py: EMAIL_USE_TLS = False")
    
    print("\nOption 2: Check Windows Firewall")
    print("  - Open Windows Security > Firewall & Network Protection")
    print("  - Click 'Allow an app through firewall'")
    print("  - Make sure Python is allowed for Private and Public networks")
    
    print("\nOption 3: Temporarily disable antivirus")
    print("  - Try disabling antivirus temporarily to test")
    print("  - If it works, add Python to antivirus exceptions")
    
    print("\nOption 4: Try a different network")
    print("  - Use mobile hotspot to test")
    print("  - If it works, your main network is blocking SMTP")
    
    sys.exit(1)
    
except Exception as e:
    print(f"    FAILED: {type(e).__name__}")
    print(f"    Error: {e}")
    
    print("\n" + "=" * 60)
    print("DIAGNOSTIC RESULT: CONNECTION ERROR")
    print("=" * 60)
    print("\nUnexpected error occurred.")
    print("Try the solutions listed above.")
    
    sys.exit(1)
finally:
    sock.close()

print("\n" + "=" * 60)
