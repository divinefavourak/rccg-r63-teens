"""
Views for the content app (devotionals, manuals, articles).
"""
from rest_framework import viewsets, generics, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from datetime import date, timedelta

from common.permissions import ContentPermission, IsAdmin
from .models import Devotional, ManualSeries, Manual, Article
from .serializers import (
    DevotionalListSerializer,
    DevotionalDetailSerializer,
    DevotionalCreateUpdateSerializer,
    ManualSeriesListSerializer,
    ManualSeriesDetailSerializer,
    ManualListSerializer,
    ManualDetailSerializer,
    ManualCreateUpdateSerializer,
    ArticleListSerializer,
    ArticleDetailSerializer,
)


class DevotionalViewSet(viewsets.ModelViewSet):
    """ViewSet for devotionals."""
    
    queryset = Devotional.objects.all()
    permission_classes = [ContentPermission]
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
        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            queryset = queryset.filter(status='published')
        
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
        """Mark devotional as read."""
        devotional = self.get_object()
        
        # Check if user has profile
        if not hasattr(request.user, 'teen_profile'):
            return Response(
                {'detail': 'Profile required to track reading progress.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from profiles.models import DevotionalProgress
        
        profile = request.user.teen_profile
        progress, created = DevotionalProgress.objects.get_or_create(
            profile=profile,
            devotional_id=devotional.id
        )
        
        if created:
            devotional.increment_read_count()
            profile.update_streak(date.today())
        
        return Response({
            'success': True,
            'streak_days': profile.streak_days,
            'total_read': profile.devotionals_read_count,
            'already_read': not created,
        })
        
    @action(detail=False, methods=['post'], permission_classes=[IsAdmin])
    def fetch_from_web(self, request):
        """
        Trigger scraping of devotionals from the web.
        Accepts 'days' param (default 7) or 'date' (specific date).
        """
        from .services.devotional_scraper import scrape_and_save_devotional
        
        target_date_str = request.data.get('date')
        days = int(request.data.get('days', 7))
        
        results = []
        errors = []
        
        if target_date_str:
            # Single date
            try:
                target_date = date.fromisoformat(target_date_str)
                result = scrape_and_save_devotional(target_date)
                if result:
                    results.append(result)
                else:
                    errors.append(f"Could not fetch for {target_date} (might already exist or not found)")
            except ValueError:
                return Response({'error': 'Invalid date format (YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Scrape upcoming days (or fill gaps)
            start_date = date.today()
            for i in range(days):
                target_date = start_date + timedelta(days=i)
                result = scrape_and_save_devotional(target_date)
                if result:
                    results.append(result)
        
        return Response({
            'success': True,
            'fetched_count': len(results),
            'results': results,
            'errors': errors
        })


class ManualSeriesViewSet(viewsets.ModelViewSet):
    """ViewSet for manual series."""
    
    queryset = ManualSeries.objects.all()
    permission_classes = [ContentPermission]
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
        
        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            queryset = queryset.filter(status='published')
        
        return queryset


class ManualViewSet(viewsets.ModelViewSet):
    """ViewSet for manuals."""
    
    queryset = Manual.objects.select_related('series').all()
    permission_classes = [ContentPermission]
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
        return ManualDetailSerializer
    
    def get_queryset(self):
        queryset = self.queryset
        
        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            queryset = queryset.filter(status='published')
        
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


class ArticleViewSet(viewsets.ModelViewSet):
    """ViewSet for articles."""
    
    queryset = Article.objects.all()
    permission_classes = [ContentPermission]
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
        
        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
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
