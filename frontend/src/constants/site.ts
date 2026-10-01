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
