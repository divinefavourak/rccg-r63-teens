"""
The one check every username change goes through.

Everyone may change their own username (the app's and the website's profile
screens); coordinators may change one for someone in their part of the church.
The model already holds the shape (3+ characters: letters, digits, @ . + - _).
This adds what a database constraint cannot:

- Sign-in matches a username exactly, so two that differ only in capitals
  ("Ada", "ada") would be two accounts nobody can tell apart. Refused.
- A few names would let anyone pass as the church's own staff. Refused, unless
  the account already has it (an old admin account can still save its form).
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers

RESERVED = {
    'admin', 'administrator', 'faithtribe', 'faith_tribe', 'faith.tribe',
    'support', 'help', 'staff', 'moderator', 'system', 'root', 'rccg',
    'coordinator', 'teacher', 'pastor',
}


def model_validators():
    """The username column's own validators, for serializers without a model source."""
    return list(get_user_model()._meta.get_field('username').validators)


def clean_username(value, user=None):
    """Return the username to store, or raise a field error a person can act on."""
    User = get_user_model()
    value = (value or '').strip()
    current = (getattr(user, 'username', '') or '')
    if value == current:
        return value
    if value.lower() in RESERVED and value.lower() != current.lower():
        raise serializers.ValidationError(
            'That username is kept for the Faith Tribe team. Try another.')
    taken = User.objects.filter(username__iexact=value)
    if user is not None and user.pk:
        taken = taken.exclude(pk=user.pk)
    if taken.exists():
        raise serializers.ValidationError('That username is taken. Try another.')
    return value
