"""
URL routing for the content app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'devotionals', views.DevotionalViewSet, basename='devotional')
router.register(r'manual-series', views.ManualSeriesViewSet, basename='manual-series')
router.register(r'manuals', views.ManualViewSet, basename='manual')
router.register(r'articles', views.ArticleViewSet, basename='article')

urlpatterns = [
    path('', include(router.urls)),
]
