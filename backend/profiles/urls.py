"""
URL routing for the profiles app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'profiles', views.TeenProfileViewSet, basename='profile')
router.register(r'devotional-progress', views.DevotionalProgressViewSet, basename='devotional-progress')
router.register(r'manual-progress', views.ManualProgressViewSet, basename='manual-progress')
router.register(r'favorites', views.FavoriteViewSet, basename='favorite')

urlpatterns = [
    # My profile
    path('me/', views.MyProfileView.as_view(), name='my_profile'),
    path('create/', views.CreateProfileView.as_view(), name='create_profile'),
    
    # Router URLs
    path('', include(router.urls)),
]
