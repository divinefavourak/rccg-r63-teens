import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the Django API lives.
 *
 * Order of preference:
 *   1. `EXPO_PUBLIC_API_URL` — set this in `.env` for staging/production.
 *   2. The machine currently serving the JS bundle, on port 8000 — unless the
 *      bundle comes through a tunnel, whose hostname cannot reach the API.
 *   3. Loopback, for the simulator.
 *
 * Step 2 is what makes a physical phone work in development. `localhost` on a
 * handset means the handset, so a hardcoded default fails on every real device
 * a teen leader might test with. Expo already knows the developer machine's LAN
 * address because it is serving the bundle from it, so that address is reused.
 */

const DEV_API_PORT = '8000';
const API_PREFIX = '/api/v1';

function bundleHost(): string | null {
  // e.g. "192.168.1.5:8081" in Expo Go / dev client.
  const hostUri = Constants.expoConfig?.hostUri ?? null;
  if (typeof hostUri !== 'string') return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

/**
 * True when the bundle is arriving through `expo start --tunnel`.
 *
 * A tunnel forwards Metro's port and nothing else, so its hostname is useless
 * for reaching Django: `http://<something>.exp.direct:8000` goes nowhere. In
 * that case the API address cannot be worked out and has to be given.
 */
function isTunnelHost(host: string): boolean {
  return /\.(exp\.direct|ngrok\.io|ngrok-free\.app|ngrok\.app)$/i.test(host);
}

function devHost(): string | null {
  const host = bundleHost();
  return host && !isTunnelHost(host) ? host : null;
}

/**
 * Set in development when the app is running through a tunnel with no
 * `EXPO_PUBLIC_API_URL`. The request error shows it, because "you're offline"
 * sends people looking at their Wi-Fi when the fix is one line in `.env`.
 */
export const API_SETUP_HINT: string | null =
  __DEV__ && !process.env.EXPO_PUBLIC_API_URL && isTunnelHost(bundleHost() ?? '')
    ? 'Expo is running with --tunnel, which only carries the app, not the API. ' +
      'Put EXPO_PUBLIC_API_URL=http://<your-computer-ip>:8000/api/v1 in mobile/.env ' +
      'and restart Expo, or start Expo without --tunnel.'
    : null;

function fallbackHost(): string {
  // The Android emulator reaches the host machine through a dedicated alias;
  // 127.0.0.1 inside it means the emulator itself.
  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const host = (__DEV__ && devHost()) || fallbackHost();
  return `http://${host}:${DEV_API_PORT}${API_PREFIX}`;
}

export const API_URL = resolveBaseUrl();

/**
 * The un-versioned base.
 *
 * `backend/urls.py` mounts `tickets.urls` at `api/` and never under `api/v1/`,
 * so those calls must not carry the `/v1` segment. Derived from `API_URL` so a
 * single environment variable still controls the host — the same arrangement
 * `frontend/src/api/axios.ts` uses on web.
 */
export const LEGACY_API_URL = API_URL.replace(/\/v1$/, '');

/** How long a cached response stays fresh before React Query refetches. */
export const STALE = {
  /** Today's content rolls over at a Lagos midnight; the server caches to match. */
  today: 5 * 60 * 1000,
  /** Scripture never changes. */
  scripture: 24 * 60 * 60 * 1000,
  /** Library and events change on an editorial cadence, not a live one. */
  catalogue: 10 * 60 * 1000,
  /** Anything the teen's own actions mutate. */
  personal: 30 * 1000,
} as const;
