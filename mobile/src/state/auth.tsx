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
  /** `identifier` is an email address, a phone number or a username. */
  signIn: (identifier: string, password: string) => Promise<void>;
  /** Sends one code to both the email address and the phone number. */
  startSignUp: (email: string, phone: string) => Promise<void>;
  /** Checks the code and creates the account, signed in. */
  completeSignUp: (details: SignUpDetails, code: string) => Promise<void>;
  /** Sends a sign-in code to an existing account's email or phone. */
  requestLoginCode: (identifier: string) => Promise<void>;
  signInWithCode: (identifier: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Set while a sign-in request is in flight. */
  pending: boolean;
  /** Last sign-in failure, as a sentence fit to show a teen. */
  error: string | null;
  clearError: () => void;
}

/** What `POST /auth/signup/complete/` accepts, besides the code. */
export interface SignUpDetails {
  email: string;
  /** In `+234…` form — see `toE164`. */
  phone: string;
  first_name: string;
  last_name: string;
  gender?: string;
  date_of_birth?: string;
  /** The deepest church node the teen picked, usually a parish. */
  church_node?: string;
}

/**
 * A Nigerian mobile number in the one form the server stores: `+234…`.
 *
 * Accepts what people actually type — `0803 555 0142`, `803 555 0142`,
 * `+234 803 555 0142`. Anything already starting with `+` is left alone, so a
 * teen abroad can still sign in. Returns '' when it is not a phone number.
 */
export function toE164(input: string): string {
  const raw = input.replace(/[\s\-().]/g, '');
  if (raw.startsWith('+')) return /^\+\d{9,15}$/.test(raw) ? raw : '';
  if (/^234\d{10}$/.test(raw)) return `+${raw}`;
  if (/^0\d{10}$/.test(raw)) return `+234${raw.slice(1)}`;
  if (/^[789]\d{9}$/.test(raw)) return `+234${raw}`;
  return '';
}

/** Where a sign-in code goes: the address as typed, or the phone in `+234…` form. */
export function codeDestination(input: string): { destination: string; channel: 'email' | 'sms' } | null {
  const value = input.trim();
  if (value.includes('@')) {
    return /^\S+@\S+\.\S+$/.test(value) ? { destination: value.toLowerCase(), channel: 'email' } : null;
  }
  const phone = toE164(value);
  return phone ? { destination: phone, channel: 'sms' } : null;
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
   * Run one auth request with the shared pending / error handling.
   *
   * `establish` is true for the calls that return tokens: the session is saved
   * and the query cache cleared, because guest and member see different
   * payloads from the same endpoints.
   */
  const run = useCallback(
    async (call: () => Promise<LoginResponse | unknown>, fallback: string, establish: boolean) => {
      setPending(true);
      setError(null);
      try {
        const data = await call();
        if (establish) {
          const session = data as LoginResponse;
          await saveTokens(session.access, session.refresh);
          setUser(session.user);
          qc.clear();
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : fallback);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [qc],
  );

  const startSignUp = useCallback(
    (email: string, phone: string) =>
      run(
        () => api.post('/auth/signup/start/', { email, phone }, { anonymous: true }),
        'Could not send your code. Please try again.',
        false,
      ),
    [run],
  );

  const completeSignUp = useCallback(
    (details: SignUpDetails, code: string) =>
      run(
        () =>
          api.post<LoginResponse>('/auth/signup/complete/', { ...details, code }, { anonymous: true }),
        'Could not create your account. Please try again.',
        true,
      ),
    [run],
  );

  const requestLoginCode = useCallback(
    (identifier: string) =>
      run(
        () => {
          const target = codeDestination(identifier);
          if (!target) throw new ApiError(400, 'Enter your email address or phone number first.');
          return api.post('/auth/otp/request/', { ...target, purpose: 'login' }, { anonymous: true });
        },
        'Could not send your code. Please try again.',
        false,
      ),
    [run],
  );

  const signInWithCode = useCallback(
    (identifier: string, code: string) =>
      run(
        () => {
          const target = codeDestination(identifier);
          if (!target) throw new ApiError(400, 'That code is wrong or has expired.');
          return api.post<LoginResponse>(
            '/auth/otp/verify/',
            { destination: target.destination, purpose: 'login', code },
            { anonymous: true },
          );
        },
        'Could not sign in. Please try again.',
        true,
      ),
    [run],
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
      startSignUp,
      completeSignUp,
      requestLoginCode,
      signInWithCode,
      signOut,
      pending,
      error,
      clearError,
    }),
    [user, ready, signIn, startSignUp, completeSignUp, requestLoginCode, signInWithCode,
     signOut, pending, error, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
