"""
Progress data is private by default — a teen's streak, history and Grace-Day
balance are theirs alone, with no leaderboards and no coordinator/parent view
(`docs/07-feature-specifications.md` §8, `docs/12-gamification.md`).

`IsOwner` grants object access to `obj.user` and to nobody else — deliberately
no role or superuser bypass, the same stance the Bible personal layer takes for
notes. Owner-scoped viewsets additionally filter `get_queryset` to the requester,
so someone else's row 404s (never confirmed to exist) rather than 403s.
"""
from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Object access restricted to `obj.user`. No role or superuser override."""

    message = 'This belongs to another user.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id
