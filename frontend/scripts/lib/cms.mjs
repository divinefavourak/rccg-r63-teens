/**
 * Reading the API during a build.
 *
 * The build fetches once, for three artefacts: the per-route HTML, the sitemap
 * and the feed. A backend that is down must not fail a deploy — the site still
 * works without these — so every failure here is a warning that narrows what
 * gets written rather than an exception that stops the build.
 */

const API = process.env.VITE_API_URL || 'https://api.thefaithtribe.live/api/v1';

const TIMEOUT_MS = 10_000;
const MAX_PAGES = 10;

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Every row an endpoint will give us, following DRF's `next` links.
 *
 * The cap exists so a pagination bug cannot turn a deploy into a thousand
 * requests; ten pages of 200 is more content than this site has.
 */
async function fetchAll(path, label) {
  const rows = [];
  let url = `${API}${path}`;

  for (let page = 0; page < MAX_PAGES && url; page += 1) {
    try {
      const data = await getJson(url);
      rows.push(...(Array.isArray(data) ? data : (data.results ?? [])));
      // A hard-sliced action returns an array and has no next page; a paginated
      // one carries `next`.
      url = Array.isArray(data) ? null : data.next;
    } catch (error) {
      // A backend that was down from the start leaves the site's static pages
      // intact, so an empty list is a safe fallback. A failure *between* pages
      // is different: publishing page 1 as if it were the whole archive would
      // silently drop content and take withdrawn pages' replacements with it.
      if (rows.length === 0) {
        console.warn(`  ${label} -> ${error.message}, skipping`);
        return [];
      }
      throw new Error(
        `${label} failed after ${rows.length} rows; refusing to publish a partial list (${error.message})`,
      );
    }
  }

  return rows;
}

/**
 * Devotionals and events, as the build needs them.
 *
 * `page_size` is asked for rather than relied on: the serialisers differ, and a
 * row without an `id` is dropped by each consumer anyway.
 */
export async function loadContent() {
  const [devotionals, events] = await Promise.all([
    fetchAll('/content/devotionals/?status=published&page_size=200', '/content/devotionals/'),
    fetchAll('/events/events/?status=published&page_size=200', '/events/events/'),
  ]);

  console.log(
    `  API ${API}: ${devotionals.length} devotionals, ${events.length} events`,
  );

  return { devotionals, events, api: API };
}

/** A date as the `YYYY-MM-DD` that sitemaps and feeds expect, or null. */
export function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Plain text from the small amount of HTML the API returns in descriptions. */
export function text(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
