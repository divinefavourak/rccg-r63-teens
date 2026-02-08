from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.contenttypes.models import ContentType
from .models import TeenProfile, ContentProgress, SavedContent
from users.models import User
from content.models import Devotional
from datetime import date


class TeenProfileModelTests(TestCase):
    """Tests for TeenProfile model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='teen_test',
            email='teen@test.com',
            password='testpass123',
            first_name='Teen',
            last_name='User',
            role='teen',
            phone='+2341234567890'
        )
    
    def test_create_profile(self):
        """Test creating a teen profile"""
        profile = TeenProfile.objects.create(
            user=self.user,
            school='Test High School',
            grade_level='ss1'
        )
        self.assertEqual(str(profile), 'Profile: teen_test')
    
    def test_interests_list(self):
        """Test interests list property"""
        profile = TeenProfile.objects.create(
            user=self.user,
            interests='music, art, coding'
        )
        self.assertEqual(profile.interests_list, ['music', 'art', 'coding'])
    
    def test_streak_tracking(self):
        """Test streak recording"""
        profile = TeenProfile.objects.create(user=self.user)
        
        # First activity
        profile.record_activity()
        self.assertEqual(profile.current_streak, 1)


class ContentProgressModelTests(TestCase):
    """Tests for ContentProgress model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='teen_progress',
            email='progress@test.com',
            password='testpass123',
            first_name='Teen',
            last_name='Progress',
            role='teen',
            phone='+2341234567890'
        )
        self.devotional = Devotional.objects.create(
            title='Test Devotional',
            date=date.today(),
            scripture='John 3:16',
            scripture_text='For God so loved...',
            content='Test content',
            is_published=True
        )
    
    def test_mark_started(self):
        """Test marking content as started"""
        content_type = ContentType.objects.get_for_model(Devotional)
        progress = ContentProgress.objects.create(
            user=self.user,
            content_type=content_type,
            object_id=self.devotional.id
        )
        
        progress.mark_started()
        self.assertEqual(progress.status, ContentProgress.ProgressStatus.IN_PROGRESS)
        self.assertIsNotNone(progress.started_at)
    
    def test_mark_completed(self):
        """Test marking content as completed"""
        content_type = ContentType.objects.get_for_model(Devotional)
        
        # Create profile first
        TeenProfile.objects.create(user=self.user)
        
        progress = ContentProgress.objects.create(
            user=self.user,
            content_type=content_type,
            object_id=self.devotional.id
        )
        
        progress.mark_completed()
        self.assertEqual(progress.status, ContentProgress.ProgressStatus.COMPLETED)
        self.assertEqual(progress.progress_percentage, 100)


class ProfileAPITests(APITestCase):
    """API tests for profile endpoints"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='teen_api',
            email='teen_api@test.com',
            password='testpass123',
            first_name='Teen',
            last_name='API',
            role='teen',
            phone='+2341234567890'
        )
        self.devotional = Devotional.objects.create(
            title='Test Devotional',
            date=date.today(),
            scripture='John 3:16',
            scripture_text='For God so loved...',
            content='Test content',
            is_published=True
        )
    
    def test_get_my_profile(self):
        """Test getting own profile"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse('my_profile'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'teen_api')
    
    def test_update_my_profile(self):
        """Test updating own profile"""
        self.client.force_authenticate(user=self.user)
        data = {
            'school': 'New School',
            'grade_level': 'ss2'
        }
        response = self.client.put(reverse('my_profile'), data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['school'], 'New School')
    
    def test_save_content(self):
        """Test saving content"""
        self.client.force_authenticate(user=self.user)
        data = {
            'content_type': 'devotional',
            'object_id': str(self.devotional.id)
        }
        response = self.client.post(reverse('saved-list'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
