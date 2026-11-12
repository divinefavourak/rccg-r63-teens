import { SITE } from '../../seo/site.mjs';

/**
 * How to reach the people behind Faith Tribe. One place, so the privacy notice,
 * the terms, the help page, robots and the structured data cannot drift apart.
 *
 * The values live in `seo/site.mjs` because the build scripts need the same
 * email and telephone in the JSON-LD they write, and a second copy in the app
 * is a copy that eventually disagrees.
 */
export const SITE_CONTACT = {
  organisation: SITE.legalName,
  email: SITE.contact.email,
  phone: SITE.contact.phone,
  /** The phone number in a form a tel: link accepts. */
  phoneHref: SITE.contact.phoneHref,
};

/** Shown on the privacy notice and the terms. Update it whenever either changes. */
export const LEGAL_UPDATED = '1 October 2026';

/**
 * Where a teen gets the app.
 *
 * The app is not in the stores yet. Android phones install a build directly;
 * iPhones use the web app, added to the Home Screen from Safari. Both can be
 * set from the environment.
 *
 * The Android address no longer changes with each build. It is the one file
 * in the R2 bucket that always holds the current build; releasing a new one
 * (`mobile/scripts/release.mjs promote`) replaces what is behind it, and this
 * link follows without the site being touched.
 */
export const APP_LINKS = {
  /** The Android build (an .apk file). */
  android:
    import.meta.env.VITE_ANDROID_APP_URL ||
    'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/apps/android/faith-tribe-latest.apk',
  /** The web app, for iPhones. */
  web: import.meta.env.VITE_WEB_APP_URL || SITE.webApp,
};
