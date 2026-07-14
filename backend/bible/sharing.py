"""
Verse sharing — the growth loop, and the licensing boundary.

`docs/08-bible-experience.md` §3 calls verse sharing "the app's most important
organic growth loop": a teen puts Scripture on their WhatsApp status, and the
deep link brings their friends back into the reader.

It is also where Scripture licensing becomes code. §11's operating rules:

  2. "Every rendered licensed verse carries its required copyright line; the
      verse-share image generator must include translation attribution."
  3. "...must respect per-translation display limits (e.g., some licenses cap
      consecutive verses)."

Both are enforced here, once, so no surface can share a verse without its
attribution or past its licence's cap. Every licensing fact is a *field* on
`BibleTranslation`, never a branch in this module — adding a translation is
content ops, not engineering (§10).

**What this module does not do:** render the share image. It returns the
licensing-correct payload (text, reference, attribution, deep link); the client
composes it into the design system's templates (`docs/10-design-system.md`). The
backend owns what is *legally* correct to display; the client owns what it looks
like.
"""
from django.conf import settings

from . import references, services


class ShareLimitExceeded(ValueError):
    """The requested span exceeds the translation's licensed display limit."""


def app_name():
    return getattr(settings, 'APP_NAME', None) or 'Faith Tribe'


def deep_link(book_osis, chapter, start_verse=None, end_verse=None):
    """
    A link back into the reader at this passage.

    Built from OSIS code + numbers rather than a database id: the link must
    survive a re-import, and must resolve in *any* translation the recipient
    happens to read in (`docs/08-bible-experience.md` §10 — position is preserved
    across translations by OSIS code).
    """
    base = (getattr(settings, 'FRONTEND_URL', None) or '').rstrip('/')
    path = f'/bible/{book_osis}/{chapter}'
    if start_verse:
        path = f'{path}?verse={start_verse}'
        if end_verse and end_verse != start_verse:
            path = f'{path}&end={end_verse}'
    return f'{base}{path}' if base else path


def _enforce_licence_limit(translation, verse_count):
    cap = translation.max_consecutive_verses
    if cap and verse_count > cap:
        raise ShareLimitExceeded(
            f'{translation.code} permits sharing at most {cap} consecutive '
            f'verse(s) at a time; {verse_count} were requested.'
        )


def share_payload(translation, book_osis, chapter, start_verse=None, end_verse=None):
    """
    Everything a client needs to share a passage, licence-clean.

    Raises `ShareLimitExceeded` if the span exceeds the translation's cap, and
    `LookupError` if the passage has no imported text — you cannot share a verse
    whose words we do not have, and returning an empty share card would be worse
    than an honest error.
    """
    verses = list(services.resolve_reference(
        translation=translation,
        book_osis=book_osis,
        chapter_number=chapter,
        start_verse_number=start_verse,
        end_verse_number=end_verse,
    ))
    if not verses:
        raise LookupError('That passage has no text in this translation.')

    _enforce_licence_limit(translation, len(verses))

    book_name = verses[0].chapter.book.name
    # Render from the verses actually returned, not from the requested range: a
    # request for 16-20 in a chapter that ends at 18 must be attributed as 16-18.
    first, last = verses[0].number, verses[-1].number
    reference = references.format_reference(
        book_name, chapter, first if start_verse else None, last if start_verse else None,
    )

    text = ' '.join(verse.text.strip() for verse in verses).strip()
    link = deep_link(book_osis, chapter, start_verse, end_verse)

    # The format docs/08 §3 specifies by example:
    #   "For God so loved…" — John 3:16 (WEB), via Faith Tribe
    share_text = f'"{text}" — {reference} ({translation.code}), via {app_name()}'
    if link:
        share_text = f'{share_text}\n{link}'
    # A licensed text's copyright line is not optional and not decorative — it is
    # the condition on which we are permitted to render the verse at all.
    if translation.attribution_required and translation.copyright_notice:
        share_text = f'{share_text}\n\n{translation.copyright_notice}'

    return {
        'reference': reference,
        'book': book_osis,
        'chapter': chapter,
        'start_verse': first if start_verse else None,
        'end_verse': last if start_verse else None,
        'text': text,
        'verses': verses,
        'translation_code': translation.code,
        'attribution': translation.attribution,
        'attribution_required': translation.attribution_required,
        'deep_link': link,
        'share_text': share_text,
        # `copy_text` is the Copy action (§3), which is the same content without
        # the growth-loop link — a teen pasting a verse into an essay does not
        # want our URL in it.
        'copy_text': f'"{text}" — {reference} ({translation.code})',
    }
