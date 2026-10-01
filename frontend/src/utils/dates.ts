/**
 * Calendar-day helpers — the client-side counterpart to `backend/common/dates.py`.
 *
 * The bug these exist to prevent:
 *
 *   new Date(2026, 8, 3).toISOString().slice(0, 10)  // "2026-09-02" in Lagos
 *
 * `new Date(y, m, d)` builds **local midnight**. `toISOString()` converts to
 * UTC. For any timezone ahead of UTC — Africa/Lagos is UTC+1 — local midnight is
 * still the previous day in UTC, so truncating the ISO string silently returns
 * yesterday. In the Console's content calendar that shifted every cell one day
 * earlier than its label, so the devotional written for the 3rd appeared under
 * the 4th.
 *
 * The backend already refuses to make this mistake (`common/dates.py`: "the kind
 * of bug that passes every test run in the office and then fires once a night in
 * production"). These are the same rules for the browser.
 *
 * Rule of thumb: a devotional's `date` is a *calendar day*, not an instant.
 * Never round-trip one through UTC.
 */

/** `YYYY-MM-DD` for a Date, read in the local calendar — never via UTC. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today as `YYYY-MM-DD` in the viewer's own calendar. */
export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Parse a `YYYY-MM-DD` API value into local noon.
 *
 * `new Date("2026-09-03")` is specified to parse as **UTC** midnight, so
 * rendering it with `toLocaleDateString` shows the previous day for anyone
 * behind UTC. Anchoring at local noon puts the instant far enough from both
 * midnights that no timezone or DST shift can move the date.
 *
 * Values that already carry a time (`...T09:00:00Z`) are real instants and are
 * passed through untouched.
 */
export function parseAPIDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Format an API date for display. Returns '' rather than "Invalid Date". */
export function formatAPIDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
  locale?: string,
): string {
  const d = parseAPIDate(value);
  return d ? d.toLocaleDateString(locale, options) : '';
}
