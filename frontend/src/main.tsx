import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { NotificationsProvider } from './context/NotificationsContext.tsx'

/**
 * Defaults tuned for a metered mobile connection, not a desktop dashboard.
 *
 * There was no caching layer at all before this: every mount refetched, and two
 * components asking for the same endpoint made two requests. On a Nigerian 3G
 * connection each of those is a second of someone's data allowance.
 *
 * - staleTime 5m: navigating away and back re-renders from cache instead of
 *   re-fetching. Content here is editorial — a devotional does not change
 *   between two taps.
 * - gcTime 30m: keeps that cache alive across a whole session's navigation.
 * - refetchOnWindowFocus off: the default refetches every time the user switches
 *   back to the tab, which on a phone means every time they take a call.
 * - retry 1: one retry catches a dropped packet; the default of three turns a
 *   genuinely offline user into four failed requests and a long wait.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>
          <App />
        </NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
