from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')

urlpatterns = [
    # Authentication
    path('login/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Current user
    path('me/', views.CurrentUserView.as_view(), name='current_user'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change_password'),
    
    # Login history
    path('login-history/', views.LoginHistoryView.as_view(), name='login_history'),
    path('login-history/<uuid:user_id>/', views.LoginHistoryView.as_view(), name='user_login_history'),
    
    # Audit logs
    path('audit-logs/', views.AuditLogView.as_view(), name='audit_logs'),
    
    # Include router URLs
    path('', include(router.urls)),
]