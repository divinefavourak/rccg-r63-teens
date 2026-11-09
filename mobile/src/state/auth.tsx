import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api, ApiError, forgetResponses, onSessionExpired } from '../api/client';
import { API_URL } from '../api/config';
import { forgetQueries } from '../api/persist';
import { clearTokens, getRefreshToken, loadTokens, saveTokens } from '../api/tokens';
import { unregisterPushDevice } from './push';
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
/** What `POST /auth/google/signup/` returns after Google verified the identity. */
export interface GoogleSignupDetails {
  email: string;
  first_name: string;
  last_name: string;
}

/** The answers the app adds before `POST /auth/google/complete/` creates the account. */
export interface GoogleSignupCompletion {
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  gender?: string;
  church_node?: string;
}

/** How Google's browser flow ended on this phone. */
export type GoogleSignInResult =
  | { status: 'signed-in' }
  | { status: 'cancelled' }
  /** No account yet: the app must finish the sign-up questions first. */
  | { status: 'new'; ticket: string };

interface AuthValue {
  user: AuthUser | null;
  isGuest: boolean;
  /** False until the stored session has been read, so nothing flashes. */
  ready: boolean;
  /** `identifier` is an email address, a phone number or a username. */
  signIn: (identifier: string, password: string) => Promise<void>;
  /** Sends the sign-up verification code. */
  startSignUp: (email: string, phone: string) => Promise<void>;
  /** Checks the code and creates the account, signed in. */
  completeSignUp: (details: SignUpDetails, code: string) => Promise<void>;
  /** Sends a sign-in code to an existing account's email address. */
  requestLoginCode: (identifier: string) => Promise<void>;
  signInWithCode: (identifier: string, code: string) => Promise<void>;
  /**
   * Google's browser flow. Resolves `signed-in`, `cancelled`, or `new` with the
   * ticket the sign-up form finishes.
   */
  signInWithGoogle: () => Promise<GoogleSignInResult>;
  /** The name and email behind a new Google sign-up ticket. */
  googleSignupDetails: (ticket: string) => Promise<GoogleSignupDetails>;
  /** Creates the account from the sign-up answers and signs the teen in. */
  completeGoogleSignup: (
    ticket: string,
    details: GoogleSignupCompletion,
  ) => Promise<void>;
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
 * A phone number in the one form the server stores: `+<country><number>`.
 *
 * `dial` is the country chosen in the phone field. For Nigeria it accepts what
 * people actually type — `0803 555 0142`, `803 555 0142`, `234 803 555 0142`.
 * For anywhere else the national number has its leading zero dropped and the
 * country code put in front. Anything already starting with `+` is taken as
 * written, whatever country is selected. Returns '' when it is not a number.
 */
export function toE164(input: string, dial = '+234'): string {
  const raw = input.replace(/[\s\-().]/g, '');
  if (raw.startsWith('+')) return /^\+\d{9,15}$/.test(raw) ? raw : '';

  if (dial === '+234') {
    if (/^234\d{10}$/.test(raw)) return `+${raw}`;
    if (/^0\d{10}$/.test(raw)) return `+234${raw.slice(1)}`;
    if (/^[789]\d{9}$/.test(raw)) return `+234${raw}`;
    return '';
  }

  const national = raw.replace(/^0+/, '');
  if (!/^\d{6,12}$/.test(national)) return '';
  const full = `${dial}${national}`;
  return /^\+\d{9,15}$/.test(full) ? full : '';
}

/**
 * Where a sign-in code goes: an email address, or nothing.
 *
 * Email only on purpose. The app no longer offers a code by SMS: the same
 * number can be a parent's or shared between siblings, and delivery is not
 * reliable enough to be a way in. A phone number in the field is still fine
 * for password sign-in — `_resolve_login_username` maps it to the account.
 */
export function codeDestination(input: string): { destination: string; channel: 'email' } | null {
  const value = input.trim();
  if (!value.includes('@')) return null;
  return /^\S+@\S+\.\S+$/.test(value)
    ? { destination: value.toLowerCase(), channel: 'email' }
    : null;
}

/** One query parameter from the address Google's callback sent back. */
function queryParam(url: string, name: string): string | null {
  const start = url.indexOf('?');
  if (start === -1) return null;
  const query = url.slice(start + 1).split('#')[0];
  for (const pair of query.split('&')) {
    const equals = pair.indexOf('=');
    const key = decodeURIComponent(equals === -1 ? pair : pair.slice(0, equals));
    if (key === name) {
      return decodeURIComponent(equals === -1 ? '' : pair.slice(equals + 1));
    }
  }
  return null;
}

/** What to tell a teen when Google sent the app back with an error code. */
function googleMessage(code: string): string {
  switch (code) {
    case 'no_account':
      return 'No Faith Tribe account uses that Google email. Create an account first.';
    case 'not_configured':
      return 'Google sign-in is not available right now. Use your email instead.';
    case 'google_error':
      return 'Google could not complete the sign-in. Please try again.';
    case 'server_error':
      return 'Google sign-in is temporarily unavailable. Please try again in a moment.';
    default:
      return 'Could not sign in with Google. Please try again.';
  }
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Who was signed in when the app last closed.
 *
 * Only the name-and-address card the app shows, never a credential: the tokens
 * stay in the keychain. It lets a launch know who the teen is without a round
 * trip, which is the difference between opening on their own Today and waiting
 * on a splash screen for a server that may be asleep.
 */
const USER_KEY = 'faithtribe.user';

async function loadUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function rememberUser(user: AuthUser | null): void {
  const done = user
    ? AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
    : AsyncStorage.removeItem(USER_KEY);
  done.catch(() => {
    // Not remembered. The next launch asks the server, as it always used to.
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  /** Every change of who is signed in goes through here, so it is remembered. */
  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next);
    rememberUser(next);
  }, []);

  /**
   * Drop everything loaded for the previous person, in memory and on the phone.
   * Guest and member see different answers from the same addresses.
   */
  const startClean = useCallback(() => {
    qc.clear();
    forgetQueries();
    forgetResponses();
  }, [qc]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cold start. A session is a token in the keychain plus the remembered card
  // of who it belongs to. With both, the app opens as that teen straight away
  // and checks with the server behind the first screen. It used to wait for
  // that check before drawing anything, and to sign the teen out if the check
  // could not be made: opening the app with no signal logged you out.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ access, refresh }, remembered] = await Promise.all([loadTokens(), loadUser()]);
      if (!access && !refresh) {
        // A remembered teen with no token left: the session was lost some
        // other way. What was saved for them must not greet a guest.
        if (remembered) {
          rememberUser(null);
          startClean();
        }
        if (!cancelled) setReady(true);
        return;
      }

      if (remembered && !cancelled) {
        setUserState(remembered);
        setReady(true);
      }

      try {
        const me = await api.get<AuthUser>('/auth/me/');
        if (!cancelled) setUser(me);
      } catch (err) {
        // Only the server saying "no" ends a session. The client has already
        // cleared the tokens and announced it if the refresh was refused. No
        // signal, or a server that is down, says nothing about the session:
        // the teen stays signed in and the next request tries again.
        // A 429 or a 403 is the server being busy or strict, not a refusal of
        // who this is.
        const refused = err instanceof ApiError && err.status === 401;
        if (refused) {
          await clearTokens();
          if (!cancelled) setUser(null);
          startClean();
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setUser, startClean]);

  // A refresh that fails mid-session must drop the user back to the guest view
  // rather than leave every query erroring in place.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        startClean();
      }),
    [setUser, startClean],
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
        startClean();
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Could not sign in. Please try again.';
        setError(message);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [setUser, startClean],
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
          startClean();
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : fallback);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [setUser, startClean],
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
          if (!target) throw new ApiError(400, 'Enter your email address first.');
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

  const signInWithGoogle = useCallback(async (): Promise<GoogleSignInResult> => {
    setPending(true);
    setError(null);
    try {
      // The API runs the OAuth flow and comes back to this app's own address
      // with a short-lived ticket. The Google client secret never reaches the
      // phone, and no Google client ID is compiled into the build.
      const returnUrl = Linking.createURL('auth/google');
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/auth/google/start/?return=${encodeURIComponent(returnUrl)}`,
        returnUrl,
      );
      if (result.type !== 'success') return { status: 'cancelled' };

      const failure = queryParam(result.url, 'error');
      if (failure === 'google_denied') return { status: 'cancelled' };
      if (failure) throw new ApiError(400, googleMessage(failure));

      // No account yet: the sign-up screen creates it after asking the
      // questions Google cannot answer (phone, birth date, parish).
      const signup = queryParam(result.url, 'signup');
      if (signup) return { status: 'new', ticket: signup };

      const code = queryParam(result.url, 'code');
      if (!code) throw new ApiError(400, 'Google did not finish signing you in. Please try again.');

      const data = await api.post<LoginResponse>(
        '/auth/google/exchange/',
        { code },
        { anonymous: true },
      );
      await saveTokens(data.access, data.refresh);
      setUser(data.user);
      startClean();
      return { status: 'signed-in' };
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not sign in with Google. Check your connection and try again.',
      );
      throw err;
    } finally {
      setPending(false);
    }
  }, [setUser, startClean]);

  const googleSignupDetails = useCallback(
    (ticket: string) =>
      api.post<GoogleSignupDetails>(
        '/auth/google/signup/',
        { ticket },
        { anonymous: true },
      ),
    [],
  );

  const completeGoogleSignup = useCallback(
    (ticket: string, details: GoogleSignupCompletion) =>
      run(
        () =>
          api.post<LoginResponse>(
            '/auth/google/complete/',
            { ticket, ...details },
            { anonymous: true },
          ),
        'Could not create your account. Please try again.',
        true,
      ),
    [run],
  );

  const signOut = useCallback(async () => {
    // While the session still exists: stop this account's notifications
    // reaching this phone. Best effort, like the blacklist below.
    await unregisterPushDevice();
    // Best-effort blacklist; the local session is cleared either way, because a
    // teen tapping "sign out" on a dead connection must still be signed out.
    try {
      // The server can only blacklist a token it is given. The web app sends
      // it in a cookie; this app has to put it in the body.
      //
      // Sent without the session: an access token near its end would be
      // renewed first, which hands out a new refresh token and leaves the one
      // in this body, the one about to be blacklisted, as the old one.
      const refresh = await getRefreshToken();
      await api.post('/auth/logout/', refresh ? { refresh } : {}, { anonymous: true });
    } catch {
      // Ignored on purpose.
    }
    await clearTokens();
    setUser(null);
    startClean();
  }, [setUser, startClean]);

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
      signInWithGoogle,
      googleSignupDetails,
      completeGoogleSignup,
      signOut,
      pending,
      error,
      clearError,
    }),
    [user, ready, signIn, startSignUp, completeSignUp, requestLoginCode, signInWithCode,
     signInWithGoogle, googleSignupDetails, completeGoogleSignup, signOut, pending, error,
     clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
