"""
Unit tests for Email Senders utility module
"""
from django.test import TestCase, override_settings
from unittest.mock import patch, MagicMock
from utils.email_senders import (
    get_sender,
    validate_sender,
    get_all_senders,
    get_sender_display_name,
    EmailSender
)


class EmailSenderUtilityTests(TestCase):
    """Tests for email sender utility functions"""
    
    def test_get_sender_returns_correct_sender(self):
        """Test that get_sender returns the correct sender for valid keys"""
        # Test with string key
        sender = get_sender('junior_church')
        self.assertIn('rccgjuniorchurch@thefaithtribe.live', sender)
        
        sender = get_sender('support')
        self.assertIn('faithtribe.support@thefaithtribe.live', sender)
        
        sender = get_sender('no_reply')
        self.assertIn('no-reply@thefaithtribe.live', sender)
    
    def test_get_sender_with_enum(self):
        """Test that get_sender works with EmailSender enum"""
        sender = get_sender(EmailSender.JUNIOR_CHURCH)
        self.assertIn('rccgjuniorchurch@thefaithtribe.live', sender)
        
        sender = get_sender(EmailSender.SUPPORT)
        self.assertIn('faithtribe.support@thefaithtribe.live', sender)
    
    def test_get_sender_fallback_to_default(self):
        """Test that invalid key falls back to default sender"""
        sender = get_sender('invalid_key')
        # Should return default, not raise an error
        self.assertIsNotNone(sender)
    
    def test_get_sender_default_key(self):
        """Test that 'default' key returns the default sender"""
        sender = get_sender('default')
        self.assertIsNotNone(sender)
    
    def test_validate_sender_valid_keys(self):
        """Test validate_sender returns True for valid keys"""
        self.assertTrue(validate_sender('support'))
        self.assertTrue(validate_sender('no_reply'))
        self.assertTrue(validate_sender('junior_church'))
        self.assertTrue(validate_sender('default'))
    
    def test_validate_sender_invalid_keys(self):
        """Test validate_sender returns False for invalid keys"""
        self.assertFalse(validate_sender('invalid'))
        self.assertFalse(validate_sender(''))
        self.assertFalse(validate_sender('random_key'))
    
    def test_get_all_senders(self):
        """Test get_all_senders returns all configured senders"""
        senders = get_all_senders()
        self.assertIsInstance(senders, dict)
        self.assertIn('support', senders)
        self.assertIn('no_reply', senders)
        self.assertIn('junior_church', senders)
        self.assertIn('default', senders)
    
    def test_get_sender_display_name(self):
        """Test extracting display name from sender"""
        display_name = get_sender_display_name('support')
        self.assertEqual(display_name, 'Faith Tribe Support')
        
        display_name = get_sender_display_name('junior_church')
        self.assertEqual(display_name, 'RCCG Junior Church')


class EmailServiceSenderIntegrationTests(TestCase):
    """Integration tests for EmailService with different senders"""
    
    @patch('tickets.services.EmailMultiAlternatives')
    def test_send_email_safely_uses_correct_sender(self, mock_email_class):
        """Test that _send_email_safely uses the correct from_email"""
        from tickets.services import EmailService
        
        mock_msg = MagicMock()
        mock_email_class.return_value = mock_msg
        
        # Test with junior_church sender
        EmailService._send_email_safely(
            subject='Test Subject',
            html_content='<p>Test</p>',
            recipients=['test@example.com'],
            sender='junior_church'
        )
        
        # Check that EmailMultiAlternatives was called with the correct from_email
        call_kwargs = mock_email_class.call_args[1]
        self.assertIn('rccgjuniorchurch@thefaithtribe.live', call_kwargs['from_email'])
    
    @patch('tickets.services.EmailMultiAlternatives')
    def test_send_email_safely_uses_support_sender(self, mock_email_class):
        """Test that support sender is used correctly"""
        from tickets.services import EmailService
        
        mock_msg = MagicMock()
        mock_email_class.return_value = mock_msg
        
        EmailService._send_email_safely(
            subject='Support Request',
            html_content='<p>Support content</p>',
            recipients=['test@example.com'],
            sender='support'
        )
        
        call_kwargs = mock_email_class.call_args[1]
        self.assertIn('faithtribe.support@thefaithtribe.live', call_kwargs['from_email'])
    
    @patch('tickets.services.EmailMultiAlternatives')
    def test_send_email_safely_uses_no_reply_sender(self, mock_email_class):
        """Test that no_reply sender is used correctly"""
        from tickets.services import EmailService
        
        mock_msg = MagicMock()
        mock_email_class.return_value = mock_msg
        
        EmailService._send_email_safely(
            subject='Notification',
            html_content='<p>Notification content</p>',
            recipients=['test@example.com'],
            sender='no_reply'
        )
        
        call_kwargs = mock_email_class.call_args[1]
        self.assertIn('no-reply@thefaithtribe.live', call_kwargs['from_email'])


@override_settings(EMAIL_SENDERS={})
class EmailSenderNoConfigTests(TestCase):
    """Tests for behavior when EMAIL_SENDERS is not configured"""
    
    def test_get_sender_without_config_returns_default(self):
        """Test fallback when EMAIL_SENDERS is empty"""
        sender = get_sender('support')
        # Should not raise, should return some default
        self.assertIsNotNone(sender)
