# from django.db.models.signals import post_save, pre_delete
# from django.dispatch import receiver
# from django.contrib.auth import get_user_model
# from .models import AuditLog

# User = get_user_model()


# @receiver(post_save, sender=User)
# def user_audit_log(sender, instance, created, **kwargs):
#     """Create audit log for user changes"""
#     if created:
#         action = AuditLog.ActionType.CREATE
#         old_values = None
#         new_values = {
#             'username': instance.username,
#             'email': instance.email,
#             'role': instance.role,
#             'province': instance.province,
#         }
#     else:
#         action = AuditLog.ActionType.UPDATE
#         # In a real implementation, you'd track old values
#         old_values = None
#         new_values = None
    
#     # We'll skip auto-creating audit logs from signals for now
#     # to avoid recursion. We'll handle it in views.


# @receiver(pre_delete, sender=User)
# def user_delete_audit_log(sender, instance, **kwargs):
#     """Create audit log for user deletion"""
#     # We'll handle this in views to avoid circular imports
#     pass