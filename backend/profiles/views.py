"""
Views for the profiles app.
"""
from rest_framework import viewsets, generics, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone

from identity.authorization import HasPermission, IsSelfOrHasPermission, has_any_permission
from identity.permissions_registry import Perm
from .models import TeenProfile, DevotionalProgress, ManualProgress, Favorite
from .serializers import (
    TeenProfileSerializer,
    TeenProfileCreateSerializer,
    TeenProfileUpdateSerializer,
    TeenProfileListSerializer,
    DevotionalProgressSerializer,
    ManualProgressSerializer,
    FavoriteSerializer,
)


class TeenProfileViewSet(viewsets.ModelViewSet):
    """ViewSet for teen profiles."""
    
    queryset = TeenProfile.objects.select_related('user').all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TeenProfileCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TeenProfileUpdateSerializer
        elif self.action == 'list':
            return TeenProfileListSerializer
        return TeenProfileSerializer
    
    def get_permissions(self):
        if self.action == 'list':
            return [permissions.IsAuthenticated(), HasPermission(Perm.PROFILES_VIEW)()]
        elif self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsSelfOrHasPermission(Perm.PROFILES_MANAGE)()]
        return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        user = self.request.user
        
        # Profile viewers see all; everyone else sees only their own.
        # (Node-scoped profile visibility via Membership is a documented follow-up.)
        if has_any_permission(user, Perm.PROFILES_VIEW):
            return self.queryset
        return self.queryset.filter(user=user)
    
    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """Get or update the current user's profile."""
        try:
            profile = request.user.teen_profile
        except TeenProfile.DoesNotExist:
            return Response(
                {'detail': 'Profile not found. Please create one.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if request.method == 'GET':
            serializer = TeenProfileSerializer(profile)
            return Response(serializer.data)
        
        elif request.method == 'PATCH':
            serializer = TeenProfileUpdateSerializer(
                profile, 
                data=request.data, 
                partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(TeenProfileSerializer(profile).data)


class MyProfileView(generics.RetrieveUpdateAPIView):
    """View for the current user's profile."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method in ['PATCH', 'PUT']:
            return TeenProfileUpdateSerializer
        return TeenProfileSerializer
    
    def get_object(self):
        return get_object_or_404(TeenProfile, user=self.request.user)


class CreateProfileView(generics.CreateAPIView):
    """View for creating a teen profile."""
    
    serializer_class = TeenProfileCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DevotionalProgressViewSet(viewsets.ModelViewSet):
    """ViewSet for devotional progress tracking."""
    
    serializer_class = DevotionalProgressSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Handle schema generation
        if getattr(self, 'swagger_fake_view', False):
            return DevotionalProgress.objects.none()
        return DevotionalProgress.objects.filter(
            profile__user=self.request.user
        )
    
    def perform_create(self, serializer):
        profile = self.request.user.teen_profile
        devotional_progress = serializer.save(profile=profile)
        
        # Update profile streak
        profile.update_streak(timezone.now().date())


class ManualProgressViewSet(viewsets.ModelViewSet):
    """ViewSet for manual progress tracking."""
    
    serializer_class = ManualProgressSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Handle schema generation
        if getattr(self, 'swagger_fake_view', False):
            return ManualProgress.objects.none()
        return ManualProgress.objects.filter(
            profile__user=self.request.user
        )
    
    def perform_create(self, serializer):
        serializer.save(profile=self.request.user.teen_profile)


class FavoriteViewSet(viewsets.ModelViewSet):
    """ViewSet for user favorites."""
    
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Handle schema generation
        if getattr(self, 'swagger_fake_view', False):
            return Favorite.objects.none()
        return Favorite.objects.filter(
            profile__user=self.request.user
        )
    
    def perform_create(self, serializer):
        serializer.save(profile=self.request.user.teen_profile)
    
    @action(detail=False, methods=['delete'])
    def remove(self, request):
        """Remove a favorite by content_type and content_id."""
        content_type = request.data.get('content_type')
        content_id = request.data.get('content_id')
        
        if not content_type or not content_id:
            return Response(
                {'detail': 'content_type and content_id are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        deleted, _ = Favorite.objects.filter(
            profile__user=request.user,
            content_type=content_type,
            content_id=content_id
        ).delete()
        
        if deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(
            {'detail': 'Favorite not found.'},
            status=status.HTTP_404_NOT_FOUND
        )
