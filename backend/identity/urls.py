from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import analytics_views, role_views, views

router = DefaultRouter()
router.register(r'roles', views.RoleViewSet, basename='identity-role')
router.register(r'memberships', views.MembershipViewSet, basename='identity-membership')
router.register(r'role-assignments', views.RoleAssignmentViewSet, basename='identity-role-assignment')

urlpatterns = [
    path('me/', views.MeView.as_view(), name='identity-me'),
    path('profile/', views.MyProfileView.as_view(), name='identity-profile'),
    path('permissions/', views.PermissionListView.as_view(), name='identity-permissions'),
    # Scoped aggregate counts for the Console's Analytics and Overview screens.
    path('stats/', analytics_views.ConsoleStatsView.as_view(), name='identity-stats'),
    # Editing what a role *means* — distinct from granting one to somebody.
    # Declared before the router so it is not shadowed by the roles detail route.
    path('roles/<uuid:pk>/permissions/', role_views.RolePermissionsView.as_view(),
         name='identity-role-permissions'),
    path('', include(router.urls)),
]
