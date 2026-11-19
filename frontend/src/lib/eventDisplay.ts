/**
 * How an event's price, dates and places read on the website.
 *
 * The list and detail pages used to format these separately, and both got it
 * wrong in the same two ways:
 *
 *   - The price came from `price`, the base, so an event with an early-bird or
 *     tier price showed the wrong figure. `seo/site.mjs` already knew to prefer
 *     `current_price`; these call the same functions, so the page, the meta
 *     description and the Event structured data quote one number.
 *   - Times were read in the visitor's own timezone. An event is held in Lagos;
 *     a parent abroad registering a child saw the wrong start time.
 */
import { eventIsFree, eventPrice } from '../../seo/site.mjs';
import type { Event } from '../types';

const LAGOS = 'Africa/Lagos';

/** "Free", "₦7,000", or null when the event names no price at all. */
export function eventPriceLabel(event: Event): string | null {
  const record = event as unknown as Record<string, unknown>;
  if (eventIsFree(record)) return 'Free';
  const price = eventPrice(record);
  return price === null ? null : `₦${price.toLocaleString('en-NG')}`;
}

/** "Mon 21 Dec 2026" (short) or "Monday 21 December 2026" (long), in Lagos time. */
export function eventDay(value: string | undefined | null, style: 'short' | 'long' = 'short'): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS,
    weekday: style,
    day: 'numeric',
    month: style,
    year: 'numeric',
  }).format(date);
}

/** `{ day: '21', month: 'Dec' }` in Lagos time, for a date badge. */
export function eventDayParts(value: string | undefined | null): { day: string; month: string } {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { day: '', month: '' };
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: LAGOS, day: 'numeric', month: 'short' }).formatToParts(date);
  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '',
    month: parts.find((part) => part.type === 'month')?.value ?? '',
  };
}

/** "1:00 pm", in Lagos time. */
export function eventTime(value: string | undefined | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: LAGOS, hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}

/** "Glory Arena, Redemption City", or "" when neither is set. */
export const eventPlace = (event: Event) => [event.venue, event.city].filter(Boolean).join(', ');

/**
 * Places left, or null when the event has no cap.
 *
 * The API sends `spots_remaining: null` for an uncapped event. The old checks
 * tested `!== undefined`, so null got through and the page printed "null spots
 * left" under the Register button.
 */
export function spotsLeft(event: Event): number | null {
  const left = (event as { spots_remaining?: number | null }).spots_remaining;
  return typeof left === 'number' && Number.isFinite(left) ? left : null;
}

/** Still to come, by its end time, so an event in progress counts as upcoming. */
export const isUpcoming = (event: Event, now = Date.now()) =>
  new Date(event.end_datetime || event.start_datetime).getTime() >= now;
