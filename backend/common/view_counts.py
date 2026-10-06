"""
Counting a view once per viewer, not once per request.

`ViewableMixin.increment_view_count` is a database write. It was called on every
read of a devotional, manual, article, event or episode, so a page view cost a
write, and the number it produced counted requests, not people: an app that
refreshes a screen, a teen who opens today's reading three times, and a retried
request on a bad connection all pushed it up.

`count_view` remembers, for a few hours, that this viewer has seen this item,
and only writes the first time. The count becomes "how many people opened this",
which is what the Console shows it as, and most reads stop writing at all.
"""
from django.core.cache import cache

# Long enough that reopening something through a day counts once; short enough
# that coming back to it next week counts again.
WINDOW_SECONDS = 6 * 60 * 60


def _viewer(request):
    """Who is looking: the account if there is one, otherwise the address."""
    user = getattr(request, 'user', None)
    if user is not None and user.is_authenticated:
        return f'u{user.pk}'
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    address = forwarded.split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
    return f'a{address}'


def count_view(request, obj):
    """
    Count this request as a view of `obj` unless this viewer was counted lately.

    Returns True if the count went up. If the cache cannot be reached the view is
    counted, as it always was: a missing Redis should make the numbers a little
    generous, never freeze them.
    """
    key = f'viewed:{obj._meta.label_lower}:{obj.pk}:{_viewer(request)}'
    try:
        first_time = cache.add(key, 1, timeout=WINDOW_SECONDS)
    except Exception:
        first_time = None

    # `False` is the cache saying "already there". `None` is django-redis
    # swallowing a connection error (IGNORE_EXCEPTIONS), which is not a "no".
    if first_time is False:
        return False
    obj.increment_view_count()
    return True
