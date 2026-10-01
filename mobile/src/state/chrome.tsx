import { createContext, useContext, useMemo } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * How far the bottom nav is currently tucked away, 0 (shown) to 1 (hidden).
 *
 * 05-navigation.md: the bottom nav "hides on scroll-down, returns on scroll-up
 * inside the Bible Reader and article/long-form readers only — reading is the
 * one context where immersion beats wayfinding. Everywhere else it is fixed."
 *
 * This is a Reanimated shared value rather than React state on purpose. The
 * reader drives it from a scroll handler that runs on the UI thread; routing it
 * through `setState` would put a re-render of the entire nav on every scroll
 * frame, which is exactly the jank the calm-reading surface cannot afford.
 */
interface ChromeValue {
  navHidden: SharedValue<number>;
}

const ChromeContext = createContext<ChromeValue | null>(null);

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const navHidden = useSharedValue(0);
  const value = useMemo(() => ({ navHidden }), [navHidden]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeValue {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error('useChrome must be used inside <ChromeProvider>');
  return ctx;
}
