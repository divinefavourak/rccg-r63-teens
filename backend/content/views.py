"""
Views for the content app (devotionals, manuals, articles).
"""
from django.db import models
from rest_framework import viewsets, generics, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from datetime import date, timedelta

from identity.authorization import HasPermission, HasPermissionOrReadOnly, has_any_permission
from identity.permissions_registry import Perm
from .models import Devotional, ManualSeries, Manual, Article, UserReadLog, UserLikeLog
from .serializers import (
    DevotionalListSerializer,
    DevotionalDetailSerializer,
    DevotionalCreateUpdateSerializer,
    ManualSeriesListSerializer,
    ManualSeriesDetailSerializer,
    ManualListSerializer,
    ManualDetailSerializer,
    ManualCreateUpdateSerializer,
    ManualTeacherDetailSerializer,
    ArticleListSerializer,
    ArticleDetailSerializer,
)


def get_age_group_filter(user):
    """
    Returns a Q filter for age-group-targeted content.
    Empty target_age_groups means show to all.
    Admins and coordinators always see everything.
    Teachers see content for their assigned age groups.
    """
    from django.db.models import Q
    if not user or not user.is_authenticated:
        return Q(target_age_groups=[]) | Q(target_age_groups__isnull=True)
    # Leaders who can view all content (admins/coordinators via content.view).
    if has_any_permission(user, Perm.CONTENT_VIEW):
        return Q()  # no filter — see all
    if hasattr(user, 'teacher_profile'):
        try:
            age_groups = user.teacher_profile.assigned_age_groups or []
        except Exception:
            age_groups = []
        q = Q(target_age_groups=[])
        for ag in age_groups:
            q |= Q(target_age_groups__contains=ag)
        return q
    # Regular users — filter by their age group
    try:
        age_group = user.teen_profile.age_group
    except Exception:
        return Q(target_age_groups=[])
    return Q(target_age_groups=[]) | Q(target_age_groups__contains=age_group)


