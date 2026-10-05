import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';

import { api, request } from '../api/client';
import { keys } from '../api/queries';
import { routeFor } from '../data/links';

/**
 * Push notifications on this phone.
 *
 * The server decides *whether* to interrupt (consent, quiet hours, the
 * one-announcement-a-day cap all live in `notifications/services.py`). This
 * file does the three things only the phone can do: ask the teen's permission,
 * tell the server how to reach this phone, and take them to the right screen
 * when they tap what arrives.
 *
 * Every notification is also a row in the inbox, so nothing here is the only
 * copy of a message. A phone that says no to push still sees everything in
 * the app.
 */

const TOKEN_KEY = 'faithtribe.pushToken';
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

if (SUPPORTED) {
  // With the app open, a notification still shows as a banner. Silently, and
  // without a badge: the bell on Today already carries the unread dot.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export type PushStatus =
  /** Allowed. Nothing to ask. */
  | 'granted'
  /** Never asked. One tap away. */
  | 'undetermined'
  /** Refused. Only the phone's own settings can change it now. */
  | 'denied'
  /** The web preview, or a simulator. */
  | 'unsupported';

async function readStatus(): Promise<PushStatus> {
  if (!SUPPORTED) return 'unsupported';
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) return 'granted';
    return permission.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/**
 * This phone's Expo push token, or null when it cannot have one.
 *
 * Null is common and not an error: a simulator has no push service, and Expo
 * Go on Android has had none since SDK 53. A real build needs the project's
 * EAS id, which `eas init` writes into app.json.
 */
async function readToken(): Promise<string | null> {
  if (!SUPPORTED || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    // Android delivers into a channel, and shows nothing until one exists.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders and news',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ?? Constants.easConfig?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Push is not set up on this build, so no reminders will arrive here. ' +
          (projectId ? '' : 'Run `eas init` to give the app a project id. ') +
          `(${(error as Error)?.message ?? error})`,
      );
    }
    return null;
  }
}

/** Tell the server how to reach this phone. Safe to call on every launch. */
async function register(): Promise<void> {
  const token = await readToken();
  if (!token) return;
  try {
    await api.post('/notifications/devices/', {
      token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? '',
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Offline, or the server is down. The next launch tries again.
  }
}

/**
 * Stop this account's notifications reaching this phone.
 *
 * Called while signing out, before the session is cleared, because the request
 * needs it. A phone handed to a sibling must not keep buzzing with the first
 * teen's reminders.
 */
export async function unregisterPushDevice(): Promise<void> {
  if (!SUPPORTED) return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await request('/notifications/devices/', { method: 'DELETE', body: { token } });
  } catch {
    // Best effort: registering under the next account moves the token anyway.
  }
}

/**
 * Whether this phone lets Faith Tribe notify, and how to change that.
 *
 * The app never asks at launch. A permission dialog before a teen has seen a
 * single reminder is a question they cannot answer; this hook backs a card on
 * the notification screens, where saying yes means something.
 */
export function usePushPermission(): {
  status: PushStatus | null;
  /** Ask (first time), or open the phone's settings (after a refusal). */
  turnOn: () => Promise<void>;
} {
  const [status, setStatus] = useState<PushStatus | null>(null);

  const refresh = useCallback(() => {
    readStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    // Coming back from the phone's settings is how a refusal gets undone.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const turnOn = useCallback(async () => {
    if (!SUPPORTED) return;
    const current = await readStatus();
    if (current === 'denied') {
      await Linking.openSettings().catch(() => {});
      return;
    }
    const answer = await Notifications.requestPermissionsAsync().catch(() => null);
    if (answer?.granted) await register();
    refresh();
  }, [refresh]);

  return { status, turnOn };
}

/**
 * Keeps push working for the signed-in teen. Mounted once, at the root.
 *
 * - Registers this phone whenever someone is signed in and has said yes.
 * - Refreshes the inbox and the unread dot when a notification arrives.
 * - Opens the right screen when one is tapped, including the tap that
 *   launched the app from cold.
 *
 * `userId` is passed in rather than read from the auth context because signing
 * out calls into this file, and the two must not import each other. `ready`
 * holds everything back until the navigator exists to be pushed onto.
 */
export function usePushSync(userId: string | undefined, ready: boolean): void {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (!SUPPORTED || !userId) return;
    readStatus().then((status) => {
      if (status === 'granted') register();
    });
  }, [userId]);

  useEffect(() => {
    if (!SUPPORTED || !ready) return;

    const refreshInbox = () => {
      qc.invalidateQueries({ queryKey: keys.notifications });
      qc.invalidateQueries({ queryKey: keys.unreadCount });
    };

    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as
        | { id?: string; url?: string }
        | undefined;
      if (!data) return;

      if (data.id) {
        // It has been seen; the dot should not survive the tap.
        api.post('/notifications/inbox/mark_read/', { ids: [data.id] }).catch(() => {});
      }
      refreshInbox();
      // A message with nowhere particular to go opens the inbox, so the tap
      // always lands on the words that were in the banner.
      router.push(routeFor(data.url) ?? '/notifications');
    };

    const received = Notifications.addNotificationReceivedListener(refreshInbox);
    const tapped = Notifications.addNotificationResponseReceivedListener(open);

    // The tap that started the app arrives before any listener exists.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          open(response);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      received.remove();
      tapped.remove();
    };
  }, [qc, router, ready]);
}
