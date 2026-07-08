"""System checks — surface auth misconfiguration at deploy time (manage.py check
runs in build.sh) rather than at first request."""
from django.conf import settings
from django.core.checks import Warning, register


@register()
def otp_provider_not_dev_in_production(app_configs, **kwargs):
    if settings.DEBUG:
        return []
    provider = getattr(settings, 'OTP_PROVIDER', '') or ''
    if provider.endswith(('ConsoleOTPProvider', 'NoOpOTPProvider')):
        return [Warning(
            'OTP_PROVIDER is a dev/no-op backend but DEBUG is False — OTP requests '
            'will fail (ConsoleOTPProvider raises) or be dropped (NoOp) in production.',
            hint='Set OTP_PROVIDER to a real SMS/email backend (e.g. Termii, '
                 "Africa's Talking) before enabling OTP in staging/production.",
            id='users.W001',
        )]
    return []
