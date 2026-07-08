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
from django.utils.module_loading import import_string

logger = logging.getLogger(__name__)


class OTPProvider(ABC):
    """Deliver a one-time code to a destination over a channel."""

    @abstractmethod
    def send(self, destination, channel, code, purpose):
        raise NotImplementedError


class ConsoleOTPProvider(OTPProvider):
    """Logs the code instead of sending it. Default for dev/test."""

    def send(self, destination, channel, code, purpose):
        logger.info('[OTP] (%s/%s) code for %s: %s', channel, purpose, destination, code)


class NoOpOTPProvider(OTPProvider):
    """Silently drops the message (e.g. for load tests)."""

    def send(self, destination, channel, code, purpose):
        return None


def get_otp_provider():
    """Instantiate the configured provider (dotted path in settings.OTP_PROVIDER)."""
    dotted = getattr(settings, 'OTP_PROVIDER', 'users.otp_providers.ConsoleOTPProvider')
    return import_string(dotted)()
