import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { api, ApiError, onSessionExpired } from '../api/client';
import { clearTokens, loadTokens, saveTokens } from '../api/tokens';
import type { AuthUser, LoginResponse } from '../api/types';

/**
 * Who is signed in.
 *
 * Replaces the `isGuest` flag the screens were built against. The shape is
 * deliberately close to it — `isGuest` is still exposed — because
 * 05-navigation.md makes the guest experience the same five tabs and the same
 * screens, so signing in changes what the screens *render*, never which screens
 * exist.
 */
interface AuthValue {
  user: AuthUser | null;
  isGuest: boolean;
  /** False until the stored session has been read, so nothing flashes. */
  ready: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Set while a sign-in request is in flight. */
  pending: boolean;
  /** Last sign-in failure, as a sentence fit to show a teen. */
  error: string | null;
  clearError: () => void;
}

/** What `POST /auth/register/` accepts. Six fields are required. */
export interface SignUpInput {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  province?: string;
  zone?: string;
  area?: string;
  parish?: string;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cold start: if a refresh token survives in the keychain, ask the server who
  // it belongs to. `/auth/me/` doubles as a token validity check, so an expired
  // or revoked session resolves to signed-out rather than to a broken UI.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { access, refresh } = await loadTokens();
      if (!access && !refresh) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const me = await api.get<AuthUser>('/auth/me/');
        if (!cancelled) setUser(me);
      } catch {
        // The client already cleared the tokens and announced expiry if the
        // refresh failed; anything else here is equally a signed-out state.
        await clearTokens();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // A refresh that fails mid-session must drop the user back to the guest view
  // rather than leave every query erroring in place.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        qc.clear();
      }),
    [qc],
  );

  const signIn = useCallback(
    async (username: string, password: string) => {
      setPending(true);
      setError(null);
      try {
        const data = await api.post<LoginResponse>(
          '/auth/login/',
          { username, password },
          // No Authorization header: a stale token on the device must not make
          // a fresh sign-in fail.
          { anonymous: true },
        );
        await saveTokens(data.access, data.refresh);
        setUser(data.user);
        // Guest and member see different payloads from the same endpoints, so
        // nothing cached while signed out should survive signing in.
        qc.clear();
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Could not sign in. Please try again.';
        setError(message);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [qc],
  );

  /**
   * Create an account, then sign straight in.
   *
   * `/auth/register/` returns the created user but no tokens, so a teen who
   * just typed their password would otherwise be dropped back at the sign-in
   * form to type it again. The credentials are already in hand here.
   */
  const signUp = useCallback(
    async (input: SignUpInput) => {
      setPending(true);
      setError(null);
      try {
        await api.post('/auth/register/', input, { anonymous: true });
        const data = await api.post<LoginResponse>(
          '/auth/login/',
          { username: input.username, password: input.password },
          { anonymous: true },
        );
        await saveTokens(data.access, data.refresh);
        setUser(data.user);
        qc.clear();
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Could not create your account. Please try again.';
        setError(message);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    // Best-effort blacklist; the local session is cleared either way, because a
    // teen tapping "sign out" on a dead connection must still be signed out.
    try {
      await api.post('/auth/logout/', {});
    } catch {
      // Ignored on purpose.
    }
    await clearTokens();
    setUser(null);
    qc.clear();
  }, [qc]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      isGuest: user === null,
      ready,
      signIn,
      signUp,
      signOut,
      pending,
      error,
      clearError,
    }),
    [user, ready, signIn, signUp, signOut, pending, error, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
