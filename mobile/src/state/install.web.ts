import { useCallback, useEffect, useState } from 'react';

import type { InstallWay } from './install';

export type { InstallWay };

/**
 * Putting the web app on a Home Screen (`install.ts` is the app's empty version).
 *
 * On an iPhone this is the only way to have Faith Tribe without the App Store,
 * and it matters beyond the icon: Safari only lets a site send notifications
 * once it has been added to the Home Screen, and only keeps its saved data for
 * good once it has.
 */

/** Opened from the Home Screen, not in a browser tab. */
function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag, from before it supported the media query.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isApple(): boolean {
  // An iPad says it is a Mac; a Mac has no touch screen.
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Chrome's "this site can be installed" event. Not in the standard typings. */
interface InstallOffer extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chrome makes the offer once, soon after the page loads and long before any
// screen that could use it exists, so it is caught here and kept.
let offer: InstallOffer | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Stops Chrome's own banner; the app offers it in its own words instead.
    event.preventDefault();
    offer = event as InstallOffer;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    listeners.forEach((listener) => listener());
  });
}

function currentWay(): InstallWay {
  if (isInstalled()) return null;
  if (offer) return 'dialog';
  return isApple() ? 'share-menu' : null;
}

export function useInstall(): { way: InstallWay; install: () => Promise<void> } {
  const [way, setWay] = useState<InstallWay>(currentWay);

  useEffect(() => {
    const update = () => setWay(currentWay());
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = useCallback(async () => {
    if (!offer) return;
    await offer.prompt();
    // An offer can be used once, whatever the answer.
    offer = null;
    setWay(currentWay());
  }, []);

  return { way, install };
}

/**
 * Start the parts of the web app that run outside a page. Call once.
 *
 * The service worker (`public/sw.js`) is what opens the app with no signal and
 * what shows a notification. It is left out while developing: it keeps files,
 * and a kept file is the last thing wanted while those files are being edited.
 */
export function startWebApp(): void {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator && !__DEV__) {
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // The app works without it; it just needs a connection to open.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  // Ask the browser not to clear the saved Bible and cache when space is short.
  // It may say no; nothing depends on the answer.
  navigator.storage?.persist?.().catch(() => {});
}
