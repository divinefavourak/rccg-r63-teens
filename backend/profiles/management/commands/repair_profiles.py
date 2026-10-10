"""Give every account that has no teen profile one built from the account.

    python manage.py repair_profiles            # list who is missing one
    python manage.py repair_profiles --apply    # create them
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from profiles.services import repair_profile


class Command(BaseCommand):
    help = 'Create the missing teen profile for every account that lacks one.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Create the profiles. Without it, only list them.')

    def handle(self, *args, apply=False, **options):
        users = get_user_model().objects.filter(teen_profile__isnull=True).order_by('date_joined')
        count = 0
        for user in users.iterator():
            count += 1
            label = f'{user.get_full_name() or user.username} <{user.email}>'
            if apply:
                repair_profile(user)
                self.stdout.write(f'created  {label}')
            else:
                self.stdout.write(f'missing  {label}')
        verb = 'Created' if apply else 'Would create'
        self.stdout.write(self.style.SUCCESS(f'{verb} {count} profile(s).'))
