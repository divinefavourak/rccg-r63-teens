"""URL routing for the Notifications app. Every route is owner-scoped."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'inbox', views.NotificationViewSet, basename='notification')

urlpatterns = [
    path('preferences/', views.NotificationPreferenceView.as_view(),
         name='notification-preferences'),
    path('push/', views.PushSubscriptionView.as_view(), name='notification-push'),
    path('', include(router.urls)),
]
