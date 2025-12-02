from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router for ViewSet
router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')

urlpatterns = [
    # Authentication endpoints
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    
    # User management endpoints
    path('register/', views.RegisterView.as_view(), name='register'),
    path('profile/', views.ProfileView.as_view(), name='profile'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('coordinators/', views.CoordinatorListView.as_view(), name='coordinators'),
    
    # Include ViewSet URLs
    path('', include(router.urls)),
]