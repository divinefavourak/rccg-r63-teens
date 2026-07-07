"""
Views for the media app (podcasts, videos, playlists).
"""
from rest_framework import viewsets, generics, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count

from common.permissions import ContentPermission, IsAdmin
from content.views import get_age_group_filter
from .models import MediaCategory, MediaSeries, MediaEpisode, Playlist
from .serializers import (
    MediaCategorySerializer,
    MediaSeriesListSerializer,
    MediaSeriesDetailSerializer,
    MediaEpisodeListSerializer,
    MediaEpisodeDetailSerializer,
    MediaEpisodeCreateUpdateSerializer,
    PlaylistSerializer,
)


class MediaCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for media categories."""
    
    queryset = MediaCategory.objects.filter(is_active=True)
    serializer_class = MediaCategorySerializer
    permission_classes = [ContentPermission]
    lookup_field = 'pk'
    ordering = ['order', 'name']
    
    def get_queryset(self):
        queryset = self.queryset.annotate(
            series_count=Count('series', filter=models.Q(series__status='published'))
        )
        
        if self.request.query_params.get('featured'):
            queryset = queryset.filter(is_featured=True)
        
        return queryset


class MediaSeriesViewSet(viewsets.ModelViewSet):
    """ViewSet for media series."""
    
    queryset = MediaSeries.objects.select_related('category').all()
    permission_classes = [ContentPermission]
    lookup_field = 'pk'
    filterset_fields = ['status', 'category', 'is_featured']
    search_fields = ['title', 'description', 'host_name']
    ordering_fields = ['created_at', 'subscriber_count']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return MediaSeriesListSerializer
        return MediaSeriesDetailSerializer
    
    def get_queryset(self):
        queryset = self.queryset

        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            queryset = queryset.filter(status='published')

        if self.request.user.is_authenticated and self.request.user.role not in ['admin', 'coordinator']:
            queryset = queryset.filter(get_age_group_filter(self.request.user))

        return queryset

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured series."""
        series = self.get_queryset().filter(is_featured=True)[:10]
        serializer = MediaSeriesListSerializer(series, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def episodes(self, request, pk=None):
        """Get all episodes for a series."""
        series = self.get_object()
        episodes = series.episodes.filter(status='published').order_by('-published_at')
        
        page = self.paginate_queryset(episodes)
        if page is not None:
            serializer = MediaEpisodeListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = MediaEpisodeListSerializer(episodes, many=True)
        return Response(serializer.data)


class MediaEpisodeViewSet(viewsets.ModelViewSet):
    """ViewSet for media episodes."""
    
    queryset = MediaEpisode.objects.select_related('series', 'series__category').all()
    permission_classes = [ContentPermission]
    lookup_field = 'pk'
    filterset_fields = ['status', 'series', 'media_type', 'is_featured']
    search_fields = ['title', 'description', 'tags']
    ordering_fields = ['published_at', 'created_at', 'play_count', 'view_count']
    ordering = ['-published_at']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MediaEpisodeCreateUpdateSerializer
        elif self.action == 'list':
            return MediaEpisodeListSerializer
        return MediaEpisodeDetailSerializer
    
    def get_queryset(self):
        queryset = self.queryset

        if not self.request.user.is_authenticated or self.request.user.role != 'admin':
            queryset = queryset.filter(status='published')

        if self.request.user.is_authenticated and self.request.user.role not in ['admin', 'coordinator']:
            queryset = queryset.filter(get_age_group_filter(self.request.user))

        # Filter by media type
        media_type = self.request.query_params.get('media_type')
        if media_type:
            queryset = queryset.filter(media_type=media_type)
        
        # Filter to only get episodes with audio
        has_audio = self.request.query_params.get('has_audio')
        if has_audio == 'true':
            queryset = queryset.exclude(audio_url='', audio_file='')
        
        # Filter to only get episodes with video
        has_video = self.request.query_params.get('has_video')
        if has_video == 'true':
            queryset = queryset.exclude(video_url='', video_file='', hls_url='')
        
        return queryset
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.increment_view_count()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured episodes."""
        episodes = self.get_queryset().filter(is_featured=True)[:10]
        serializer = MediaEpisodeListSerializer(episodes, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest episodes across all series."""
        episodes = self.get_queryset()[:20]
        serializer = MediaEpisodeListSerializer(episodes, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def play(self, request, pk=None):
        """Track episode play."""
        episode = self.get_object()
        episode.increment_play_count()
        
        return Response({
            'success': True,
            'play_count': episode.play_count + 1,
        })
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        """Like/unlike an episode."""
        from profiles.models import Favorite
        
        episode = self.get_object()
        
        if not hasattr(request.user, 'teen_profile'):
            return Response(
                {'detail': 'Profile required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        profile = request.user.teen_profile
        favorite, created = Favorite.objects.get_or_create(
            profile=profile,
            content_type='media_episode',
            content_id=episode.id
        )
        
        if not created:
            # Already liked, unlike it
            favorite.delete()
            MediaEpisode.objects.filter(pk=episode.pk).update(
                like_count=models.F('like_count') - 1
            )
            return Response({'liked': False, 'like_count': episode.like_count - 1})
        
        # New like
        MediaEpisode.objects.filter(pk=episode.pk).update(
            like_count=models.F('like_count') + 1
        )
        return Response({'liked': True, 'like_count': episode.like_count + 1})


class PlaylistViewSet(viewsets.ModelViewSet):
    """ViewSet for playlists."""
    
    queryset = Playlist.objects.all()
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'pk'
    filterset_fields = ['is_public', 'is_featured', 'is_system']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        
        # Return public playlists, system playlists, and user's own playlists
        return self.queryset.filter(
            models.Q(is_public=True) |
            models.Q(is_system=True) |
            models.Q(created_by=user)
        )
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Get current user's playlists."""
        playlists = Playlist.objects.filter(created_by=request.user)
        serializer = PlaylistSerializer(playlists, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_episode(self, request, pk=None):
        """Add episode to playlist."""
        from .models import PlaylistEpisode
        
        playlist = self.get_object()
        episode_id = request.data.get('episode_id')
        
        if not episode_id:
            return Response(
                {'detail': 'episode_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        episode = MediaEpisode.objects.filter(pk=episode_id, status='published').first()
        if not episode:
            return Response(
                {'detail': 'Episode not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permission
        if playlist.created_by != request.user and request.user.role != 'admin':
            return Response(
                {'detail': 'You cannot modify this playlist.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get next order number
        max_order = playlist.playlistepisode_set.aggregate(
            models.Max('order')
        )['order__max'] or 0
        
        PlaylistEpisode.objects.get_or_create(
            playlist=playlist,
            episode=episode,
            defaults={'order': max_order + 1}
        )
        
        return Response({'success': True})
    
    @action(detail=True, methods=['post'])
    def remove_episode(self, request, pk=None):
        """Remove episode from playlist."""
        from .models import PlaylistEpisode
        
        playlist = self.get_object()
        episode_id = request.data.get('episode_id')
        
        if playlist.created_by != request.user and request.user.role != 'admin':
            return Response(
                {'detail': 'You cannot modify this playlist.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        PlaylistEpisode.objects.filter(
            playlist=playlist,
            episode_id=episode_id
        ).delete()
        
        return Response({'success': True})


# Need to import models for F and Q
from django.db import models
