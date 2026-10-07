"""
A whole translation in one file, for keeping on a phone.

`docs/08-bible-experience.md` §9 has the default translation cached on the device
and others "downloadable on demand". This is the download.

**One request, not one per book.** Every request to this backend pays for a few
round trips to the database before it does anything; 66 of them is half a minute
of server time per phone, against about a second for one.

**Built once, then served as a file.** Scripture does not change between imports,
so the 31,000 rows are read and laid out the first time a translation is asked
for, written to a file, and every later request is that file handed back. The
name carries the translation's last-import time and its verse count, so a
re-import makes a new file and the old one is simply never asked for again.

**Safe when several phones ask at once.** Each builder writes to its own
temporary file and renames it into place when it is complete. Renaming is atomic:
a reader gets either no file (and builds one) or a whole one, never half. Two
builders racing both finish and one rename wins; the files are identical.

The shape is compact because a phone downloads it over mobile data:

    {"translation": {...},
     "books": [{"osis": "John", "name": "John",
                "chapters": [{"id": "<uuid>", "number": 3,
                              "verses": [[16, "<uuid>", "For God so loved…"]]}]}]}

Verse and chapter ids are kept: bookmarks point at a verse id and reading history
at a chapter id, and a chapter read offline has to be the same chapter.
"""
import json
import os
import tempfile
from pathlib import Path

from .models import BibleVerse
from .serializers import BibleTranslationSerializer


def _directory():
    path = Path(tempfile.gettempdir()) / 'faithtribe-bible-packs'
    path.mkdir(parents=True, exist_ok=True)
    return path


def _verses(translation):
    return BibleVerse.objects.filter(chapter__book__translation=translation)


def path_for(translation):
    """Where this translation's pack lives. Changes whenever the text does."""
    stamp = int(translation.updated_at.timestamp())
    count = _verses(translation).count()
    return _directory() / f'{translation.code}-{stamp}-{count}.json'


def build(translation):
    """The pack as a Python structure. One query, however long the Bible."""
    rows = (
        _verses(translation)
        .order_by('chapter__book__book_number', 'chapter__number', 'number')
        .values_list(
            'chapter__book__osis_code', 'chapter__book__name',
            'chapter__number', 'chapter_id', 'number', 'id', 'text',
        )
        # Tuples, not model instances: 31,000 objects with their joins would be
        # several times the memory for nothing the pack needs.
        .iterator(chunk_size=2000)
    )

    books = []
    book = chapter = None
    for osis, name, chapter_number, chapter_id, number, verse_id, text in rows:
        if book is None or book['osis'] != osis:
            book = {'osis': osis, 'name': name, 'chapters': []}
            books.append(book)
            chapter = None
        if chapter is None or chapter['number'] != chapter_number:
            chapter = {'id': str(chapter_id), 'number': chapter_number, 'verses': []}
            book['chapters'].append(chapter)
        chapter['verses'].append([number, str(verse_id), text])

    return {
        'translation': BibleTranslationSerializer(translation).data,
        'books': books,
    }


def ensure(translation):
    """The path to this translation's pack, building it first if need be."""
    target = path_for(translation)
    if target.exists():
        return target

    # Written beside the target, so the rename below stays on one file system.
    handle, scratch = tempfile.mkstemp(dir=target.parent, suffix='.partial')
    try:
        with os.fdopen(handle, 'w', encoding='utf-8') as out:
            json.dump(build(translation), out, ensure_ascii=False, separators=(',', ':'))
        os.replace(scratch, target)
    except BaseException:
        if os.path.exists(scratch):
            os.unlink(scratch)
        raise
    return target
