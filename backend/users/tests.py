from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from .models import User


class UserModelTests(TestCase):
    def test_create_user(self):
        """Test creating a normal user"""
        user = User.objects.create_user(
            username='coordinator1',
            email='coordinator@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe',
            phone='+1234567890',
            role=User.Role.COORDINATOR,
            province=User.Province.PROVINCE_1
        )
        
        self.assertEqual(user.username, 'coordinator1')
        self.assertEqual(user.role, User.Role.COORDINATOR)
        self.assertTrue(user.check_password('testpass123'))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.full_name, 'John Doe')
    
    def test_create_superuser(self):
        """Test creating a superuser/admin"""
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123',
            first_name='Admin',
            last_name='User'
        )
        
        self.assertEqual(admin.username, 'admin')
        self.assertEqual(admin.role, User.Role.ADMIN)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_admin)


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
            role=User.Role.COORDINATOR,
            province=User.Province.PROVINCE_1
        )
    
    def test_login(self):
        """Test user login"""
        url = '/api/auth/login/'  # Use direct URL instead of reverse
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'testuser')
    
    def test_get_current_user(self):
        """Test getting current user info"""
        # Login first
        self.client.force_authenticate(user=self.user)
        
        url = '/api/auth/me/'  # Use direct URL
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')
        self.assertEqual(response.data['role'], 'coordinator')
    
    def test_invalid_login(self):
        """Test invalid login credentials"""
        url = '/api/auth/login/'  # Use direct URL
        data = {
            'username': 'testuser',
            'password': 'wrongpassword'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('detail', response.data)