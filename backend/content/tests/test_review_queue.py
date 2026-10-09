"""The Console's review queue: who submitted what, and who may approve it."""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from common.models import PublishableMixin
from content.services import review
from identity.tests.base import build_tree, make_user

from .test_review import grant, make_devotional

Status = PublishableMixin.Status
URL = '/api/v1/content/devotionals/review_queue/'
_LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


@override_settings(CACHES=_LOCMEM)
class ReviewQueueTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        node = build_tree()['r1']
        self.author = make_user('author')
        self.reviewer = make_user('reviewer')
        self.teen = make_user('teen')
        grant(self.author, node, 'content.view', 'content.manage', 'content.publish')
        grant(self.reviewer, node, 'content.view', 'content.publish')
        self.waiting = make_devotional()
        review.submit_for_review(self.waiting, self.author)

    def rows(self, user):
        self.client.force_authenticate(user)
        res = self.client.get(URL)
        self.assertEqual(res.status_code, 200)
        return res.data

    def test_it_lists_only_what_is_in_review(self):
        from datetime import timedelta
        make_devotional(on=self.waiting.date + timedelta(days=1))  # still a draft
        data = self.rows(self.reviewer)
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['id'], str(self.waiting.id))

    def test_it_names_the_submitter(self):
        row = self.rows(self.reviewer)['results'][0]
        self.assertEqual(row['submitted_by']['id'], str(self.author.id))
        self.assertEqual(row['kind'], 'devotional')
        self.assertTrue(row['has_memory_verse'])

    def test_a_second_person_may_approve(self):
        row = self.rows(self.reviewer)['results'][0]
        self.assertFalse(row['is_mine'])
        self.assertTrue(row['can_approve'])

    def test_the_submitter_may_not_approve_their_own(self):
        row = self.rows(self.author)['results'][0]
        self.assertTrue(row['is_mine'])
        self.assertFalse(row['can_approve'])

    def test_it_is_not_for_someone_without_content_view(self):
        self.client.force_authenticate(self.teen)
        self.assertEqual(self.client.get(URL).status_code, 403)
