"""
Import a Bible translation's text from a structured JSON file.

    python manage.py import_bible path/to/web.json
    python manage.py import_bible path/to/kjv.json --quiet

Idempotent: re-running the same file updates rows in place, so an import
interrupted halfway can simply be run again. See `bible/importers.py` for the
file format and the reasoning.
"""
import json

from django.core.management.base import BaseCommand, CommandError

from bible.importers import ImportError_, import_translation


class Command(BaseCommand):
    help = "Import a Bible translation's text from a structured JSON file."

    def add_arguments(self, parser):
        parser.add_argument('path', help='Path to the translation JSON file.')
        parser.add_argument(
            '--quiet', action='store_true',
            help='Suppress the per-book progress lines.',
        )

    def handle(self, *args, **options):
        path = options['path']
        try:
            with open(path, encoding='utf-8') as handle:
                payload = json.load(handle)
        except OSError as exc:
            # OSError, not FileNotFoundError: a directory passed by mistake, or a
            # file the worker cannot read, is the same class of operator error and
            # deserves the same clean message rather than a traceback.
            raise CommandError(f'Could not read {path}: {exc}') from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f'{path} is not valid JSON: {exc}') from exc

        progress = None if options['quiet'] else (
            lambda message: self.stdout.write(f'  {message}')
        )

        try:
            stats = import_translation(payload, progress=progress)
        except ImportError_ as exc:
            # A malformed file is operator error, not a crash: report it as a
            # clean command failure with the reason, not a traceback.
            raise CommandError(str(exc)) from exc

        translation = stats['translation']
        verb = 'Created' if stats['created'] else 'Updated'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} {translation.code} ({translation.name}): '
            f'{stats["books"]} books, {stats["chapters"]} chapters, '
            f'{stats["verses_written"]} verses written.'
        ))
        if not translation.is_public_domain and not translation.copyright_notice:
            # Not fatal — but a licensed text with no notice will render without
            # the attribution its licence requires (docs/08-bible-experience.md §11).
            self.stdout.write(self.style.WARNING(
                f'{translation.code} is not public domain but carries no '
                f'copyright_notice — its licence almost certainly requires one.'
            ))
