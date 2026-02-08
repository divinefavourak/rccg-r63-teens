from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import TeenProfile, ContentProgress, SavedContent
from .serializers import (
    TeenProfileSerializer,
    ContentProgressSerializer,
    ContentProgressCreateSerializer,
    SavedContentSerializer,
    SavedContentCreateSerializer,
)


class TeenProfileView(APIView):
    """
    API view for managing the current user's teen profile.
    
    Endpoints:
    - GET /profiles/me/ - Get own profile
    - PUT /profiles/me/ - Update own profile
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current user's profile"""
        profile, created = TeenProfile.objects.get_or_create(user=request.user)
        serializer = TeenProfileSerializer(profile)
        return Response(serializer.data)
    
    def put(self, request):
        """Update current user's profile"""
        profile, created = TeenProfile.objects.get_or_create(user=request.user)
        serializer = TeenProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def patch(self, request):
        """Partial update current user's profile"""
        return self.put(request)


class ContentProgressViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing content progress.
    
    Endpoints:
    - GET /profiles/progress/ - List user's progress
    - POST /profiles/progress/ - Track progress on content
    - GET /profiles/progress/{id}/ - Get specific progress record
    - PUT /profiles/progress/{id}/ - Update progress record
    - DELETE /profiles/progress/{id}/ - Remove progress record
    - POST /profiles/progress/mark-completed/ - Mark content as completed
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = ContentProgress.objects.filter(user=self.request.user)
        
        # Filter by content type
        content_type = self.request.query_params.get('content_type')
        if content_type:
            queryset = queryset.filter(content_type__model=content_type)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ContentProgressCreateSerializer
        return ContentProgressSerializer
    
    def create(self, request, *args, **kwargs):
        """Create or update progress record"""
        serializer = ContentProgressCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        content_type = serializer.validated_data['content_type']
        object_id = serializer.validated_data['object_id']
        
        # Get or create progress record
        progress, created = ContentProgress.objects.get_or_create(
            user=request.user,
            content_type=content_type,
            object_id=object_id
        )
        
        # Update fields if provided
        if 'status' in serializer.validated_data:
            progress.status = serializer.validated_data['status']
        if 'progress_percentage' in serializer.validated_data:
            progress.progress_percentage = serializer.validated_data['progress_percentage']
        if 'last_position' in serializer.validated_data:
            progress.last_position = serializer.validated_data['last_position']
        if 'notes' in serializer.validated_data:
            progress.notes = serializer.validated_data['notes']
        
        # Mark as started if not already
        if progress.status == ContentProgress.ProgressStatus.NOT_STARTED:
            progress.mark_started()
        else:
            progress.save()
        
        output_serializer = ContentProgressSerializer(progress)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], url_path='mark-completed')
    def mark_completed(self, request):
        """Mark specific content as completed"""
        serializer = ContentProgressCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        content_type = serializer.validated_data['content_type']
        object_id = serializer.validated_data['object_id']
        
        progress, created = ContentProgress.objects.get_or_create(
            user=request.user,
            content_type=content_type,
            object_id=object_id
        )
        
        progress.mark_completed()
        
        output_serializer = ContentProgressSerializer(progress)
        return Response(output_serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get user's progress statistics"""
        queryset = self.get_queryset()
        
        stats = {
            'total_in_progress': queryset.filter(status='in_progress').count(),
            'total_completed': queryset.filter(status='completed').count(),
            'by_content_type': {}
        }
        
        for content_type in ['devotional', 'manual', 'podcast', 'article']:
            type_qs = queryset.filter(content_type__model=content_type)
            stats['by_content_type'][content_type] = {
                'in_progress': type_qs.filter(status='in_progress').count(),
                'completed': type_qs.filter(status='completed').count()
            }
        
        return Response(stats)


class SavedContentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing saved/bookmarked content.
    
    Endpoints:
    - GET /profiles/saved/ - List saved content
    - POST /profiles/saved/ - Save content
    - DELETE /profiles/saved/{id}/ - Unsave content
    - POST /profiles/saved/toggle/ - Toggle save status
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = SavedContent.objects.filter(user=self.request.user)
        
        # Filter by content type
        content_type = self.request.query_params.get('content_type')
        if content_type:
            queryset = queryset.filter(content_type__model=content_type)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SavedContentCreateSerializer
        return SavedContentSerializer
    
    def create(self, request, *args, **kwargs):
        """Save content"""
        serializer = SavedContentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        content_type = serializer.validated_data['content_type']
        object_id = serializer.validated_data['object_id']
        note = serializer.validated_data.get('note', '')
        
        # Check if already saved
        saved, created = SavedContent.objects.get_or_create(
            user=request.user,
            content_type=content_type,
            object_id=object_id,
            defaults={'note': note}
        )
        
        if not created and note:
            saved.note = note
            saved.save()
        
        output_serializer = SavedContentSerializer(saved)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'])
    def toggle(self, request):
        """Toggle save status for content"""
        serializer = SavedContentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        content_type = serializer.validated_data['content_type']
        object_id = serializer.validated_data['object_id']
        
        try:
            saved = SavedContent.objects.get(
                user=request.user,
                content_type=content_type,
                object_id=object_id
            )
            saved.delete()
            return Response({'status': 'unsaved'})
        except SavedContent.DoesNotExist:
            saved = SavedContent.objects.create(
                user=request.user,
                content_type=content_type,
                object_id=object_id,
                note=serializer.validated_data.get('note', '')
            )
            return Response({'status': 'saved', 'id': str(saved.id)})
    
    @action(detail=False, methods=['post'], url_path='check')
    def check_saved(self, request):
        """Check if content is saved"""
        serializer = SavedContentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        content_type = serializer.validated_data['content_type']
        object_id = serializer.validated_data['object_id']
        
        is_saved = SavedContent.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=object_id
        ).exists()
        
        return Response({'is_saved': is_saved})
