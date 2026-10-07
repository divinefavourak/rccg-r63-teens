/**
 * `tokens.ts` for the browser.
 *
 * There is no keychain to put them in. `expo-secure-store` has nothing behind
 * it on the web, so with the app's version every read failed quietly and a
 * teen was signed out each time the page reloaded.
 *
 * They go in `localStorage`. That is readable by any script running on this
 * site, which a keychain is not, so the site must go on loading no third-party
 * scripts. A cookie the page cannot read would be safer still, but the API is
 * on a different site from the app, and Safari on an iPhone does not send
 * cookies across sites: it is the one browser this is built for.
 */

const ACCESS_KEY = 'faithtribe.access';
const REFRESH_KEY = 'faithtribe.refresh';

let accessToken: string | null = null;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage is blocked (some private windows). Signed out is the safe reading.
    return null;
  }
}

export function getAccessTokenSync(): string | null {
  return accessToken;
}

export async function loadTokens(): Promise<{ access: string | null; refresh: string | null }> {
  accessToken = read(ACCESS_KEY);
  return { access: accessToken, refresh: read(REFRESH_KEY) };
}

export async function saveTokens(access: string, refresh?: string): Promise<void> {
  accessToken = access;
  try {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    // The in-memory copy still serves this visit.
  }
}

export async function getRefreshToken(): Promise<string | null> {
  return read(REFRESH_KEY);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Nothing useful to do; memory is already cleared.
  }
}
