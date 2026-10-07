"""Tests for `common.view_counts.count_view`."""
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import RequestFactory, TestCase, override_settings

from common.view_counts import count_view

User = get_user_model()

LOCAL_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


class Item:
    """Stands in for any model with `increment_view_count`."""

    class _meta:
        label_lower = 'tests.item'

    def __init__(self, pk=1):
        self.pk = pk
        self.views = 0

    def increment_view_count(self):
        self.views += 1


@override_settings(CACHES=LOCAL_CACHE)
class CountViewTests(TestCase):

    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username='tolu', email='tolu@example.com', password='x')

    def request(self, user=None, address='10.0.0.1'):
        request = self.factory.get('/', REMOTE_ADDR=address)
        request.user = user or mock.Mock(is_authenticated=False)
        return request

    def test_the_first_look_counts(self):
        item = Item()

        self.assertTrue(count_view(self.request(self.user), item))
        self.assertEqual(item.views, 1)

    def test_reopening_it_does_not_count_again(self):
        item = Item()

        for _ in range(4):
            count_view(self.request(self.user), item)

        self.assertEqual(item.views, 1)

    def test_a_second_person_counts(self):
        item = Item()
        other = User.objects.create_user(
            username='amaka', email='amaka@example.com', password='x')

        count_view(self.request(self.user), item)
        count_view(self.request(other), item)

        self.assertEqual(item.views, 2)

    def test_the_same_person_counts_once_per_item(self):
        first, second = Item(pk=1), Item(pk=2)

        count_view(self.request(self.user), first)
        count_view(self.request(self.user), second)

        self.assertEqual((first.views, second.views), (1, 1))

    def test_guests_are_told_apart_by_address(self):
        item = Item()

        count_view(self.request(address='10.0.0.1'), item)
        count_view(self.request(address='10.0.0.1'), item)
        count_view(self.request(address='10.0.0.2'), item)

        self.assertEqual(item.views, 2)

    def test_an_unreachable_cache_still_counts(self):
        """django-redis swallows the error and answers None. That is not a no."""
        item = Item()

        with mock.patch('common.view_counts.cache.add', return_value=None):
            count_view(self.request(self.user), item)
            count_view(self.request(self.user), item)

        self.assertEqual(item.views, 2)

    def test_a_cache_that_raises_still_counts(self):
        item = Item()

        with mock.patch('common.view_counts.cache.add', side_effect=ConnectionError):
            count_view(self.request(self.user), item)

        self.assertEqual(item.views, 1)
