"""
URL routing for the events app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'events', views.EventViewSet, basename='event')
router.register(r'registrations', views.EventRegistrationViewSet, basename='registration')
router.register(r'bulk-uploads', views.EventBulkUploadViewSet, basename='event-bulk-upload')
router.register(r'audit-logs', views.RegistrationAuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
]
