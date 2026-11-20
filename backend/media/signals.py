from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import MediaEpisode, MediaSeries


def _delete_files_on_commit(*fields):
    """Delete FileField/ImageField files from storage once the delete commits.

    Waiting for the commit matters: if the transaction rolls back, the row is
    still there and its files must be too. Names are read now, because the
    instance is gone by the time the callback runs.
    """
    targets = [(f.storage, f.name) for f in fields if f and f.name]
    if not targets:
        return

    def _delete():
        for storage, name in targets:
            try:
                storage.delete(name)
            except Exception:
                # A file already missing from R2 must not turn a finished
                # delete into an error.
                pass

    transaction.on_commit(_delete)


@receiver(post_delete, sender=MediaEpisode)
def delete_episode_files(sender, instance, **kwargs):
    """Remove the episode's files from R2, and the teens' likes that point at it.

    Favorites hold a bare `content_id`, not a foreign key, so nothing cascades
    to them; left alone they would point at an episode that no longer exists.
    """
    from profiles.models import Favorite

    _delete_files_on_commit(instance.video_file, instance.audio_file, instance.thumbnail)
    Favorite.objects.filter(
        content_type=Favorite.ContentType.MEDIA_EPISODE, content_id=instance.pk,
    ).delete()


@receiver(post_delete, sender=MediaSeries)
def delete_series_files(sender, instance, **kwargs):
    """Remove a series' artwork. Its episodes cascade, and the handler above
    clears each episode's own files."""
    _delete_files_on_commit(instance.cover_image, instance.banner_image, instance.host_image)
