"""
Rebuild the Scripture full-text index.

    python manage.py rebuild_bible_search
    python manage.py rebuild_bible_search --translation WEB

The importer builds `search_vector` as it writes text, so this is not part of the
normal ingestion path. It exists for the two cases that path does not cover:

* text imported before the search index existed;
* a change to `SEARCH_CONFIGS` (e.g. adding a stemmer for a new language), which
  changes how existing text must be indexed without changing the text itself.

Works chapter by chapter so a Bible-sized rebuild holds one chapter in memory,
not 31,000 verses.
"""
from django.core.management.base import BaseCommand, CommandError

from bible.models import BibleChapter, BibleTranslation
from bible.search import build_search_vectors


class Command(BaseCommand):
    help = 'Rebuild the Scripture full-text search index.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--translation', help='Translation code to rebuild (default: all).',
        )

    def handle(self, *args, **options):
        chapters = BibleChapter.objects.select_related('book', 'book__translation')

        code = options.get('translation')
        if code:
            translation = BibleTranslation.objects.filter(code__iexact=code).first()
            if translation is None:
                raise CommandError(f'No translation with code {code!r}.')
            chapters = chapters.filter(book__translation=translation)

        chapter_count = verse_count = 0
        for chapter in chapters.iterator():
            verse_count += build_search_vectors(chapter)
            chapter_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Rebuilt {verse_count} verses across {chapter_count} chapters.'
        ))
