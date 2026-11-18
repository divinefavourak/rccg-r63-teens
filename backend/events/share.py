"""
Sharing an event: the link a teen posts to a WhatsApp status or a group, and
what the page behind it needs (`share_views.py`).

The page does two jobs. A chat app fetches it to draw a preview, so it names
the event's flier as `og:image`. A person who taps it is sent straight on:
into the Android app where it is installed, otherwise into the web app.

The link uses the event's slug, so what people see in a status reads as words
(`thefaithtribe.live/e/teens-camp-2026`). An id works too.
"""
import io
import logging
import re
import uuid
import zlib
from urllib.parse import quote

from django.conf import settings
from django.core.cache import cache

from common.models import PublishableMixin

from .models import Event

logger = logging.getLogger(__name__)


def find(key):
    """The published event a share link names, by slug or by id, or None."""
    events = Event.objects.filter(status=PublishableMixin.Status.PUBLISHED)
    try:
        pk = uuid.UUID(str(key))
    except ValueError:
        return events.filter(slug=key).first()
    return events.filter(pk=pk).first() or events.filter(slug=key).first()


def _key(event):
    return event.slug or str(event.pk)


def api_base(request=None):
    """This API's address from outside, no path."""
    if settings.PUBLIC_API_URL:
        return settings.PUBLIC_API_URL
    return request.build_absolute_uri('/').rstrip('/') if request else ''


def link(event, request=None):
    """
    The whole address to share. On our own site (`EVENT_LINK_BASE`, which
    proxies to this API) when that is set, so the link is short and shows our
    name; otherwise on the API's own address.
    """
    key = quote(_key(event), safe='')
    if settings.EVENT_LINK_BASE:
        return f'{settings.EVENT_LINK_BASE}/{key}'
    return f'{api_base(request)}/api/v1/events/share/{key}/'


def web_app_url(event):
    """The event in the web app, which anyone can open without an account."""
    return f'{settings.WEB_APP_URL}/event/{event.pk}'


def android_intent_url(event):
    """
    Opens the event in the Android app, or the web app where the app is not
    installed: Chrome follows `browser_fallback_url` itself, with no waiting
    and guessing in script.
    """
    fallback = quote(web_app_url(event), safe='')
    return (
        f'intent://event/{event.pk}#Intent;scheme={settings.MOBILE_APP_SCHEME};'
        f'package={settings.ANDROID_APP_PACKAGE};S.browser_fallback_url={fallback};end'
    )


def preview_image_url(event, request=None):
    """
    The picture under a shared link: the flier, made small enough for chat
    apps to show (`flier_jpeg`), or the site's own card when there is none.
    `v` changes with the flier, so a new one is not served from an old cache.
    """
    if event.cover_image:
        # crc32, not hash(): Python salts str hashes per process, and each
        # worker would name the picture differently.
        version = zlib.crc32(event.cover_image.name.encode())
        key = quote(_key(event), safe='')
        return f'{api_base(request)}/api/v1/events/share/{key}/flier.jpg?v={version}'
    if settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip('/') + '/og-image.jpg'
    return ''


# ── The flier, made small ────────────────────────────────────────────────────

# WhatsApp leaves the picture out of a preview when the image is much over
# about 300 KB, and fliers are often exported at several MB.
FLIER_EDGE = 1200
FLIER_BUDGET = 300 * 1024
FLIER_CACHE_SECONDS = 60 * 60 * 24 * 30


