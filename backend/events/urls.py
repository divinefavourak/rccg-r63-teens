"""
URL routing for the events app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import checkin_views, share_views, views

router = DefaultRouter()
router.register(r'events', views.EventViewSet, basename='event')
router.register(r'registrations', views.EventRegistrationViewSet, basename='registration')
router.register(r'bulk-uploads', views.EventBulkUploadViewSet, basename='event-bulk-upload')
router.register(r'audit-logs', views.RegistrationAuditLogViewSet, basename='audit-log')
router.register(r'hostels', views.HostelViewSet, basename='hostel')
router.register(r'batches', views.RegistrationBatchViewSet, basename='batch')

urlpatterns = [
    # Check-in at the door: `events.checkin` only, so a Teacher can use it.
    path('checkin/today/', checkin_views.CheckInTodayView.as_view(), name='checkin-today'),
    path('checkin/scan/', checkin_views.CheckInScanView.as_view(), name='checkin-scan'),
    path('checkin/search/', checkin_views.CheckInSearchView.as_view(), name='checkin-search'),
    # Before the router, whose `registrations/<pk>/` would take it.
    path('registrations/claim/', views.ClaimSeatView.as_view(), name='registration-claim'),
    # A shared event: the page a link in a WhatsApp status opens, and the
    # flier it shows as the preview. No login (events/share.py).
    path('share/<str:key>/', share_views.EventSharePageView.as_view(), name='event-share'),
    path('share/<str:key>/flier.jpg', share_views.EventShareFlierView.as_view(),
         name='event-share-flier'),
    path('', include(router.urls)),
]
