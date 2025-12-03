from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tickets', views.TicketViewSet, basename='ticket')
router.register(r'check-ins', views.CheckInRecordViewSet, basename='checkin')

urlpatterns = [
    # Ticket management
    path('', include(router.urls)),
    
    # Bulk upload
    path('bulk-upload/', views.BulkUploadView.as_view(), name='bulk_upload'),
    
    # Dashboard
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    
    # Check-in dashboard
    path('check-in-dashboard/', views.CheckInDashboardView.as_view(), name='check_in_dashboard'),
    
    # Audit logs
    path('audit-logs/', views.TicketAuditLogView.as_view(), name='ticket_audit_logs'),
    
    # Special endpoints
    path('tickets/<uuid:pk>/update-status/', 
         views.TicketViewSet.as_view({'post': 'update_status'}), 
         name='ticket_update_status'),
    
    # Verification endpoint (public)
    path('verify/', views.TicketViewSet.as_view({'get': 'verify', 'post': 'verify'}), name='verify_ticket'),
]