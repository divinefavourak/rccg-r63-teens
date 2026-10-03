"""
The plain-text part of an HTML email.

Every email goes out with a text/plain alternative for clients that will not
show HTML (and for spam filters, which like to see one). `strip_tags` alone
is not enough for that: it keeps the text of the <style> block, loses every
link's address — so a reset email would arrive without its reset link — and
leaves the template's indentation as runs of blank lines.
"""
import html
import re

from django.utils.html import strip_tags

_HEAD = re.compile(r'<head\b.*?</head\s*>', re.S | re.I)
_COMMENT = re.compile(r'<!--.*?-->', re.S)
_LINK = re.compile(r'<a\b[^>]*?\bhref="([^"]*)"[^>]*>(.*?)</a\s*>', re.S | re.I)
_BREAK = re.compile(r'<br\s*/?>|</?(?:p|div|tr|li|h[1-6]|table)\b[^>]*>', re.I)
_CELL = re.compile(r'</td\s*>', re.I)


def _link(match):
    # The address stays escaped (`&amp;`) until the very end: strip_tags reads
    # a bare `&token` in a query string as an entity and rewrites it.
    href = match.group(1).strip()
    label = html.unescape(strip_tags(match.group(2))).strip()
    if not href or href.startswith(('#', 'mailto:')) or html.unescape(href) == label:
        return match.group(2)
    return f'{match.group(2)} ({href})'


def html_to_text(html_content):
    text = _HEAD.sub('', html_content)
    text = _COMMENT.sub('', text)
    # Line breaks in the source are only template indentation; the real ones
    # come from the block-level tags below.
    text = ' '.join(text.split())
    text = _LINK.sub(_link, text)
    text = _BREAK.sub('\n', text)
    text = _CELL.sub(' ', text)
    text = html.unescape(strip_tags(text)).replace('\xa0', ' ')

    lines = []
    for line in text.splitlines():
        line = ' '.join(line.split())
        if line or (lines and lines[-1]):
            lines.append(line)
    return '\n'.join(lines).strip()
