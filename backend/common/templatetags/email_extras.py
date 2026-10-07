"""Filters for the email templates in templates/emails/."""
from django import template

register = template.Library()


@register.filter
def humanize(value):
    """A status code as a person would say it: 'checked_in' -> 'Checked in'."""
    text = str(value or '').replace('_', ' ').strip().lower()
    return text[:1].upper() + text[1:]
