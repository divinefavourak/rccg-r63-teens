import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { api, request } from '../api/client';
import { keys } from '../api/queries';
import { routeFor } from '../data/links';

/**
 * `push.ts` for the browser: the same three exports, over Web Push.
 *
 * The app registers a phone with Expo's push service. A browser instead gives
 * the site an address at its own maker's push service (Apple's, for Safari),
 * and the server posts to that address (`notifications/push.py`,
 * `WebPushBackend`). The policy is the same either way and lives on the
 * server; this file only asks permission, hands over the address, and opens
 * the right screen on a tap.
 *
 * On an iPhone none of this exists until the site has been added to the Home
 * Screen: in a Safari tab there is no `PushManager` at all, so the status is
 * `unsupported` and nothing is offered. `components/InstallHint.tsx` is what
 * tells a teen how to get there.
 */

/**
 * The public half of the server's VAPID key pair. The browser ties a
 * subscription to it, and only the holder of the private half can send to it.
 */
const SERVER_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** Which account this browser was last registered to, and when. */
const REGISTERED_KEY = 'faithtribe.webPushRegistered';
const REREGISTER_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type PushStatus = 'granted' | 'undetermined' | 'denied' | 'unsupported';

function supported(): boolean {
  return (
    !!SERVER_KEY &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function readStatus(): PushStatus {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.permission === 'denied' ? 'denied' : 'undetermined';
}

/** The key as the bytes `subscribe` wants; it is handed around as URL-safe base64. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** This browser's push address. `create` makes one if there is none yet. */
async function subscription(create: boolean): Promise<PushSubscription | null> {
  // Not `serviceWorker.ready`: with no worker registered that never answers.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  const existing = await registration.pushManager.getSubscription();
  if (existing || !create) return existing;
  return registration.pushManager.subscribe({
    // Required: every push will show a notification (`public/sw.js` does).
    userVisibleOnly: true,
    applicationServerKey: keyBytes(SERVER_KEY),
  });
}

let signedIn: string | undefined;

/** Tell the server how to reach this browser, when something has changed. */
async function register(userId: string): Promise<void> {
  try {
    const current = await subscription(true);
    const address = current?.toJSON();
    if (!address?.endpoint || !address.keys?.p256dh || !address.keys.auth) return;

    const mark = `${userId}|${address.endpoint}`;
    const last = localStorage.getItem(REGISTERED_KEY);
    if (last) {
      const at = Number(last.slice(last.lastIndexOf('@') + 1));
      const savedMark = last.slice(0, last.lastIndexOf('@'));
      if (savedMark === mark && Date.now() - at < REREGISTER_AFTER_MS) return;
    }

    await api.post('/notifications/push/', {
      endpoint: address.endpoint,
      p256dh: address.keys.p256dh,
      auth: address.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    });
    localStorage.setItem(REGISTERED_KEY, `${mark}@${Date.now()}`);
  } catch {
    // Offline, or the server is down. The next visit tries again.
  }
}

/** Stop this account's notifications reaching this browser. Called while signing out. */
export async function unregisterPushDevice(): Promise<void> {
  if (!supported()) return;
  try {
    localStorage.removeItem(REGISTERED_KEY);
    const current = await subscription(false);
    if (!current) return;
    await request('/notifications/push/', {
      method: 'DELETE',
      body: { endpoint: current.endpoint },
    });
  } catch {
    // Best effort: registering under the next account moves the address anyway.
  }
}

export function usePushPermission(): {
  status: PushStatus | null;
  /** Ask. After a refusal only the browser's own settings can change it. */
  turnOn: () => Promise<void>;
} {
  const [status, setStatus] = useState<PushStatus | null>(null);

  const refresh = useCallback(() => setStatus(readStatus()), []);

  useEffect(() => {
    refresh();
    // Coming back from the phone's settings is how a refusal gets undone.
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [refresh]);

  const turnOn = useCallback(async () => {
    if (readStatus() !== 'undetermined') return;
    // Nothing may be awaited before this line. Safari only shows the dialog
    // while it still counts as part of the tap that asked for it.
    const answer = await Notification.requestPermission().catch(() => 'default' as const);
    if (answer === 'granted' && signedIn) await register(signedIn);
    refresh();
  }, [refresh]);

  return { status, turnOn };
}

/**
 * Keeps push working for the signed-in teen. Mounted once, at the root.
 *
 * The service worker shows the notification; this is the page's half. It hears
 * from the worker when one arrives (refresh the inbox) and when one is tapped
 * (go to its screen), and picks up the tap that opened the app from closed,
 * which the worker passes in the address as `?open=`.
 */
export function usePushSync(userId: string | undefined, ready: boolean): void {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    signedIn = userId;
    if (userId && readStatus() === 'granted') register(userId);
  }, [userId]);

  useEffect(() => {
    if (!ready || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const refreshInbox = () => {
      qc.invalidateQueries({ queryKey: keys.notifications });
      qc.invalidateQueries({ queryKey: keys.unreadCount });
      qc.invalidateQueries({ queryKey: keys.myRegistrations });
    };

    const open = (url: string | null, id: string | null, replace: boolean) => {
      if (id) api.post('/notifications/inbox/mark_read/', { ids: [id] }).catch(() => {});
      refreshInbox();
      const target = routeFor(url) ?? '/notifications';
      if (replace) router.replace(target);
      else router.push(target);
    };

    const onMessage = (event: MessageEvent) => {
      const message = event.data as { type?: string; url?: string; id?: string } | null;
      if (message?.type === 'push') refreshInbox();
      if (message?.type === 'open') open(message.url ?? null, message.id ?? null, false);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    // The tap that started the app. Replaced, not pushed, so Back does not
    // return to an address that would open the same screen again.
    const query = new URLSearchParams(window.location.search);
    if (query.has('open')) open(query.get('open'), query.get('n'), true);

    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [qc, router, ready]);
}
