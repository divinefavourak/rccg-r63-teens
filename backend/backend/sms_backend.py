"""
SMS through Termii's HTTPS API.

Switched on for one-time codes with
``OTP_SMS_BACKEND=backend.sms_backend.send_termii_sms``.
"""
import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

TIMEOUT = 20


def send_termii_sms(phone, message):
    """Send one SMS. Raises if Termii refuses or cannot be reached.

    The caller decides what a failure means: the OTP provider logs it and
    carries on, because the same code also goes out by email.
    """
    api_key = getattr(settings, 'TERMII_API_KEY', '')
    # Each Termii account has its own base URL, shown on its dashboard.
    base_url = getattr(settings, 'TERMII_BASE_URL', '')
    if not api_key or not base_url:
        raise ImproperlyConfigured(
            'TERMII_API_KEY and TERMII_BASE_URL must both be set. SMS cannot send.')

    response = requests.post(
        f'{base_url.rstrip("/")}/api/sms/send',
        json={
            'api_key': api_key,
            'to': phone.lstrip('+'),
            # Must be a sender ID Termii has approved for the account.
            'from': settings.TERMII_SENDER_ID,
            'sms': message,
            'type': 'plain',
            # 'dnd' reaches numbers with Do Not Disturb on; Termii warns that
            # codes sent on 'generic' fail and can get the sender ID blocked.
            'channel': settings.TERMII_SMS_CHANNEL,
        },
        headers={'accept': 'application/json'},
        timeout=TIMEOUT,
    )
    if response.status_code >= 300:
        # Termii says why in the body: no balance, an unapproved sender, a bad key.
        raise RuntimeError(f'Termii answered {response.status_code}: {response.text[:300]}')
