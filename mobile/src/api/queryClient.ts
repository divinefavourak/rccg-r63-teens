import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';

import { retryTransient } from './queries';

/**
 * The shared cache.
 *
 * Defaults are tuned for intermittent mobile data rather than a desktop
 * browser: 15-technical-architecture.md sets performance budgets against
 * Nigerian networks, so nothing refetches on a whim.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: retryTransient,
      // Exponential, capped — a phone on one bar should back off, not hammer.
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
      // React Query's web default refetches whenever a window regains focus.
      // On a handset that fires every time the app is foregrounded, which for a
      // habit app is many times a day for content that changes once.
      refetchOnWindowFocus: false,
      // Serving the cached screen instantly and revalidating behind it is the
      // right trade on a slow connection.
      refetchOnReconnect: true,
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Teach React Query how "focus" and "online" work outside a browser.
 *
 * Both managers default to DOM APIs that do not exist here. Without these the
 * library believes the app is permanently focused and permanently online, so a
 * query that failed while the phone was in a lift never retries when signal
 * returns.
 */
export function installAppStateBridges(): () => void {
  const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });

  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => subscription.remove();
  });

  return () => sub.remove();
}
