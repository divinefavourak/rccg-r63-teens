from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import date, timedelta
from .models import Devotional, Manual, Podcast, Article
from users.models import User


class DevotionalModelTests(TestCase):
    """Tests for Devotional model"""
    
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_test',
            email='admin@test.com',
            password='testpass123',
            first_name='Admin',
            last_name='User',
            role='admin',
            phone='+2341234567890'
        )
    
    def test_create_devotional(self):
        """Test creating a devotional"""
        devotional = Devotional.objects.create(
            title='Test Devotional',
            date=date.today(),
            scripture='John 3:16',
            scripture_text='For God so loved the world...',
            content='Test content',
            author=self.admin
        )
        self.assertEqual(str(devotional), f"{date.today()} - Test Devotional")
        self.assertFalse(devotional.is_published)
    
    def test_publish_devotional(self):
        """Test publishing a devotional"""
        devotional = Devotional.objects.create(
            title='Test Devotional',
            date=date.today(),
            scripture='John 3:16',
            scripture_text='For God so loved the world...',
            content='Test content'
        )
        devotional.publish()
        self.assertTrue(devotional.is_published)
        self.assertIsNotNone(devotional.published_at)
    
    def test_get_today_devotional(self):
        """Test getting today's devotional"""
        Devotional.objects.create(
            title='Today Devotional',
            date=date.today(),
            scripture='John 3:16',
            scripture_text='For God so loved the world...',
            content='Test content',
            is_published=True
        )
        result = Devotional.get_today()
        self.assertIsNotNone(result)
        self.assertEqual(result.title, 'Today Devotional')


class ManualModelTests(TestCase):
    """Tests for Manual model"""
    
    def test_create_manual(self):
        """Test creating a manual"""
        today = date.today()
        # Get the start of the week (Sunday)
        start = today - timedelta(days=today.weekday() + 1) if today.weekday() != 6 else today
        end = start + timedelta(days=6)
        
        manual = Manual.objects.create(
            title='Test Manual',
            year=2025,
            week_number=1,
            theme='Test Theme',
            scripture_reference='Genesis 1:1',
            scripture_text='In the beginning...',
            lesson_content='Lesson content here',
            week_start=start,
            week_end=end
        )
        self.assertIn('Week 1', str(manual))
        self.assertFalse(manual.is_published)


class PodcastModelTests(TestCase):
    """Tests for Podcast model"""
    
    def test_increment_play_count(self):
        """Test incrementing play count"""
        podcast = Podcast.objects.create(
            title='Test Podcast',
            description='Test description',
            audio_file='podcasts/audio/test.mp3'
        )
        self.assertEqual(podcast.play_count, 0)
        podcast.increment_play_count()
        self.assertEqual(podcast.play_count, 1)


class ArticleModelTests(TestCase):
    """Tests for Article model"""
    
    def test_increment_view_count(self):
        """Test incrementing view count"""
        article = Article.objects.create(
            title='Test Article',
            slug='test-article',
            excerpt='Test excerpt',
            content='Test content'
        )
        self.assertEqual(article.view_count, 0)
        article.increment_view_count()
        self.assertEqual(article.view_count, 1)


class ContentAPITests(APITestCase):
    """API tests for content endpoints"""
    
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_api',
            email='admin_api@test.com',
            password='testpass123',
            first_name='Admin',
            last_name='API',
            role='admin',
            phone='+2341234567890'
        )
        self.teen = User.objects.create_user(
            username='teen_api',
            email='teen_api@test.com',
            password='testpass123',
            first_name='Teen',
            last_name='API',
            role='teen',
            phone='+2341234567891'
        )
        
        # Create published devotional
        self.devotional = Devotional.objects.create(
            title='Published Devotional',
            date=date.today(),
            scripture='John 3:16',
            scripture_text='For God so loved the world...',
            content='Test content',
            is_published=True,
            author=self.admin
        )
        
        # Create unpublished devotional
        self.unpublished = Devotional.objects.create(
            title='Unpublished Devotional',
            date=date.today() + timedelta(days=1),
            scripture='Romans 8:28',
            scripture_text='And we know that...',
            content='Unpublished content',
            is_published=False,
            author=self.admin
        )
    
    def test_list_devotionals_as_admin(self):
        """Admin can see all devotionals (published and unpublished)"""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('devotional-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Both devotionals
    
    def test_list_devotionals_as_teen(self):
        """Teen can only see published devotionals"""
        self.client.force_authenticate(user=self.teen)
        response = self.client.get(reverse('devotional-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)  # Only published
    
    def test_create_devotional_as_admin(self):
        """Admin can create devotionals"""
        self.client.force_authenticate(user=self.admin)
        data = {
            'title': 'New Devotional',
            'date': (date.today() + timedelta(days=2)).isoformat(),
            'scripture': 'Psalm 23:1',
            'scripture_text': 'The Lord is my shepherd...',
            'content': 'New content'
        }
        response = self.client.post(reverse('devotional-list'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_create_devotional_as_teen_fails(self):
        """Teen cannot create devotionals"""
        self.client.force_authenticate(user=self.teen)
        data = {
            'title': 'New Devotional',
            'date': (date.today() + timedelta(days=3)).isoformat(),
            'scripture': 'Psalm 23:1',
            'scripture_text': 'The Lord is my shepherd...',
            'content': 'New content'
        }
        response = self.client.post(reverse('devotional-list'), data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_today_endpoint(self):
        """Test today's devotional endpoint"""
        self.client.force_authenticate(user=self.teen)
        response = self.client.get(reverse('devotional-today'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Published Devotional')
    
    def test_unauthenticated_access_fails(self):
        """Unauthenticated users cannot access content"""
        response = self.client.get(reverse('devotional-list'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
