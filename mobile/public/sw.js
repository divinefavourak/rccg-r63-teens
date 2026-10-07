/*
 * Faith Tribe's service worker: the part of the web app that runs when no page
 * is open. It does two jobs.
 *
 * 1. Opens the app with no signal. The page and its scripts are kept on the
 *    phone, so a teen on the bus gets the app, not the browser's "no internet"
 *    page. What the app then shows comes from its own saved data.
 * 2. Shows a notification when the server sends one, and opens the right
 *    screen when it is tapped.
 *
 * It never touches requests to the API. Those go to another site, and what to
 * keep of them is the app's decision (`src/api/persist.ts`, `bibleStore.ts`).
 *
 * Plain JavaScript, served as written: nothing builds this file.
 */

// Bump to throw away everything kept by an older version of this file.
const VERSION = 'v1';
const SHELL = `faithtribe-shell-${VERSION}`;
const ASSETS = `faithtribe-assets-${VERSION}`;

self.addEventListener('install', (event) => {
  // Keep the page itself straight away, so the very next launch can be offline.
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(new Request('/', { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('faithtribe-') && name !== SHELL && name !== ASSETS)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Files whose name changes whenever their contents do: safe to keep for ever. */
function isBuiltAsset(url) {
  return url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Opening the app, at any address: every screen is the same page. Fresh from
  // the network when there is one, so a new release is picked up; the kept copy
  // when there is not.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) keep(SHELL, '/', response);
          return response;
        })
        .catch(() => kept(SHELL, '/').then((page) => page || Response.error())),
    );
    return;
  }

  if (isBuiltAsset(url)) {
    event.respondWith(
      kept(ASSETS, request).then(
        (asset) =>
          asset ||
          fetch(request).then((response) => {
            if (response.ok) keep(ASSETS, request, response);
            return response;
          }),
      ),
    );
  }
});

/*
 * Keeping and finding files, both failing soft.
 *
 * A browser's cache storage can refuse to open: no space left, a private
 * window, a profile in a bad state. That must cost nothing but the offline
 * copy. A lookup that fails is a miss, so the file comes from the network; a
 * save that fails is skipped. Without this, a phone with a full disk would get
 * a blank page instead of the app.
 */
function kept(cacheName, key) {
  return caches
    .open(cacheName)
    .then((cache) => cache.match(key))
    .catch(() => undefined);
}

function keep(cacheName, key, response) {
  const copy = response.clone();
  caches
    .open(cacheName)
    .then((cache) => cache.put(key, copy))
    .catch(() => {});
}

// ─── Notifications ──────────────────────────────────────────────────────────

/*
 * The server sends `{title, body, url, type, id, data}`
 * (backend `notifications/push.py`, `payload_for`).
 *
 * Every push must end in a shown notification. Safari takes the permission
 * away from a site that receives pushes and shows nothing.
 */
self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(message.title || 'Faith Tribe', {
        body: message.body || '',
        icon: '/icons/icon-192.png',
        // The same message arriving twice replaces itself instead of stacking.
        tag: message.id || undefined,
        data: { url: message.url || '', id: message.id || '' },
      }),
      // An open app refreshes its inbox and the unread dot.
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((windows) => windows.forEach((client) => client.postMessage({ type: 'push' }))),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url = '', id = '' } = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Already open: bring it forward and let the app go to the right screen.
      const open = windows[0];
      if (open) {
        open.postMessage({ type: 'open', url, id });
        return open.focus();
      }
      // Closed: start it, carrying where to go. The server's links are named
      // for the website, so the app translates them (`src/data/links.ts`).
      const query = new URLSearchParams({ open: url, n: id });
      return self.clients.openWindow(`/?${query}`);
    }),
  );
});
