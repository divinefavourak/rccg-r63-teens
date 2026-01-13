"""
Email Senders Utility Module

Provides utilities for selecting the appropriate sender email address
based on email context (support, no-reply, event notifications, etc.)
"""
import logging
from enum import Enum
from typing import Optional
from django.conf import settings

logger = logging.getLogger(__name__)


class EmailSender(Enum):
    """Enum for type-safe sender selection"""
    SUPPORT = 'support'
    NO_REPLY = 'no_reply'
    JUNIOR_CHURCH = 'junior_church'
    DEFAULT = 'default'


def get_sender(sender_key: str | EmailSender = 'default') -> str:
    """
    Get sender email by key with fallback to default.
    
    Args:
        sender_key: The sender key or EmailSender enum value.
                   Options: 'support', 'no_reply', 'junior_church', 'default'
    
    Returns:
        str: The full sender email address (e.g., 'Name <email@domain.com>')
    
    Example:
        >>> get_sender('support')
        'Faith Tribe Support <faithtribe.support@thefaithtribe.live>'
        
        >>> get_sender(EmailSender.JUNIOR_CHURCH)
        'RCCG Junior Church <rccgjuniorchurch@thefaithtribe.live>'
    """
    # Handle EmailSender enum
    if isinstance(sender_key, EmailSender):
        sender_key = sender_key.value
    
    # Get senders from settings
    senders = getattr(settings, 'EMAIL_SENDERS', {})
    
    if not senders:
        logger.warning("EMAIL_SENDERS not configured, using DEFAULT_FROM_EMAIL")
        return getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@r63teens.com')
    
    # Try to get the requested sender
    if sender_key in senders:
        return senders[sender_key]
    
    # Log warning and fallback to default
    logger.warning(
        f"Invalid sender key '{sender_key}'. "
        f"Valid keys: {list(senders.keys())}. Falling back to default."
    )
    return senders.get('default', settings.DEFAULT_FROM_EMAIL)


def validate_sender(sender_key: str) -> bool:
    """
    Validate that a sender key exists in the configuration.
    
    Args:
        sender_key: The sender key to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    senders = getattr(settings, 'EMAIL_SENDERS', {})
    return sender_key in senders


def get_all_senders() -> dict:
    """
    Get all configured senders.
    
    Returns:
        dict: Dictionary of all sender configurations
    """
    return getattr(settings, 'EMAIL_SENDERS', {})


def get_sender_display_name(sender_key: str) -> Optional[str]:
    """
    Extract the display name from a sender email.
    
    Args:
        sender_key: The sender key
        
    Returns:
        str: The display name or None if not found
        
    Example:
        >>> get_sender_display_name('support')
        'Faith Tribe Support'
    """
    sender = get_sender(sender_key)
    if '<' in sender:
        return sender.split('<')[0].strip()
    return None
