"""Pagination for endpoints that admin tooling reads in bulk."""
from rest_framework.pagination import PageNumberPagination


class UserPagination(PageNumberPagination):
    """Large-page pagination for the admin user list.

    The global default is 20, which is right for teen-facing feeds and wrong
    here: the Console and the legacy admin panel both read this endpoint as a
    whole list, so a 20-row page would truncate what an administrator sees
    without any visible sign that it had.

    100 covers the current dataset in one request while still bounding the
    response — the endpoint can no longer serialize an unbounded number of rows
    into memory. Callers that need more pass ``?page_size=``, capped at 1000.
    """

    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000
