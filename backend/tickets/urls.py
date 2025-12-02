from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tickets', views.TicketViewSet, basename='ticket')
router.register(r'bulk-uploads', views.BulkUploadViewSet, basename='bulk-upload')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
]