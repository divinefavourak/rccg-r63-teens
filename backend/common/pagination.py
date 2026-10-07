"""The pagination every list endpoint gets unless it names its own."""
from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """
    Twenty rows a page, as before, but a client may ask for more.

    The bare `PageNumberPagination` ignores `?page_size=`, so a client that
    needs a whole short list (66 Bible books, a teacher's drafts) had to walk it
    twenty rows at a time, one request after another, on the slowest connections
    the product has. The ceiling keeps a single response bounded.
    """

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200
