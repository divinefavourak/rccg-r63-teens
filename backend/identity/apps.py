from django.apps import AppConfig


class IdentityConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'identity'
    verbose_name = 'Identity & Authorization'

    def ready(self):
        # Connects the handlers that invalidate cached authority snapshots when
        # a role or assignment changes. Without this import the signals are never
        # registered and a revoked role would stay effective until its cache
        # entry expired.
        from . import signals  # noqa: F401
