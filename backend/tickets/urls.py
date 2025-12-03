from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tickets', views.TicketViewSet, basename='ticket')

urlpatterns = [
    # Ticket management
    path('', include(router.urls)),
    
    # Bulk upload
    path('bulk-upload/', views.BulkUploadView.as_view(), name='bulk_upload'),
    
    # Dashboard
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    
    # Audit logs
    path('audit-logs/', views.TicketAuditLogView.as_view(), name='ticket_audit_logs'),
    
    # Special endpoints
    path('tickets/<uuid:pk>/update-status/', 
         views.TicketViewSet.as_view({'post': 'update_status'}), 
         name='ticket_update_status'),
]