import type { Href } from 'expo-router';

/**
 * Where a notification leads.
 *
 * The server writes its links as web paths (`/events/<id>`), which are shared
 * with the website. The app's routes are named differently, so they are
 * translated here; anything unrecognised opens nothing rather than a dead page.
 *
 * Shared by the inbox (a row was tapped) and by push (the banner was tapped),
 * so the two can never disagree about where the same message goes.
 */
export function routeFor(link: string | null | undefined): Href | null {
  if (!link) return null;

  const ticket = /^\/events\/[^/]+\/ticket\/([^/]+)\/?$/.exec(link);
  if (ticket) return { pathname: '/ticket/[id]', params: { id: ticket[1] } };

  const event = /^\/events\/([^/]+)\/?$/.exec(link);
  if (event) return { pathname: '/event/[id]', params: { id: event[1] } };

  if (link.startsWith('/settings/notifications')) return '/settings/notifications';
  if (link.startsWith('/settings')) return '/settings';
  if (link.startsWith('/notifications')) return '/notifications';
  if (link.startsWith('/bible')) return '/bible';
  if (link.startsWith('/library')) return '/library';
  if (link.startsWith('/devotional')) return '/devotional';
  if (link === '/' || link.startsWith('/today')) return '/';
  return null;
}
