"""Shared fixtures for the Bible test suite."""
from django.contrib.auth import get_user_model

from bible.models import BibleBook, BibleChapter, BibleTranslation, BibleVerse, Testament

User = get_user_model()


def make_user(username='teen', **kwargs):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x', **kwargs
    )


def make_translation(code='WEB', is_default=True, **kwargs):
    defaults = dict(
        name='World English Bible',
        language_code='en',
        is_public_domain=True,
        is_offline_capable=True,
        is_default=is_default,
        is_active=True,
    )
    defaults.update(kwargs)
    return BibleTranslation.objects.create(code=code, **defaults)


def make_book(translation, osis_code='John', name='John', book_number=43,
              testament=Testament.NEW, **kwargs):
    return BibleBook.objects.create(
        translation=translation, osis_code=osis_code, name=name,
        book_number=book_number, testament=testament, **kwargs
    )


def make_chapter(book, number=3, verse_count=0):
    return BibleChapter.objects.create(book=book, number=number, verse_count=verse_count)


def make_verse(chapter, number=16, text='For God so loved the world...'):
    return BibleVerse.objects.create(chapter=chapter, number=number, text=text)


def make_passage(translation=None, verse_numbers=(16, 17)):
    """A translation -> book -> chapter -> verses chain. Returns the pieces."""
    translation = translation or make_translation()
    book = make_book(translation)
    chapter = make_chapter(book, verse_count=len(verse_numbers))
    verses = [make_verse(chapter, number=n, text=f'Verse {n} text.') for n in verse_numbers]
    return translation, book, chapter, verses
