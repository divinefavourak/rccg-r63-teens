"""The Content Manager role: someone put in charge of devotionals and content."""
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from content.models import Devotional
from content.services import review
from content.tests.test_review import make_devotional
from identity import authorization as authz
from identity.models import Role
from identity.permissions_registry import Perm
from .base import build_tree, make_user, seed_rbac


class ContentManagerRoleTests(TestCase):
    def setUp(self):
        seed_rbac()
        self.t = build_tree()
        self.role = Role.objects.get(code='content_manager')
        self.regional = Role.objects.get(code='regional_coordinator')

    def test_seeded_with_content_authority_only(self):
        self.assertEqual(self.role.permission_codes(), {
            Perm.HIERARCHY_VIEW, Perm.CONTENT_VIEW, Perm.CONTENT_PUBLISH,
            Perm.CONTENT_MANAGE, Perm.MEDIA_MANAGE,
        })
        self.assertTrue(self.role.description)

    def test_a_regional_coordinator_can_appoint_one_in_their_region(self):
        boss = make_user('boss')
        authz.assign_role(boss, self.regional, self.t['r1'])
        editor = make_user('editor')

        authz.assign_role(editor, self.role, self.t['r1'], appointed_by=boss)

        self.assertTrue(authz.has_any_permission(editor, Perm.CONTENT_PUBLISH))
        self.assertFalse(authz.has_any_permission(editor, Perm.ROLES_ASSIGN))
        self.assertFalse(authz.has_any_permission(editor, Perm.EVENTS_VIEW))

    def test_not_grantable_below_region(self):
        with self.assertRaises(ValidationError):
            authz.assign_role(make_user('editor'), self.role, self.t['parish_a'])

    def test_can_write_a_devotional_and_review_someone_elses(self):
        editor = make_user('editor')
        authz.assign_role(editor, self.role, self.t['r1'])
        client = APIClient()
        client.force_authenticate(editor)

        devotional = make_devotional()
        review.submit_for_review(devotional, make_user('author'))
        response = client.post(reverse('devotional-approve', args=[devotional.id]))
        self.assertEqual(response.status_code, 200, response.content)
        devotional.refresh_from_db()
        self.assertEqual(devotional.status, Devotional.Status.APPROVED)

        own = make_devotional(on=devotional.date.replace(year=devotional.date.year + 1))
        response = client.patch(
            reverse('devotional-detail', args=[own.id]), {'title': 'Edited'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
