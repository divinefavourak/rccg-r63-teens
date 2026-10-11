import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DARK, LIGHT, type Scheme, type Tokens } from './tokens';

const STORAGE_KEY = 'faithtribe.colorScheme';

/** What the teen chose: a fixed scheme, or whatever the phone is set to. */
export type SchemePreference = Scheme | 'system';

interface ThemeValue {
  /** The scheme actually being rendered. */
  scheme: Scheme;
  /** The choice behind it — `system` follows the phone. */
  preference: SchemePreference;
  setPreference: (next: SchemePreference) => void;
  /** Literal colour strings, for SVG / gradients / native chrome. */
  tokens: Tokens;
  /** True once the stored preference has been read, so we never flash. */
  ready: boolean;
  setScheme: (next: Scheme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();
  const [ready, setReady] = useState(false);
  const [preference, setPreferenceState] = useState<SchemePreference>('system');

  // Read the persisted choice once. Until it resolves the app renders with
  // NativeWind's default (the OS scheme), which is the correct fallback anyway
  // — `ready` exists so the splash screen can be held rather than letting a
  // light frame flash before a dark preference loads.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'light' || stored === 'dark') {
          setColorScheme(stored);
          setPreferenceState(stored);
        }
      })
      .catch(() => {
        // A failed read is not worth surfacing: the OS scheme is a fine
        // default and the next successful write repairs it.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setColorScheme]);

  // On the web, "match phone" has to be done by hand. With class-based dark
  // mode NativeWind starts every page as light unless <html> already carries
  // the `dark` class, and its own "system" setting only moves the values read
  // from JS, never that class — so a phone set to dark got a light web app, or
  // dark icons on light cards. Reading the browser's own setting and passing
  // it on as a plain choice keeps both halves together, and follows the phone
  // if it changes while the app is open.
  useEffect(() => {
    if (Platform.OS !== 'web' || preference !== 'system') return;
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const follow = () => setColorScheme(query.matches ? 'dark' : 'light');
    follow();
    // Safari before 14 has `matchMedia` but only the older listener pair.
    // "Match phone" is the default, so throwing here would be a blank app on
    // every old iPhone.
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', follow);
      return () => query.removeEventListener('change', follow);
    }
    query.addListener?.(follow);
    return () => query.removeListener?.(follow);
  }, [preference, setColorScheme]);

  const scheme: Scheme = colorScheme === 'dark' ? 'dark' : 'light';

  // Writes are fire-and-forget and deliberately not awaited by the UI: the
  // toggle must feel instant, and a dropped write only costs the preference on
  // next launch.
  // "Match phone" is stored as no stored choice at all, which is also what a
  // fresh install has.
  const setPreference = useCallback(
    (next: SchemePreference) => {
      setColorScheme(next);
      setPreferenceState(next);
      const write =
        next === 'system' ? AsyncStorage.removeItem(STORAGE_KEY) : AsyncStorage.setItem(STORAGE_KEY, next);
      write.catch(() => {});
    },
    [setColorScheme],
  );

  const setScheme = useCallback((next: Scheme) => setPreference(next), [setPreference]);

  // `scheme` is read through a ref so `toggle` keeps a stable identity across
  // theme changes — it is passed to memoised rows that would otherwise all
  // re-render whenever the theme flips.
  const schemeRef = useRef(scheme);
  schemeRef.current = scheme;
  const toggle = useCallback(() => {
    setScheme(schemeRef.current === 'dark' ? 'light' : 'dark');
  }, [setScheme]);

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      preference,
      setPreference,
      tokens: scheme === 'dark' ? DARK : LIGHT,
      ready,
      setScheme,
      toggle,
    }),
    [scheme, preference, setPreference, ready, setScheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** Shorthand for the common case of only needing colour literals. */
export function useTokens(): Tokens {
  return useTheme().tokens;
}
