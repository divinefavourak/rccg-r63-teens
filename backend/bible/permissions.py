"""
Permissions for the Bible domain.

Two rules, both straight from the docs:

* **Scripture is public.** Anyone — signed in or not — may read translations,
  books, chapters and verses. Writing Scripture requires `bible.manage`, which is
  handled by the shared `HasPermissionOrReadOnly` from `identity.authorization`.

* **The personal layer is owner-only.** Bookmarks, highlights, notes, reading
  history and reading position belong to exactly one teen. `IsOwner` grants
  access to that teen and to nobody else — deliberately *not*
  `IsSelfOrHasPermission`, which would also admit any role holding some
  permission. Notes are "private absolutely — never visible to teachers,
  coordinators, parents, or admins" (`docs/08-bible-experience.md` §3;
  `docs/13-community.md` privacy rules), so there is no permission that unlocks
  them and no superuser bypass on this surface.
"""
from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Object access restricted to `obj.user`. No role or superuser override."""

    message = 'This belongs to another user.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id
