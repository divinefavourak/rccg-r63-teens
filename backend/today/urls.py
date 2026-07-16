"""URL routing for the Today app."""
from django.urls import path

from . import views

urlpatterns = [
    path('', views.TodayView.as_view(), name='today'),
    path('challenge/complete/', views.CompleteChallengeView.as_view(),
         name='today-challenge-complete'),
]
