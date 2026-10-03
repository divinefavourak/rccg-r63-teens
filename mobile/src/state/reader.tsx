import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../theme/ThemeProvider';
import { READER_TOKENS, type ReaderTheme, type ReaderTokens } from '../theme/tokens';

const STORAGE_KEY = 'faithtribe.reader';

/** `auto` follows the app's own light or dark. */
export type ReaderThemeChoice = ReaderTheme | 'auto';

/** Reader text sizes, as named in Settings. 18 is the reader default. */
export const TEXT_SIZES = [
  { value: 16, label: 'Small' },
  { value: 18, label: 'Medium' },
  { value: 21, label: 'Large' },
  { value: 24, label: 'Extra large' },
] as const;

/** `short` is for places with room for one word, such as a settings row. */
export const READER_THEMES: { value: ReaderThemeChoice; label: string; short: string }[] = [
  { value: 'auto', label: 'Match app', short: 'Auto' },
  { value: 'light', label: 'Light', short: 'Light' },
  { value: 'sepia', label: 'Sepia', short: 'Sepia' },
  { value: 'dark', label: 'Dark', short: 'Dark' },
];

interface Stored {
  theme: ReaderThemeChoice;
  fontSize: number;
  /** OSIS code, e.g. 'John'. */
  book: string;
  chapter: number;
}

const DEFAULTS: Stored = { theme: 'auto', fontSize: 18, book: 'John', chapter: 1 };

interface ReaderValue extends Stored {
  /** False until the saved choices are read, so the reader never opens on the wrong page. */
  ready: boolean;
  /** `theme` resolved against the app's scheme. */
  tokens: ReaderTokens;
  setTheme: (theme: ReaderThemeChoice) => void;
  setFontSize: (size: number) => void;
  setPosition: (book: string, chapter: number) => void;
}

const ReaderContext = createContext<ReaderValue | null>(null);

/**
 * How the Bible reads on this phone: theme, text size and the page last open.
 *
 * Shared rather than local to the Bible tab because Settings changes the same
 * two choices, and kept on the device rather than the account because a teen
 * may read on a small phone and a tablet at different sizes.
 */
export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const { scheme } = useTheme();
  const [stored, setStored] = useState<Stored>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const saved = JSON.parse(raw) as Partial<Stored>;
        setStored((prev) => ({ ...prev, ...saved }));
      })
      .catch(() => {
        // Unreadable or corrupt: the defaults are a fine place to start.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Stored>) => {
    setStored((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setTheme = useCallback((theme: ReaderThemeChoice) => update({ theme }), [update]);
  const setFontSize = useCallback((fontSize: number) => update({ fontSize }), [update]);
  const setPosition = useCallback(
    (book: string, chapter: number) => update({ book, chapter }),
    [update],
  );

  const value = useMemo<ReaderValue>(
    () => ({
      ...stored,
      ready,
      tokens: READER_TOKENS[stored.theme === 'auto' ? scheme : stored.theme],
      setTheme,
      setFontSize,
      setPosition,
    }),
    [stored, ready, scheme, setTheme, setFontSize, setPosition],
  );

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReader(): ReaderValue {
  const ctx = useContext(ReaderContext);
  if (!ctx) throw new Error('useReader must be used inside <ReaderProvider>');
  return ctx;
}
