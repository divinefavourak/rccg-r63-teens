"""URL routing for the Bible app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'translations', views.BibleTranslationViewSet, basename='bible-translation')
router.register(r'books', views.BibleBookViewSet, basename='bible-book')
router.register(r'chapters', views.BibleChapterViewSet, basename='bible-chapter')
router.register(r'verses', views.BibleVerseViewSet, basename='bible-verse')

# Personal layer — every route below is owner-scoped.
router.register(r'bookmarks', views.BookmarkViewSet, basename='bible-bookmark')
router.register(r'highlights', views.HighlightViewSet, basename='bible-highlight')
router.register(r'notes', views.NoteViewSet, basename='bible-note')
router.register(r'reading-history', views.ReadingHistoryViewSet, basename='bible-reading-history')
router.register(r'reading-progress', views.ReadingProgressViewSet, basename='bible-reading-progress')

urlpatterns = [
    path('search/', views.ScriptureSearchView.as_view(), name='bible-search'),
    path('share/', views.VerseShareView.as_view(), name='bible-share'),
    path('lookup/', views.ScriptureLookupView.as_view(), name='bible-lookup'),
    path('continue-reading/', views.ContinueReadingView.as_view(), name='bible-continue-reading'),
    path('', include(router.urls)),
]
