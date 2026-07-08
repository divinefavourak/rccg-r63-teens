"""
OTP domain service — provider-agnostic generation and verification.

Security properties enforced here:
- codes are numeric, generated with ``secrets`` (CSPRNG);
- only an HMAC-SHA256 of the code is stored (keyed by SECRET_KEY);
- verification is constant-time (``hmac.compare_digest``);
- one live code per (destination, purpose): requesting a new one invalidates
  outstanding codes;
- codes expire (``OTP_TTL_SECONDS``) and cap attempts (``OTP_MAX_ATTEMPTS``);
- a verified code is consumed (single use).

Endpoint-level rate limiting is applied separately via the DRF ``otp`` throttle.
"""
import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import OTPCode
from .otp_providers import get_otp_provider


def _code_length():
    return int(getattr(settings, 'OTP_CODE_LENGTH', 6))


def _ttl_seconds():
    return int(getattr(settings, 'OTP_TTL_SECONDS', 600))


def _max_attempts():
    return int(getattr(settings, 'OTP_MAX_ATTEMPTS', 5))


def generate_code(length=None):
    length = length or _code_length()
    return ''.join(secrets.choice('0123456789') for _ in range(length))


def hash_code(code):
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


def _normalize(destination):
    return (destination or '').strip().lower()


def request_otp(destination, channel, purpose, user=None):
    """Generate, store (hashed), and dispatch a code. Returns the OTPCode."""
    destination = _normalize(destination)
    OTPCode.objects.filter(
        destination=destination, purpose=purpose, consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())

    code = generate_code()
    otp = OTPCode.objects.create(
        user=user, destination=destination, channel=channel, purpose=purpose,
        code_hash=hash_code(code),
        expires_at=timezone.now() + timedelta(seconds=_ttl_seconds()),
    )
    get_otp_provider().send(destination, channel, code, purpose)
    return otp


def verify_otp(destination, purpose, code):
    """Return the consumed OTPCode on success, else None (expired/wrong/exhausted)."""
    destination = _normalize(destination)
    otp = (
        OTPCode.objects
        .filter(destination=destination, purpose=purpose, consumed_at__isnull=True)
        .order_by('-created_at')
        .first()
    )
    if otp is None or otp.is_expired or otp.attempts >= _max_attempts():
        return None
    if hmac.compare_digest(hash_code(code), otp.code_hash):
        otp.consumed_at = timezone.now()
        otp.save(update_fields=['consumed_at'])
        return otp
    otp.attempts += 1
    otp.save(update_fields=['attempts'])
    return None
