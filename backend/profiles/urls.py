from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'progress', views.ContentProgressViewSet, basename='progress')
router.register(r'saved', views.SavedContentViewSet, basename='saved')

urlpatterns = [
    # Profile management
    path('me/', views.TeenProfileView.as_view(), name='my_profile'),
    
    # Router URLs
    path('', include(router.urls)),
]
