from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import MediaEpisode


def _delete_file(field):
    """Delete a FileField/ImageField file from storage if it exists."""
    if field and field.name:
        try:
            field.storage.delete(field.name)
        except Exception:
            pass


@receiver(post_delete, sender=MediaEpisode)
def delete_episode_files(sender, instance, **kwargs):
    """Remove video, audio, and thumbnail files from R2 when an episode is deleted."""
    _delete_file(instance.video_file)
    _delete_file(instance.audio_file)
    _delete_file(instance.thumbnail)
