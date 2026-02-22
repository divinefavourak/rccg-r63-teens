from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import event_views

router = DefaultRouter()
router.register(r'', event_views.EventViewSet, basename='event')
router.register(r'registrations', event_views.EventRegistrationViewSet, basename='event-registration')

urlpatterns = [
    path('', include(router.urls)),
]
