import * as SecureStore from 'expo-secure-store';

/**
 * JWT storage.
 *
 * `expo-secure-store` rather than AsyncStorage: these are bearer credentials for
 * a minor's account, and AsyncStorage is plain text on disk. SecureStore puts
 * them in the iOS Keychain and Android Keystore.
 *
 * The access token is also held in memory so the common path — attaching a
 * header to a request — never has to await a native keychain read.
 */

const ACCESS_KEY = 'faithtribe.access';
const REFRESH_KEY = 'faithtribe.refresh';

let accessToken: string | null = null;

export function getAccessTokenSync(): string | null {
  return accessToken;
}

/** Rehydrate from the keychain on cold start. */
export async function loadTokens(): Promise<{ access: string | null; refresh: string | null }> {
  try {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    accessToken = access;
    return { access, refresh };
  } catch {
    // A keychain that will not open is indistinguishable from being signed out,
    // and treating it as signed out is the safe reading.
    accessToken = null;
    return { access: null, refresh: null };
  }
}

export async function saveTokens(access: string, refresh?: string): Promise<void> {
  accessToken = access;
  try {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  } catch {
    // The in-memory copy still serves this session; the user signs in again
    // next launch rather than seeing an error for something they cannot fix.
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  } catch {
    // Nothing useful to do; memory is already cleared.
  }
}
