"""
Management command to seed two test users for age-group UI testing.

Usage:
    python manage.py seed_test_users

Creates (idempotent — safe to run multiple times):
  - test_toddler   / test_toddler@r63teens.test   (age 4  → toddler)
  - test_preteen   / test_preteen@r63teens.test   (age 10 → pre_teen)

Password for both: TestPass123!
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

_PASSWORD = 'TestPass123!'

_USERS = [
    {
        'username': 'test_toddler',
        'email': 'test_toddler@r63teens.test',
        'first_name': 'Temi',
        'last_name': 'Toddler',
        'gender': 'female',
        'dob_years_ago': 4,
        'expected_group': 'toddler',
    },
    {
        'username': 'test_preteen',
        'email': 'test_preteen@r63teens.test',
        'first_name': 'Preye',
        'last_name': 'Preteen',
        'gender': 'male',
        'dob_years_ago': 10,
        'expected_group': 'pre_teen',
    },
]


class Command(BaseCommand):
    help = 'Seed two test users (toddler + pre-teen) for age-group UI testing.'

    def handle(self, *args, **options):
        from profiles.models import TeenProfile

        today = date.today()

        for spec in _USERS:
            dob = today.replace(year=today.year - spec['dob_years_ago'])
            user, created = User.objects.get_or_create(
                username=spec['username'],
                defaults={
                    'email': spec['email'],
                    'first_name': spec['first_name'],
                    'last_name': spec['last_name'],
                    'gender': spec['gender'],
                    'role': 'teen',
                    'is_active': True,
                },
            )
            if created:
                user.set_password(_PASSWORD)
                user.save()

            profile, _ = TeenProfile.objects.get_or_create(
                user=user,
                defaults={
                    'date_of_birth': dob,
                    'gender': spec['gender'],
                },
            )
            if profile.date_of_birth != dob:
                profile.date_of_birth = dob
                profile.save()

            action = 'created' if created else 'already exists'
            self.stdout.write(
                self.style.SUCCESS(
                    f"  {spec['username']} ({action}) — age_group={profile.age_group}"
                )
            )

        self.stdout.write('\nLogin with password: ' + self.style.WARNING(_PASSWORD))
        self.stdout.write('Then visit /dashboard to see each age-group UI.\n')
