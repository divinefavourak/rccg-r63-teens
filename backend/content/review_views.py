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

    @action(detail=False, methods=['get'],
            permission_classes=[HasPermission(Perm.CONTENT_VIEW)])
    def review_queue(self, request):
        """
        What is waiting for a second person, longest wait first.

        `GET /content/<devotionals|manuals|articles>/review_queue/`

        The list endpoints do not say who submitted an item, and should not:
        they are what every teen reads. This is the Console's view, for people
        who hold `content.view`, and it answers the one question the two-person
        rule turns on. `is_mine` is decided here so no client compares ids, and
        `can_approve` is the same predicate `review.approve` enforces.
        """
        model = self.queryset.model
        queue = (
            model.objects.filter(status='in_review')
            .select_related('submitted_by', 'submitted_by__profile')
            .order_by('submitted_at', 'created_at')
        )
        has_verses = hasattr(model, 'memory_verses')
        if has_verses:
            queue = queue.prefetch_related('memory_verses')

        total = queue.count()
        results = []
        for item in queue[:200]:
            author = item.submitted_by
            mine = author is not None and author.pk == request.user.pk
            for_date = getattr(item, 'date', None) or getattr(item, 'week_start_date', None)
            row = {
                'id': str(item.pk),
                'kind': model._meta.model_name,
                'title': item.title,
                'for_date': for_date,
                'status': item.status,
                'submitted_at': item.submitted_at,
                'submitted_by': None if author is None else {
                    'id': str(author.pk),
                    'display_name': _display_name(author),
                },
                'is_mine': mine,
                'can_approve': not (review.requires_two_person_review(item) and mine),
            }
            if has_verses:
                # Publishing needs a memory verse; the legacy text fields count
                # because `ensure_primary_memory_verse` derives one from them.
                row['has_memory_verse'] = bool(
                    any(v.is_primary for v in item.memory_verses.all())
                    or getattr(item, 'memory_verse_passage', '')
                )
            results.append(row)
        return Response({'count': total, 'results': results})


def _display_name(user):
    profile = getattr(user, 'profile', None)
    if profile and profile.display_name:
        return profile.display_name
    full = f'{user.first_name} {user.last_name}'.strip()
    return full or user.get_username()
