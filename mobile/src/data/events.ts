import { API_URL } from '../api/config';
import type { EventListItem, EventRegistration } from '../api/types';

/** What every Tribe screen says about an event or a ticket, in one place. */

/** "₦2,000", or null when there is no amount to show. */
export function formatNaira(value: string | null | undefined): string | null {
  if (!value) return null;
  const amount = Number(value);
  if (Number.isNaN(amount) || amount === 0) return null;
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

/** "Free" or the price being charged today (early-bird included). */
export function priceLabel(event: EventListItem): string {
  if (event.is_free) return 'Free';
  return formatNaira(event.current_price ?? event.price) ?? 'Free';
}

export function startOf(event: EventListItem): Date {
  return new Date(event.start_datetime);
}

/**
 * Over, by its end where it has one: a camp that runs until Sunday is still
 * on come Saturday.
 */
export function isPast(event: EventListItem, now = Date.now()): boolean {
  return new Date(event.end_datetime ?? event.start_datetime).getTime() < now;
}

/** "Sat 12 Dec" */
export function dayLabel(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  return `${weekday} ${date.getDate()} ${month}`;
}

/** "10:00 am" */
export function timeLabel(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

/** "Sat 12 Dec · 10:00 am" */
export function whenLabel(event: EventListItem): string {
  const start = startOf(event);
  return `${dayLabel(start)} · ${timeLabel(start)}`;
}

/** The venue, the town, or "Online". Null when the organiser gave neither. */
export function whereLabel(event: EventListItem): string | null {
  const place = [event.venue, event.city].filter(Boolean).join(', ');
  if (place) return place;
  return event.is_virtual ? 'Online' : null;
}

/**
 * Registration is not being taken: not open yet, closed, or marked full.
 *
 * An event that has merely run out of places is left open here, because the
 * server may still take a name for the waiting list; if it will not, it says
 * so and the form shows that sentence.
 */
export function isClosed(event: EventListItem): boolean {
  return event.registration_status !== 'open';
}

/** Why, for the button that would otherwise say "Register". */
export function closedLabel(event: EventListItem): string {
  if (event.registration_status === 'not_open') return 'Registration opens soon';
  if (event.registration_status === 'full') return 'This event is full';
  return 'Registration has closed';
}

/** A registration that still stands (not cancelled). */
export function isLive(registration: EventRegistration): boolean {
  return registration.status !== 'cancelled' && registration.status !== 'no_show';
}

/**
 * The page a parent pays from, to send them. The server draws it, and it needs
 * no login and no app. The server says where it is (a short link on our own
 * site); a server too old to say is asked on the API's own address.
 */
export function payLink(registration: EventRegistration): string | null {
  if (registration.pay_link) return registration.pay_link;
  if (!registration.pay_token) return null;
  return `${API_URL}/payments/pay/${registration.pay_token}/`;
}

/** What the panel under an unpaid ticket says about the time left. */
export function payHint(registration: EventRegistration): string {
  if (registration.status === 'cancelled') {
    return 'Your place was released because it was not paid for in time. Pay now to get it back while there is room.';
  }
  if (registration.pay_by) {
    const by = new Date(registration.pay_by);
    return `Pay by ${dayLabel(by)}, ${timeLabel(by)} to keep your place.`;
  }
  return 'Your place is confirmed once this is paid.';
}

/**
 * Where a ticket stands, in the words printed on it.
 *
 * `settled` is false while something is still owed or undecided, which is
 * what picks the calm colour over the green one. Nothing here is red: a place
 * waiting on payment is not an error.
 */
export function ticketStatus(registration: EventRegistration): { label: string; settled: boolean } {
  const paid = registration.payment_status === 'paid';
  const free = registration.payment_status === 'not_required';

  switch (registration.status) {
    case 'cancelled':
      // Given up for not being paid, and still payable: not the same as a
      // place someone cancelled.
      return { label: registration.can_pay ? 'Place released' : 'Cancelled', settled: false };
    case 'waitlisted':
      return { label: 'On the waiting list', settled: false };
    case 'checked_in':
    case 'attended':
      return { label: 'Checked in', settled: true };
    case 'confirmed':
      return { label: paid ? 'Confirmed and paid' : 'Confirmed', settled: true };
    default:
      if (!paid && !free) return { label: 'Waiting for payment', settled: false };
      return { label: 'Waiting to be confirmed', settled: false };
  }
}
