"""
Deleting media from the Console.

The Console's Library & Media screen calls `DELETE /media/episodes/<id>/` and
`DELETE /media/series/<id>/`. These pin who may do that and what goes with it.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from identity.permissions_registry import Perm
from identity.tests.base import build_tree, make_user
from media.models import MediaEpisode, MediaSeries
from profiles.models import Favorite, TeenProfile


def grant(user, node, *codes):
    from identity.models import Permission, Role, RoleAssignment, RolePermission

    role, _ = Role.objects.get_or_create(
        code=f'test-{user.username}', defaults={'label': 'Test role'})
    for code in codes:
        permission, _ = Permission.objects.get_or_create(
            code=code, defaults={'label': code})
        RolePermission.objects.get_or_create(role=role, permission=permission)
    RoleAssignment.objects.get_or_create(user=user, role=role, node=node)


def make_series(title='Teen Talk'):
    return MediaSeries.objects.create(
        title=title, slug=title.lower().replace(' ', '-'),
        description='.', host_name='Pastor T', status='published',
    )


def make_episode(title='Episode one', series=None, status='published'):
    return MediaEpisode.objects.create(
        title=title, slug=title.lower().replace(' ', '-'), description='.',
        series=series, status=status, audio_url='https://example.com/a.mp3',
    )


class DeleteMediaTests(TestCase):
    def setUp(self):
        tree = build_tree()
        self.manager = make_user('mediamanager')
        grant(self.manager, tree['r1'], Perm.MEDIA_MANAGE, Perm.CONTENT_VIEW)
        self.teen = make_user('teenuser')
        self.profile = TeenProfile.objects.create(user=self.teen, gender='female')
        self.client = APIClient()

    def test_manager_deletes_an_episode_and_the_likes_on_it(self):
        episode = make_episode()
        Favorite.objects.create(
            profile=self.profile,
            content_type=Favorite.ContentType.MEDIA_EPISODE,
            content_id=episode.pk,
        )
        self.client.force_authenticate(self.manager)

        response = self.client.delete(f'/api/v1/media/episodes/{episode.pk}/')

        self.assertEqual(response.status_code, 204, response.content)
        self.assertFalse(MediaEpisode.objects.filter(pk=episode.pk).exists())
        self.assertFalse(Favorite.objects.filter(content_id=episode.pk).exists())

    def test_a_draft_episode_can_be_deleted(self):
        # A draft is what a manager most often wants gone: an upload that went
        # wrong. The public queryset hides drafts; the manager's must not.
        episode = make_episode(status='draft')
        self.client.force_authenticate(self.manager)

        response = self.client.delete(f'/api/v1/media/episodes/{episode.pk}/')

        self.assertEqual(response.status_code, 204, response.content)

    def test_deleting_a_series_takes_its_episodes(self):
        series = make_series()
        make_episode('One', series)
        make_episode('Two', series)
        loose = make_episode('Standalone')
        self.client.force_authenticate(self.manager)

        response = self.client.delete(f'/api/v1/media/series/{series.pk}/')

        self.assertEqual(response.status_code, 204, response.content)
        self.assertFalse(MediaSeries.objects.filter(pk=series.pk).exists())
        self.assertEqual(list(MediaEpisode.objects.values_list('pk', flat=True)), [loose.pk])

    def test_a_teen_cannot_delete(self):
        episode = make_episode()
        self.client.force_authenticate(self.teen)

        response = self.client.delete(f'/api/v1/media/episodes/{episode.pk}/')

        self.assertEqual(response.status_code, 403)
        self.assertTrue(MediaEpisode.objects.filter(pk=episode.pk).exists())
