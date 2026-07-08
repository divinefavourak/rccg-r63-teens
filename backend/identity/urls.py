from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'roles', views.RoleViewSet, basename='identity-role')
router.register(r'memberships', views.MembershipViewSet, basename='identity-membership')
router.register(r'role-assignments', views.RoleAssignmentViewSet, basename='identity-role-assignment')

urlpatterns = [
    path('me/', views.MeView.as_view(), name='identity-me'),
    path('profile/', views.MyProfileView.as_view(), name='identity-profile'),
    path('permissions/', views.PermissionListView.as_view(), name='identity-permissions'),
    path('', include(router.urls)),
]
