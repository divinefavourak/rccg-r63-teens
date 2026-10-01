from django.apps import AppConfig


class TodayConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'today'
    verbose_name = 'Today (daily experience)'

    def ready(self):
        # Registers the handlers that clear the Today cache when a devotional,
        # memory verse, Scripture reference or daily challenge changes. Without
        # this import an editor's correction would not appear until midnight.
        from . import signals  # noqa: F401
