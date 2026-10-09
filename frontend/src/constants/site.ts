import { EVENT_DETAILS } from './eventDetails';

/**
 * How to reach the people behind Faith Tribe. One place, so the privacy notice,
 * the terms and the help page cannot drift apart.
 *
 * The values come from EVENT_DETAILS because that is where the church's contact
 * details already live. Change them there.
 */
export const SITE_CONTACT = {
  organisation: 'RCCG Region 63 Junior Church',
  email: EVENT_DETAILS.contact.email,
  phone: EVENT_DETAILS.contact.phone,
  /** The phone number in a form a tel: link accepts. */
  phoneHref: `tel:${EVENT_DETAILS.contact.phone.replace(/\s+/g, '')}`,
} as const;

/** Shown on the privacy notice and the terms. Update it whenever either changes. */
export const LEGAL_UPDATED = '1 October 2026';

/**
 * Where a teen gets the app.
 *
 * The app is not in the stores yet. Android phones install a build directly;
 * iPhones use the web app, added to the Home Screen from Safari. Both can be
 * set from the environment, because the Android address changes with every
 * build and the site should not need a code change to follow it.
 */
export const APP_LINKS = {
  /** The Android build (an .apk file). */
  android:
    import.meta.env.VITE_ANDROID_APP_URL ||
    'https://expo.dev/artifacts/eas/RvtDEI4nOr0wnPO2ReL8psE2WpNepyDpEet1xRxqyvw.apk',
  /** The web app, for iPhones. */
  web: import.meta.env.VITE_WEB_APP_URL || 'https://app.thefaithtribe.live',
} as const;
