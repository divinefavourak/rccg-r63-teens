from django.test import TestCase
from unittest.mock import patch, MagicMock
from .models import User
from .signals import send_welcome_email
from django.core import mail


class UserSignalsTest(TestCase):
    """Test cases for user signals."""
    
    @patch('users.signals.send_welcome_email')
    def test_user_creation_triggers_signal(self, mock_send_email):
        """Test that user creation triggers the post_save signal."""
        # Create a user
        user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            name='Test User',
            email='test@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        # Check if welcome email was called
        mock_send_email.assert_called_once_with(user)
    
    def test_user_pre_save_cleanup(self):
        """Test that pre_save signal cleans up data."""
        # Create a user with uppercase username
        user = User.objects.create_user(
            username='TESTUSER',
            password='testpass123',
            name='Test User',
            email='TEST@TEST.COM',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        # Refresh from database
        user.refresh_from_db()
        
        # Check that username and email are lowercase
        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@test.com')
    
    def test_admin_user_province_cleanup(self):
        """Test that admin users have province set to None."""
        # Create an admin user with province
        user = User.objects.create_user(
            username='adminuser',
            password='adminpass123',
            name='Admin User',
            email='admin@test.com',
            role=User.Role.ADMIN,
            province='Test Province'  # This should be cleaned up
        )
        
        # Refresh from database
        user.refresh_from_db()
        
        # Admin users should not have a province
        self.assertIsNone(user.province)
    
    def test_welcome_email_function(self):
        """Test the welcome email function."""
        # Clear the mail outbox first
        mail.outbox.clear()
        
        # Create a user with DISABLE_WELCOME_EMAILS setting to prevent signal from sending email
        with self.settings(
            EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
            DEFAULT_FROM_EMAIL='noreply@test.com',
            FRONTEND_URL='http://localhost:3000',
            DISABLE_WELCOME_EMAILS=True  # This will prevent the signal from sending email
        ):
            user = User.objects.create_user(
                username='testuser',
                password='testpass123',
                name='Test User',
                email='test@test.com',
                role=User.Role.COORDINATOR,
                province='Test Province'
            )
        
        # Now call the welcome email function directly
        with self.settings(
            EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
            DEFAULT_FROM_EMAIL='noreply@test.com',
            FRONTEND_URL='http://localhost:3000',
            DISABLE_WELCOME_EMAILS=False
        ):
            send_welcome_email(user)
        
        # Check that email was sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, 'Welcome to RCCG R63 Teens Management System')
        self.assertIn(user.name, mail.outbox[0].body)
        self.assertIn(user.username, mail.outbox[0].body)
    
    @patch('users.signals.logger')
    def test_user_role_change_logging(self, mock_logger):
        """Test that role changes are logged."""
        # Create a user and save to database
        user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            name='Test User',
            email='test@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        # Clear any existing calls to the logger
        mock_logger.reset_mock()
        
        # Fetch the user from database to ensure we have the "old" state
        user = User.objects.get(username='testuser')
        
        # Change role and save
        user.role = User.Role.ADMIN
        user.save()
        
        # Check that logger.info was called
        self.assertTrue(mock_logger.info.called)
        
        # Get all info calls
        info_calls = [call[0][0] for call in mock_logger.info.call_args_list]
        
        # Check if any call contains role change message
        role_change_found = any('role changed from' in str(call) for call in info_calls)
        self.assertTrue(role_change_found, f"Role change log not found in calls: {info_calls}")


class UserUtilsTest(TestCase):
    """Test cases for user utility functions."""
    
    def test_generate_temporary_password(self):
        """Test temporary password generation."""
        from .utils import generate_temporary_password
        
        password = generate_temporary_password()
        
        # Check password length
        self.assertEqual(len(password), 12)
        
        # Check password contains various character types
        self.assertTrue(any(c.isalpha() for c in password))
        self.assertTrue(any(c.isdigit() for c in password))
        
        # Generate another password and ensure they're different
        password2 = generate_temporary_password()
        self.assertNotEqual(password, password2)