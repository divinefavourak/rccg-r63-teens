"""
What leaves the server for Sentry, and what is blanked first.

Most users are under 18. `send_default_pii=False` keeps the user, IP address
and cookies out, and `max_request_body_size='never'` keeps request bodies out,
but neither touches the text of a log message or the value of a local
variable. Messages such as ``'Email failed to %s'`` would carry a parent's or
a teen's address straight to Sentry.

`scrub_event` and `scrub_log` run on every error report and every Sentry log
just before it is sent, and replace email addresses and Nigerian phone numbers
anywhere in it with a marker. If scrubbing ever fails, the report is dropped
rather than sent unscrubbed: losing one report is better than leaking a
child's details.
"""
import re

EMAIL_MARK = '[email]'
PHONE_MARK = '[phone]'

_EMAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
# +2348012345678, 2348012345678, 08012345678 (spaces or dashes allowed after
# the prefix). Nigerian mobile numbers start 70, 80, 81, 90 or 91.
_PHONE = re.compile(r'(?<!\d)(?:\+?234[\s-]?|0)[789][01](?:[\s-]?\d){8}(?!\d)')


def scrub_text(text):
    """Blank email addresses and phone numbers in one string."""
    return _PHONE.sub(PHONE_MARK, _EMAIL.sub(EMAIL_MARK, text))


def _scrub(value, depth=0):
    # Events are nested dicts and lists a few levels deep (exception → stack
    # frames → local variables). The depth cap is a guard against a cycle, not
    # a limit anything real reaches.
    if depth > 30:
        return value
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, dict):
        return {key: _scrub(item, depth + 1) for key, item in value.items()}
    if isinstance(value, list):
        return [_scrub(item, depth + 1) for item in value]
    if isinstance(value, tuple):
        return tuple(_scrub(item, depth + 1) for item in value)
    return value


def scrub_event(event, hint):
    """`before_send`: an error report, with personal details blanked."""
    try:
        return _scrub(event)
    except Exception:
        return None


def scrub_log(log, hint):
    """`before_send_log`: a Sentry log, with personal details blanked."""
    try:
        return _scrub(log)
    except Exception:
        return None
