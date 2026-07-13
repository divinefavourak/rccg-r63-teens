"""Shared fixtures for the Progress test suite."""
from django.contrib.auth import get_user_model

User = get_user_model()


def make_user(username='teen', **kwargs):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x', **kwargs
    )