class DevotionalViewSet(viewsets.ModelViewSet):
    """ViewSet for devotionals."""
    
    queryset = Devotional.objects.all()
    permission_classes = [HasPermissionOrReadOnly(Perm.CONTENT_MANAGE)]
    lookup_field = 'pk'
    filterset_fields = ['status', 'date']
    search_fields = ['title', 'content', 'anchor_scripture']
    ordering_fields = ['date', 'created_at', 'view_count']
    ordering = ['-date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DevotionalCreateUpdateSerializer
        elif self.action == 'list':
            return DevotionalListSerializer
        return DevotionalDetailSerializer
    
    def get_queryset(self):
        queryset = self.queryset
        
        # Non-admins only see published content
        if not self.request.user.is_authenticated or not has_any_permission(self.request.user, Perm.CONTENT_MANAGE):
            queryset = queryset.filter(status='published')

        # Age group filtering for non-admin/non-coordinator users
        if not has_any_permission(self.request.user, Perm.CONTENT_VIEW):
            queryset = queryset.filter(get_age_group_filter(self.request.user))

        # Date range filtering
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        
        return queryset
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.increment_view_count()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's devotional."""
        today = date.today()
        devotional = self.get_queryset().filter(date=today).first()
        
        if not devotional:
            return Response(
                {'detail': 'No devotional found for today.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        devotional.increment_view_count()
        serializer = DevotionalDetailSerializer(devotional)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_date(self, request):
        """Get devotional by specific date."""
        date_str = request.query_params.get('date')
        if not date_str:
            return Response(
                {'detail': 'date parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        devotional = self.get_queryset().filter(date=date_str).first()
        if not devotional:
            return Response(
                {'detail': 'No devotional found for this date.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = DevotionalDetailSerializer(devotional)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mark_read(self, request, pk=None):
        """
        Mark a devotional as read for any authenticated user.
        Uses UserReadLog for deduplication (works without a TeenProfile).
        Also updates TeenProfile streak if the user has one.
        """
        devotional = self.get_object()

        # Deduplicate via UserReadLog — works for ALL users
        log, created = UserReadLog.objects.get_or_create(
            user=request.user,
            devotional=devotional,
        )

        streak_days = 0
        total_read = 0

        if created:
            devotional.increment_read_count()

            # Update streak only for users that have a full TeenProfile
            try:
                profile = request.user.teen_profile
                profile.update_streak(date.today())
                streak_days = profile.streak_days
                total_read = profile.devotionals_read_count
            except Exception:
                # No TeenProfile — streak not tracked, that's fine
                pass

        else:
            # Already read — return current streak if profile exists
            try:
                profile = request.user.teen_profile
                streak_days = profile.streak_days
                total_read = profile.devotionals_read_count
            except Exception:
                pass

        return Response({
            'success': True,
            'streak_days': streak_days,
            'total_read': total_read,
            'already_read': not created,
        })
        
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_reads(self, request):
        """Return IDs of devotionals the current user has read/liked + streak info."""
        read_ids = list(
            UserReadLog.objects.filter(user=request.user)
            .values_list('devotional_id', flat=True)
        )
        like_ids = list(
            UserLikeLog.objects.filter(user=request.user)
            .values_list('devotional_id', flat=True)
        )
        streak_days = 0
        total_read = len(read_ids)
        longest_streak = 0
        try:
            profile = request.user.teen_profile
            streak_days = profile.streak_days
            total_read = profile.devotionals_read_count
            longest_streak = profile.longest_streak
        except Exception:
            pass

        return Response({
            'read_ids': [str(i) for i in read_ids],
            'like_ids': [str(i) for i in like_ids],
            'streak_days': streak_days,
            'total_read': total_read,
            'longest_streak': longest_streak,
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request, pk=None):
        """Like or unlike a devotional. Returns current liked state and total count."""
        devotional = self.get_object()
        existing = UserLikeLog.objects.filter(user=request.user, devotional=devotional).first()
        if existing:
            existing.delete()
            Devotional.objects.filter(pk=devotional.pk).update(
                likes_count=models.F('likes_count') - 1
            )
            devotional.refresh_from_db(fields=['likes_count'])
            return Response({'liked': False, 'likes_count': devotional.likes_count})
        else:
            UserLikeLog.objects.create(user=request.user, devotional=devotional)
            Devotional.objects.filter(pk=devotional.pk).update(
                likes_count=models.F('likes_count') + 1
            )
            devotional.refresh_from_db(fields=['likes_count'])
            return Response({'liked': True, 'likes_count': devotional.likes_count})

    @action(detail=True, methods=['post'])
    def record_share(self, request, pk=None):
        """Increment share count when a user shares this devotional."""
        devotional = self.get_object()
        Devotional.objects.filter(pk=devotional.pk).update(
            share_count=models.F('share_count') + 1
        )
        return Response({'success': True})

    @action(detail=False, methods=['post'], permission_classes=[HasPermission(Perm.CONTENT_MANAGE)])
    def fetch_from_web(self, request):
        """
        Trigger scraping of devotionals from the web.

        Body params:
          - date  (str, optional) : specific date in YYYY-MM-DD format
          - days  (int, default 7): number of past days to backfill
          - force (bool, default false): re-scrape even if record exists
        """
        from .services.devotional_scraper import scrape_and_save_devotional

        target_date_str = request.data.get('date')
        days = int(request.data.get('days', 7))
        force = bool(request.data.get('force', False))

        results = []
        errors = []

        if target_date_str:
            # Single specific date
            try:
                target_date = date.fromisoformat(target_date_str)
                result = scrape_and_save_devotional(target_date, force=force)
                if result:
                    results.append(result)
                else:
                    errors.append(f"Could not fetch for {target_date} (already exists or not published yet)")
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Backfill: today and the previous (days-1) days, oldest first
            for i in range(days - 1, -1, -1):
                target_date = date.today() - timedelta(days=i)
                result = scrape_and_save_devotional(target_date, force=force)
                if result:
                    results.append(result)
                else:
                    errors.append(str(target_date))

        return Response({
            'success': True,
            'fetched_count': len(results),
            'skipped_count': len(errors),
            'results': results,
            'errors': errors,
        })


class ManualSeriesViewSet(viewsets.ModelViewSet):
    """ViewSet for manual series."""
    
    queryset = ManualSeries.objects.all()
    permission_classes = [HasPermissionOrReadOnly(Perm.CONTENT_MANAGE)]
    lookup_field = 'pk'
    filterset_fields = ['status']
    search_fields = ['title', 'description']
    ordering = ['-start_date']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ManualSeriesListSerializer
        return ManualSeriesDetailSerializer
    
    def get_queryset(self):
        queryset = self.queryset
        
        if not self.request.user.is_authenticated or not has_any_permission(self.request.user, Perm.CONTENT_MANAGE):
            queryset = queryset.filter(status='published')
        
        return queryset


class ManualViewSet(viewsets.ModelViewSet):
    """ViewSet for manuals."""
    
    queryset = Manual.objects.select_related('series').all()
    permission_classes = [HasPermissionOrReadOnly(Perm.CONTENT_MANAGE)]
    lookup_field = 'pk'
    filterset_fields = ['status', 'series', 'target_age_group']
    search_fields = ['title', 'theme', 'memory_verse']
    ordering_fields = ['week_start_date', 'created_at']
    ordering = ['-week_start_date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ManualCreateUpdateSerializer
        elif self.action == 'list':
            return ManualListSerializer
        # Teachers get teacher edition serializer on detail view
        if self.action == 'retrieve' and has_any_permission(self.request.user, Perm.CONTENT_VIEW):
            return ManualTeacherDetailSerializer
        return ManualDetailSerializer

    def get_queryset(self):
        queryset = self.queryset

        if not self.request.user.is_authenticated or not has_any_permission(self.request.user, Perm.CONTENT_MANAGE):
            queryset = queryset.filter(status='published')

        # Age group filtering — Manual uses target_age_group (singular CharField),
        # not the JSONField target_age_groups used by Devotional/Article.
        if not has_any_permission(self.request.user, Perm.CONTENT_VIEW):
            from django.db.models import Q as _Q
            if hasattr(self.request.user, 'teacher_profile'):
                try:
                    age_groups = self.request.user.teacher_profile.assigned_age_groups or []
                except Exception:
                    age_groups = []
                q = _Q(target_age_group='all')
                for ag in age_groups:
                    q |= _Q(target_age_group=ag)
                queryset = queryset.filter(q)
            else:
                try:
                    age_group = self.request.user.teen_profile.age_group
                except Exception:
                    age_group = None
                if age_group:
                    queryset = queryset.filter(
                        _Q(target_age_group='all') | _Q(target_age_group=age_group)
                    )
                else:
                    queryset = queryset.filter(target_age_group='all')

        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.increment_view_count()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current week's manual (Sunday to Saturday)."""
        today = date.today()
        
        # Find Sunday of current week
        days_since_sunday = (today.weekday() + 1) % 7
        week_start = today - timedelta(days=days_since_sunday)
        
        manual = self.get_queryset().filter(
            week_start_date=week_start
        ).first()
        
        if not manual:
            # Try to find any manual that covers today
            manual = self.get_queryset().filter(
                week_start_date__lte=today,
                week_end_date__gte=today
            ).first()
        
        if not manual:
            return Response(
                {'detail': 'No manual found for this week.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        manual.increment_view_count()
        serializer = ManualDetailSerializer(manual)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def download(self, request, pk=None):
        """Track manual download."""
        manual = self.get_object()
        manual.increment_download_count()

        return Response({
            'success': True,
            'pdf_url': manual.pdf_url or (manual.pdf_file.url if manual.pdf_file else None),
        })

    @action(detail=False, methods=['post'], permission_classes=[HasPermission(Perm.CONTENT_MANAGE)])
    def auto_import(self, request):
        """
        Create a manual stub and auto-fetch a topic-relevant cover image.

        Body params:
          - title            (str, required)
          - week_start_date  (str, YYYY-MM-DD)
          - target_age_group (str, default 'teen')
          - theme            (str, optional - bible passage reference)
          - memory_verse     (str, optional)
        """
        import requests as http_requests
        from django.core.files.base import ContentFile

        title = request.data.get('title', '').strip()
        if not title:
            return Response({'error': 'Title is required.'}, status=status.HTTP_400_BAD_REQUEST)

        week_start_date = request.data.get('week_start_date') or None
        target_age_group = request.data.get('target_age_group', 'teen')
        theme = request.data.get('theme', '')
        memory_verse = request.data.get('memory_verse', '')

        # Compute week_end (Saturday) from week_start (Sunday)
        week_end_date = None
        if week_start_date:
            try:
                start = date.fromisoformat(week_start_date)
                week_end_date = (start + timedelta(days=6)).isoformat()
            except ValueError:
                pass

        # Fetch topic-relevant cover image from loremflickr (no API key needed)
        image_file = None
        keywords = ','.join(title.split()[:4] + ['bible', 'youth'])
        try:
            img_url = f'https://loremflickr.com/800/450/{keywords}'
            resp = http_requests.get(img_url, timeout=12, allow_redirects=True)
            if resp.status_code == 200 and resp.headers.get('content-type', '').startswith('image'):
                safe_name = title[:30].replace(' ', '_').lower().replace('/', '_') + '.jpg'
                image_file = ContentFile(resp.content, name=safe_name)
        except Exception:
            pass  # Image fetch is best-effort — proceed without it

        manual = Manual(
            title=title,
            week_start_date=week_start_date,
            week_end_date=week_end_date,
            target_age_group=target_age_group,
            theme=theme,
            memory_verse=memory_verse,
            status='draft',
        )
        if image_file:
            manual.cover_image.save(image_file.name, image_file, save=False)
        manual.save()

        return Response(ManualListSerializer(manual).data, status=status.HTTP_201_CREATED)


class ArticleViewSet(viewsets.ModelViewSet):
    """ViewSet for articles."""
    
    queryset = Article.objects.all()
    permission_classes = [HasPermissionOrReadOnly(Perm.CONTENT_MANAGE)]
    lookup_field = 'pk'
    filterset_fields = ['status', 'category', 'is_featured']
    search_fields = ['title', 'content', 'excerpt']
    ordering_fields = ['published_at', 'created_at', 'view_count']
    ordering = ['-published_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ArticleListSerializer
        return ArticleDetailSerializer
    
    def get_queryset(self):
        queryset = self.queryset
        
        if not self.request.user.is_authenticated or not has_any_permission(self.request.user, Perm.CONTENT_MANAGE):
            queryset = queryset.filter(status='published')
        
        return queryset
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.increment_view_count()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured articles."""
        articles = self.get_queryset().filter(is_featured=True)[:10]
        serializer = ArticleListSerializer(articles, many=True)
        return Response(serializer.data)
