import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Whether the current user is signed in, and the handful of per-user flags the
 * screens toggle.
 *
 * Guests see the same five tabs and the same screens — the guest experience is
 * a preview of the real product, not a marketing site (05-navigation.md) — so
 * this is a flag read by a few components, never a separate navigator.
 *
 * When auth lands this becomes a wrapper over the token store; the shape it
 * exposes is already what the screens need.
 */
interface SessionValue {
  isGuest: boolean;
  signIn: () => void;
  signOut: () => void;
  /** Ids of completed daily-challenge items. */
  challengesDone: ReadonlySet<string>;
  toggleChallenge: (id: string) => void;
  /** Ids of bookmarked content. */
  saved: ReadonlySet<string>;
  toggleSaved: (id: string) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const [challengesDone, setChallengesDone] = useState<ReadonlySet<string>>(() => new Set());
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());

  const signIn = useCallback(() => setIsGuest(false), []);
  const signOut = useCallback(() => setIsGuest(true), []);

  const toggleChallenge = useCallback((id: string) => {
    setChallengesDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ isGuest, signIn, signOut, challengesDone, toggleChallenge, saved, toggleSaved }),
    [isGuest, signIn, signOut, challengesDone, toggleChallenge, saved, toggleSaved],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
