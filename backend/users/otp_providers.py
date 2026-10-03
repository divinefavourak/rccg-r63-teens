"""
OTP delivery provider abstraction.

The domain (generation, hashing, verification, throttling) is provider-agnostic;
delivery is pluggable. A console backend is the default for dev/test — a real SMS
provider (Termii / Africa's Talking) is a future config change: implement
``OTPProvider.send`` and point ``settings.OTP_PROVIDER`` at it.
"""
import logging
from abc import ABC, abstractmethod

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.module_loading import import_string

logger = logging.getLogger(__name__)


class OTPProvider(ABC):
    """Deliver a one-time code to a destination over a channel."""

    @abstractmethod
    def send(self, destination, channel, code, purpose):
        raise NotImplementedError


def mask_destination(destination):
    """Mask an email/phone for safe logging (no full PII in logs)."""
    s = destination or ''
    if '@' in s:
        name, _, domain = s.partition('@')
        return f'{name[:2]}***@{domain}'
    return f'***{s[-4:]}' if len(s) > 4 else '***'


class ConsoleOTPProvider(OTPProvider):
    """Logs the code instead of sending it. DEV/TEST ONLY."""

    def send(self, destination, channel, code, purpose):
        if not settings.DEBUG:
            raise ImproperlyConfigured(
                'ConsoleOTPProvider must not be used in production. Set OTP_PROVIDER '
                'to a real SMS/email backend.'
            )
        # INFO carries only masked context; the code itself is DEBUG-only.
        logger.info('[OTP] (%s/%s) code issued for %s', channel, purpose, mask_destination(destination))
        logger.debug('[OTP] code for %s: %s', destination, code)


class NoOpOTPProvider(OTPProvider):
    """Silently drops the message (e.g. for load tests)."""

    def send(self, destination, channel, code, purpose):
        return None


class EmailAndSmsOTPProvider(OTPProvider):
    """Production provider: email through the transactional mailer, SMS through
    a pluggable backend.

    Email works as soon as the mail settings do. SMS needs a paid gateway
    (Termii / Africa's Talking), so it is a separate switch: point
    ``settings.OTP_SMS_BACKEND`` at a callable ``(phone, message) -> None``.
    Until that is set the SMS leg is skipped — logged, never raised — because
    sign-up issues the same code to the email address and that copy is enough
    to finish.
    """

    def send(self, destination, channel, code, purpose):
        if channel == 'email':
            from .email_service import UserEmailService
            UserEmailService.send_otp_email(destination, code, purpose)
            return

        dotted = getattr(settings, 'OTP_SMS_BACKEND', '')
        if not dotted:
            logger.info('[OTP] SMS skipped for %s: no OTP_SMS_BACKEND configured',
                        mask_destination(destination))
            return
        minutes = max(1, int(getattr(settings, 'OTP_TTL_SECONDS', 600)) // 60)
        message = f'Your Faith Tribe code is {code}. It expires in {minutes} minutes.'
        try:
            import_string(dotted)(destination, message)
        except Exception:
            # A gateway outage must not turn into a 500 on sign-up: the email
            # copy of the code is still on its way.
            logger.exception('[OTP] SMS send failed for %s', mask_destination(destination))


def get_otp_provider():
    """Instantiate the configured provider (dotted path in settings.OTP_PROVIDER)."""
    dotted = getattr(settings, 'OTP_PROVIDER', 'users.otp_providers.ConsoleOTPProvider')
    return import_string(dotted)()
