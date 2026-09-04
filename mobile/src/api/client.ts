import { API_URL } from './config';
import { clearTokens, getAccessTokenSync, getRefreshToken, saveTokens } from './tokens';

/**
 * The HTTP transport.
 *
 * `fetch` rather than axios: the web app needs axios interceptors for cookie
 * handling and CSRF, none of which apply here, and React Native ships fetch.
 * What is worth porting from `frontend/src/api/axios.ts` is the single-flight
 * refresh — see below.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }

  /** True when retrying could plausibly succeed. */
  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

/** Fires when a refresh fails, so the app can route back to signed-out. */
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(fn: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(fn);
  return () => sessionExpiredListeners.delete(fn);
}

function announceSessionExpired() {
  sessionExpiredListeners.forEach((fn) => fn());
}

/**
 * The in-flight refresh, shared by every request that 401s at once.
 *
 * Opening the app fires several requests together. When the access token has
 * expired they all 401 at the same moment, and without this lock each one starts
 * its own refresh — N refresh calls for one expired token, with the later ones
 * racing to overwrite storage using a refresh token the first call may already
 * have rotated. The first 401 performs the refresh; the rest await this promise.
 */
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = await getRefreshToken();
    if (!refresh) throw new ApiError(401, 'No session to refresh');

    // Deliberately not routed through `request()`: a failed refresh would
    // recurse back into this same handler.
    const res = await fetch(`${API_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) throw new ApiError(res.status, 'Session expired');

    const data = (await res.json()) as { access: string; refresh?: string };
    // SimpleJWT returns a new refresh token when ROTATE_REFRESH_TOKENS is on.
    await saveTokens(data.access, data.refresh);
    return data.access;
  })();

  // Clear the lock either way, so a later 401 can start a fresh attempt rather
  // than awaiting a settled promise for ever.
  refreshPromise.finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header — used by login/register. */
  anonymous?: boolean;
  signal?: AbortSignal;
  /** Override the base, for the handful of routes mounted outside /v1. */
  baseUrl?: string;
}

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const { method = 'GET', body, signal, baseUrl = API_URL } = options;

  // FormData carries its own multipart boundary. Setting Content-Type by hand
  // would omit that boundary and the server would reject the parts — so the
  // header is left for the runtime to fill in, and the body passes through
  // unserialised.
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isMultipart) headers['Content-Type'] = 'application/json';
  if (token && !options.anonymous) headers.Authorization = `Bearer ${token}`;

  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isMultipart ? (body as FormData) : JSON.stringify(body),
    signal,
  });
}

/**
 * Perform a request, refreshing once and replaying on a 401.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res: Response;

  try {
    res = await send(path, options, getAccessTokenSync());
  } catch (err) {
    // fetch rejects on network failure with no status. Status 0 marks it as
    // transient so React Query will retry rather than surface a hard error —
    // this app is used on intermittent mobile data.
    if ((err as Error)?.name === 'AbortError') throw err;

    // In development the overwhelmingly common cause is not a flaky network
    // but an unreachable dev server: `manage.py runserver` binds 127.0.0.1 by
    // default, which a phone or emulator cannot reach. Naming the URL it
    // actually tried turns a misleading "you're offline" into a fixable one.
    if (__DEV__) {
      throw new ApiError(
        0,
        `Could not reach ${options.baseUrl ?? API_URL}${path}. ` +
          'If this is a local server, start it with `runserver 0.0.0.0:8000` ' +
          'so the device can reach it.',
      );
    }
    throw new ApiError(0, 'Network unavailable');
  }

  if (res.status === 401 && !options.anonymous) {
    try {
      const access = await refreshAccessToken();
      res = await send(path, options, access);
    } catch {
      await clearTokens();
      announceSessionExpired();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, describe(payload, res.status), payload);
  }

  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Turn a DRF error body into one sentence a teen can act on.
 *
 * DRF returns `{"detail": "..."}` for most failures and
 * `{"field": ["msg", ...]}` for validation. 11-content-strategy.md asks for
 * specific, plain copy, so the field message is preferred over a generic one.
 */
function describe(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;

    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      if (typeof value === 'string') return value;
    }
  }
  if (status >= 500) return 'Something went wrong on our end. Please try again.';
  return 'That did not work. Please try again.';
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Fetch every page of a paginated DRF list.
 *
 * `PageNumberPagination` here caps a page at 20 rows and ignores `page_size`,
 * so a 66-book Bible arrives in four pages. Reading only the first is why the
 * book picker used to stop at Numbers with John nowhere in it.
 *
 * Pages are requested by number rather than by following the `next` URL: DRF
 * builds that from the request's Host header, and re-issuing an absolute URL
 * from a device that reached the API by a different address is a needless way
 * to lose the connection.
 */
export async function fetchAllPages<T>(
  path: string,
  options: RequestOptions = {},
  maxPages = 25,
): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?';
  const all: T[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const body = await request<Paginated<T> | T[]>(
      `${path}${separator}page=${page}`,
      options,
    );

    // A viewset with pagination disabled returns a bare array — one page, done.
    if (Array.isArray(body)) return body;

    all.push(...body.results);
    if (!body.next) break;
  }

  return all;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
