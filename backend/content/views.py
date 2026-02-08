from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q

from .models import Devotional, Manual, Podcast, Article
from .serializers import (
    DevotionalSerializer, DevotionalListSerializer,
    ManualSerializer, ManualListSerializer,
    PodcastSerializer, PodcastListSerializer,
    ArticleSerializer, ArticleListSerializer,
)
from .permissions import IsAdminOrReadOnly, CanAccessContent


class DevotionalViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing devotionals.
    
    Endpoints:
    - GET /devotionals/ - List all devotionals
    - GET /devotionals/{id}/ - Get a single devotional
    - POST /devotionals/ - Create a new devotional (Admin only)
    - PUT /devotionals/{id}/ - Update a devotional (Admin only)
    - DELETE /devotionals/{id}/ - Delete a devotional (Admin only)
    - GET /devotionals/today/ - Get today's devotional
    - POST /devotionals/{id}/publish/ - Publish a devotional (Admin only)
    """
    permission_classes = [IsAuthenticated, CanAccessContent]
    
    def get_queryset(self):
        queryset = Devotional.objects.all()
        
        # Non-admin users only see published content
        if self.request.user.role != 'admin':
            queryset = queryset.filter(is_published=True)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return DevotionalListSerializer
        return DevotionalSerializer
    
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's devotional"""
        devotional = Devotional.get_today()
        if devotional:
            serializer = DevotionalSerializer(devotional)
            return Response(serializer.data)
        return Response(
            {'detail': 'No devotional available for today.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a devotional (Admin only)"""
        if request.user.role != 'admin':
            return Response(
                {'detail': 'Only admins can publish devotionals.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        devotional = self.get_object()
        devotional.publish()
        serializer = DevotionalSerializer(devotional)
        return Response(serializer.data)


class ManualViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Sunday-to-Sunday manuals.
    
    Endpoints:
    - GET /manuals/ - List all manuals
    - GET /manuals/{id}/ - Get a single manual
    - POST /manuals/ - Create a new manual (Admin only)
    - PUT /manuals/{id}/ - Update a manual (Admin only)
    - DELETE /manuals/{id}/ - Delete a manual (Admin only)
    - GET /manuals/current-week/ - Get current week's manual
    - POST /manuals/{id}/publish/ - Publish a manual (Admin only)
    """
    permission_classes = [IsAuthenticated, CanAccessContent]
    
    def get_queryset(self):
        queryset = Manual.objects.all()
        
        # Non-admin users only see published content
        if self.request.user.role != 'admin':
            queryset = queryset.filter(is_published=True)
        
        # Filter by year
        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=year)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ManualListSerializer
        return ManualSerializer
    
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
    
    @action(detail=False, methods=['get'], url_path='current-week')
    def current_week(self, request):
        """Get the current week's manual"""
        manual = Manual.get_current_week()
        if manual:
            serializer = ManualSerializer(manual)
            return Response(serializer.data)
        return Response(
            {'detail': 'No manual available for this week.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a manual (Admin only)"""
        if request.user.role != 'admin':
            return Response(
                {'detail': 'Only admins can publish manuals.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        manual = self.get_object()
        manual.publish()
        serializer = ManualSerializer(manual)
        return Response(serializer.data)


class PodcastViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing podcasts.
    
    Endpoints:
    - GET /podcasts/ - List all podcasts
    - GET /podcasts/{id}/ - Get a single podcast
    - POST /podcasts/ - Create a new podcast (Admin only)
    - PUT /podcasts/{id}/ - Update a podcast (Admin only)
    - DELETE /podcasts/{id}/ - Delete a podcast (Admin only)
    - POST /podcasts/{id}/play/ - Increment play count
    - GET /podcasts/latest/ - Get latest podcasts
    - POST /podcasts/{id}/publish/ - Publish a podcast (Admin only)
    """
    permission_classes = [IsAuthenticated, CanAccessContent]
    
    def get_queryset(self):
        queryset = Podcast.objects.all()
        
        # Non-admin users only see published content
        if self.request.user.role != 'admin':
            queryset = queryset.filter(is_published=True)
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return PodcastListSerializer
        return PodcastSerializer
    
    @action(detail=True, methods=['post'])
    def play(self, request, pk=None):
        """Increment play count"""
        podcast = self.get_object()
        podcast.increment_play_count()
        return Response({'play_count': podcast.play_count})
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest podcasts"""
        limit = int(request.query_params.get('limit', 10))
        podcasts = self.get_queryset()[:limit]
        serializer = PodcastListSerializer(podcasts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a podcast (Admin only)"""
        if request.user.role != 'admin':
            return Response(
                {'detail': 'Only admins can publish podcasts.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        podcast = self.get_object()
        podcast.publish()
        serializer = PodcastSerializer(podcast)
        return Response(serializer.data)


class ArticleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing articles.
    
    Endpoints:
    - GET /articles/ - List all articles
    - GET /articles/{id}/ - Get a single article
    - POST /articles/ - Create a new article (Admin only)
    - PUT /articles/{id}/ - Update an article (Admin only)
    - DELETE /articles/{id}/ - Delete an article (Admin only)
    - GET /articles/featured/ - Get featured articles
    - POST /articles/{id}/publish/ - Publish an article (Admin only)
    """
    permission_classes = [IsAuthenticated, CanAccessContent]
    lookup_field = 'pk'
    
    def get_queryset(self):
        queryset = Article.objects.all()
        
        # Non-admin users only see published content
        if self.request.user.role != 'admin':
            queryset = queryset.filter(is_published=True)
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        # Filter by tag
        tag = self.request.query_params.get('tag')
        if tag:
            queryset = queryset.filter(tags__icontains=tag)
        
        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search) |
                Q(excerpt__icontains=search)
            )
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ArticleListSerializer
        return ArticleSerializer
    
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
    
    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to increment view count"""
        instance = self.get_object()
        instance.increment_view_count()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured articles"""
        limit = int(request.query_params.get('limit', 5))
        articles = self.get_queryset().filter(is_featured=True)[:limit]
        serializer = ArticleListSerializer(articles, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish an article (Admin only)"""
        if request.user.role != 'admin':
            return Response(
                {'detail': 'Only admins can publish articles.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        article = self.get_object()
        article.publish()
        serializer = ArticleSerializer(article)
        return Response(serializer.data)
