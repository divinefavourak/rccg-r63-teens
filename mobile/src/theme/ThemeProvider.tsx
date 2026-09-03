import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DARK, LIGHT, type Scheme, type Tokens } from './tokens';

const STORAGE_KEY = 'faithtribe.colorScheme';

interface ThemeValue {
  /** The scheme actually being rendered. */
  scheme: Scheme;
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

  // Read the persisted choice once. Until it resolves the app renders with
  // NativeWind's default (the OS scheme), which is the correct fallback anyway
  // — `ready` exists so the splash screen can be held rather than letting a
  // light frame flash before a dark preference loads.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'light' || stored === 'dark') setColorScheme(stored);
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

  const scheme: Scheme = colorScheme === 'dark' ? 'dark' : 'light';

  // Writes are fire-and-forget and deliberately not awaited by the UI: the
  // toggle must feel instant, and a dropped write only costs the preference on
  // next launch.
  const persist = useCallback((next: Scheme) => {
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const setScheme = useCallback(
    (next: Scheme) => {
      setColorScheme(next);
      persist(next);
    },
    [setColorScheme, persist],
  );

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
      tokens: scheme === 'dark' ? DARK : LIGHT,
      ready,
      setScheme,
      toggle,
    }),
    [scheme, ready, setScheme, toggle],
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
