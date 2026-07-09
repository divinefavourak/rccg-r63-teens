"""
URL routing for the content app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'devotionals', views.DevotionalViewSet, basename='devotional')
router.register(r'memory-verses', views.MemoryVerseViewSet, basename='memory-verse')
router.register(r'scripture-references', views.ScriptureReferenceViewSet,
                basename='scripture-reference')
router.register(r'discussion-questions', views.DiscussionQuestionViewSet,
                basename='discussion-question')
router.register(r'manual-series', views.ManualSeriesViewSet, basename='manual-series')
router.register(r'manuals', views.ManualViewSet, basename='manual')
router.register(r'articles', views.ArticleViewSet, basename='article')

urlpatterns = [
    # The canonical Verse of the Day. Resolves to today's devotional's primary
    # memory verse — there is no competing daily-verse endpoint anywhere.
    path('verse-of-the-day/', views.VerseOfTheDayView.as_view(), name='verse-of-the-day'),
    path('', include(router.urls)),
]
