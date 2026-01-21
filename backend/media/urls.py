"""
URL routing for the media app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'categories', views.MediaCategoryViewSet, basename='media-category')
router.register(r'series', views.MediaSeriesViewSet, basename='media-series')
router.register(r'episodes', views.MediaEpisodeViewSet, basename='media-episode')
router.register(r'playlists', views.PlaylistViewSet, basename='playlist')

urlpatterns = [
    path('', include(router.urls)),
]
