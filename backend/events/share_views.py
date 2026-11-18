"""
The page behind a shared event link, and the flier picture it names
(`share.py` says why it is built this way).

Plain Django views rather than DRF: they answer chat apps' preview fetchers
and browsers, with HTML and a JPEG, and need no login.
"""
from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.views import View

from . import share

# Short: the page changes when the event does, but a status is viewed in
# bursts, and the site in front of this API may keep a copy for that long.
_PAGE_CACHE = 'public, max-age=300'


class EventSharePageView(View):
    """`/events/share/<slug>/`: what a shared event link opens."""

    def get(self, request, key):
        event = share.find(key)
        if event is None:
            response = render(request, 'events/share.html', {
                'missing': True,
                'web_url': f'{settings.WEB_APP_URL}/tribe',
            }, status=404)
            return response

        response = render(request, 'events/share.html', {
            'event': event,
            'summary': share.plain_text(
                event.description or event.short_description, limit=200),
            'share_url': share.link(event, request),
            'image': share.preview_image_url(event, request),
            'web_url': share.web_app_url(event),
            'intent_url': share.android_intent_url(event),
        })
        response['Cache-Control'] = _PAGE_CACHE
        return response


class EventShareFlierView(View):
    """`/events/share/<slug>/flier.jpg`: the flier, small enough for a preview."""

    def get(self, request, key):
        event = share.find(key)
        if event is None or not event.cover_image:
            raise Http404
        data = share.flier_jpeg(event)
        if data is None:
            # Could not make it smaller. The original may still be shown, and
            # is better than no picture at all.
            try:
                return HttpResponseRedirect(event.cover_image.url)
            except Exception:
                raise Http404
        response = HttpResponse(data, content_type='image/jpeg')
        response['Cache-Control'] = 'public, max-age=86400'
        return response
