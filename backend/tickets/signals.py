# tickets/signals.py
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Ticket

# Create a simple signal for status changes
ticket_status_changed = None  # We'll implement this properly later

@receiver(post_save, sender=Ticket)
def ticket_post_save(sender, instance, created, **kwargs):
    """Simple post-save handler for tickets."""
    pass

@receiver(pre_save, sender=Ticket)
def ticket_pre_save(sender, instance, **kwargs):
    """Simple pre-save handler for tickets."""
    # Auto-set category based on age
    if instance.age < 13:
        instance.category = Ticket.Category.PRE_TEENS
    else:
        instance.category = Ticket.Category.TEENS