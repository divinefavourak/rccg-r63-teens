"""
The review-workflow actions, as a viewset mixin.

Mixed into every reviewable content viewset so devotionals, manuals and articles
run the *same* gate. A per-viewset copy of these four actions is how one of them
eventually ends up missing the two-person check.

Permission split (`identity.permissions_registry`):
  * `content.manage`  — author. May create, edit, submit for review.
  * `content.publish` — reviewer. May approve, reject, schedule, publish.

The split is what makes the two-person rule enforceable at all: holding
`content.manage` is not enough to approve your own work. Note that a user holding
*both* permissions still cannot approve their own submission — the rule compares
identities, not capabilities (`content/services/review.py`).
"""
from django.core.exceptions import PermissionDenied, ValidationError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from identity.authorization import HasPermission
from identity.permissions_registry import Perm

from .services import review


def _error(exc, code):
    detail = getattr(exc, 'messages', None) or [str(exc)]
    return Response({'detail': detail[0]}, status=code)


class ReviewWorkflowMixin:
    """Adds submit / approve / reject / publish to a reviewable content viewset."""

    @action(detail=True, methods=['post'],
            permission_classes=[HasPermission(Perm.CONTENT_MANAGE)])
    def submit_for_review(self, request, pk=None):
        try:
            item = review.submit_for_review(self.get_object(), request.user)
        except ValidationError as exc:
            return _error(exc, status.HTTP_400_BAD_REQUEST)
        return Response({'status': item.status, 'submitted_by': str(request.user.id)})

    @action(detail=True, methods=['post'],
            permission_classes=[HasPermission(Perm.CONTENT_PUBLISH)])
    def approve(self, request, pk=None):
        try:
            item = review.approve(self.get_object(), request.user)
        except PermissionDenied as exc:
            # 403: the request is well-formed and the caller may publish in
            # general — they simply may not be both halves of a two-person check.
            return _error(exc, status.HTTP_403_FORBIDDEN)
        except ValidationError as exc:
            return _error(exc, status.HTTP_400_BAD_REQUEST)
        return Response({'status': item.status, 'approved_by': str(request.user.id)})

    @action(detail=True, methods=['post'],
            permission_classes=[HasPermission(Perm.CONTENT_PUBLISH)])
    def reject(self, request, pk=None):
        try:
            item = review.reject(
                self.get_object(), request.user,
                notes=request.data.get('notes', ''),
            )
        except ValidationError as exc:
            return _error(exc, status.HTTP_400_BAD_REQUEST)
        return Response({'status': item.status, 'review_notes': item.review_notes})

    @action(detail=True, methods=['post'],
            permission_classes=[HasPermission(Perm.CONTENT_PUBLISH)])
    def publish(self, request, pk=None):
        try:
            item = review.publish(self.get_object(), request.user)
        except PermissionDenied as exc:
            return _error(exc, status.HTTP_403_FORBIDDEN)
        except ValidationError as exc:
            return _error(exc, status.HTTP_400_BAD_REQUEST)
        return Response({'status': item.status, 'published_at': item.published_at})
