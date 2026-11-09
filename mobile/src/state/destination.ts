import { Platform } from 'react-native';

/**
 * Where to go after signing in.
 *
 * A teen who taps "Sign in" from an event, a saved item or a ticket should
 * come back to it, not be dropped on Today. The auth screens themselves are
 * never remembered: returning someone to the log-in screen they just left
 * would be a loop.
 *
 * On the web the Google flow is a full-page round trip, so the answer has to
 * survive a reload. `sessionStorage` is per-tab, which is exactly the scope of
 * "the page this sign-in started from"; the native app keeps it in memory.
 */
const STORAGE_KEY = 'faithtribe.authReturnTo';

let lastPath: string | null = null;

function isAuthPath(path: string): boolean {
  return (
    path === '/welcome' ||
    path === '/log-in' ||
    path === '/sign-up' ||
    path === '/verify' ||
    path === '/forgot-password' ||
    path === '/all-set' ||
    path.startsWith('/auth/')
  );
}

/** Called on every navigation; only a real app page is kept. */
export function rememberDestination(path: string): void {
  if (!path || isAuthPath(path)) return;
  lastPath = path;
  if (Platform.OS === 'web') {
    try {
      sessionStorage.setItem(STORAGE_KEY, path);
    } catch {
      // Private mode can block storage; memory still covers this visit.
    }
  }
}

/** Read and clear the destination, falling back to Today. */
export function takeDestination(fallback = '/'): string {
  let value = lastPath;
  if (Platform.OS === 'web') {
    try {
      value = sessionStorage.getItem(STORAGE_KEY) ?? value;
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Use the in-memory copy.
    }
  }
  lastPath = null;
  return value || fallback;
}