def flier_jpeg(event):
    """
    The event's flier as a JPEG within `FLIER_BUDGET`, or None when there is
    no flier or it cannot be read. Kept in the cache by the flier's file name,
    so a new flier is a new entry and nothing needs clearing.
    """
    if not event.cover_image:
        return None
    # v2: v1 re-encoded fliers that were already small, and made them bigger.
    cache_key = f'events:share-flier:v2:{event.pk}:{event.cover_image.name}'
    data = cache.get(cache_key)
    if data:
        return data

    try:
        from PIL import Image

        with event.cover_image.open('rb') as file:
            raw = file.read()
        image = Image.open(io.BytesIO(raw))

        # Already fit to send: a JPEG within the budget and the size, and
        # upright. Most fliers arrive through WhatsApp like this, and encoding
        # one again only makes it bigger (a 98 KB flier came back as 142 KB).
        if (
            image.format == 'JPEG'
            and len(raw) <= FLIER_BUDGET
            and max(image.size) <= FLIER_EDGE
            and image.getexif().get(_EXIF_ORIENTATION, 1) == 1
        ):
            data = raw
        else:
            data = _shrink(image)
    except Exception:  # A broken upload or storage: the page still works without it.
        logger.exception('Could not make a share preview from the flier of event %s', event.pk)
        return None

    cache.set(cache_key, data, FLIER_CACHE_SECONDS)
    return data


_EXIF_ORIENTATION = 0x0112


def _shrink(image):
    """`image` as an upright RGB JPEG within `FLIER_EDGE` and `FLIER_BUDGET`."""
    from PIL import Image, ImageOps

    # Lets the JPEG decoder scale down as it reads, so a photo from a phone
    # camera is never held in memory at full size.
    image.draft('RGB', (FLIER_EDGE, FLIER_EDGE))
    image = ImageOps.exif_transpose(image)
    image.thumbnail((FLIER_EDGE, FLIER_EDGE))
    if image.mode != 'RGB':
        # A transparent PNG goes onto white, not the black JPEG gives it.
        rgba = image.convert('RGBA')
        image = Image.new('RGB', rgba.size, (255, 255, 255))
        image.paste(rgba, mask=rgba.getchannel('A'))

    # Lower the quality first, then the size: a busy flier full of small text
    # can still be too big at 1200px, and a smaller picture beats none.
    for edge in (FLIER_EDGE, 900, 700, 500):
        if max(image.size) > edge:
            image.thumbnail((edge, edge))
        for quality in (82, 70, 58):
            out = io.BytesIO()
            image.save(out, 'JPEG', quality=quality, optimize=True, progressive=True)
            data = out.getvalue()
            if len(data) <= FLIER_BUDGET:
                return data
    return data


# ── Words without the marks ──────────────────────────────────────────────────
#
# The description is written in the small Markdown of
# `mobile/src/data/markdown.ts`. A chat preview shows plain text, so the marks
# come off here. Close enough for a preview line: it never has to be exact.

_RULE = re.compile(r'^\s{0,3}([-*_])(\s*\1){2,}\s*$', re.M)
_BLOCK_MARK = re.compile(r'^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d{1,9}[.)]\s+)', re.M)
_LINK = re.compile(r'\[([^\]\n]+)\]\(\s*\S+?\s*\)')
_STRONG = re.compile(r'(\*\*|__|~~)(?=\S)(.+?)(?<=[^\s\\])\1')
_EM = re.compile(r'(?<![\w*\\])([*_])(?=[^\s*_])(.+?)(?<=[^\s\\])\1(?![\w*])')
_ESCAPE = re.compile(r'\\([\\`*_{}\[\]()#+\-.!>~|])')


def plain_text(source, limit=None):
    """`source` as one line of plain words, cut at a word near `limit`."""
    text = _RULE.sub('', source or '')
    text = _BLOCK_MARK.sub('', text)
    text = _LINK.sub(r'\1', text)
    for _ in range(2):  # Twice, for bold inside italic and the like.
        text = _STRONG.sub(r'\2', text)
        text = _EM.sub(r'\2', text)
    text = _ESCAPE.sub(r'\1', text)
    text = ' '.join(text.split())
    if limit and len(text) > limit:
        text = text[:limit].rsplit(' ', 1)[0].rstrip(',.;:!?-') + '…'
    return text
