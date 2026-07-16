"""URL routing for the Progress app. Every route is owner-scoped."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'actions', views.SpiritualActionViewSet, basename='progress-action')

urlpatterns = [
    path('streak/', views.StreakView.as_view(), name='progress-streak'),
    path('summary/', views.ProgressSummaryView.as_view(), name='progress-summary'),
    path('calendar/', views.CalendarView.as_view(), name='progress-calendar'),
    path('pause/', views.PauseStreakView.as_view(), name='progress-pause'),
    path('', include(router.urls)),
]
