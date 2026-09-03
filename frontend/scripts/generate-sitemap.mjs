/**
 * Writes dist/sitemap.xml after the build.
 *
 * Static public routes always ship. Event and devotional detail URLs are pulled
 * from the live API when one is reachable, and skipped when it is not — a build
 * must not fail because the backend was down, and a sitemap listing only the
 * static routes is still correct, just less complete.
 *
 * Run as part of `npm run build`. Regenerating on every deploy is deliberate:
 * a sitemap that lists yesterday's events is worse than one that lists fewer.
 */
import { writeFile } from 'node:fs/promises';

const SITE = process.env.SITE_URL || 'https://thefaithtribe.live';
const API = process.env.VITE_API_URL || 'https://rccg-r63-teens-backend.onrender.com/api/v1';
const OUT = 'dist/sitemap.xml';

/**
 * changefreq/priority are hints, not instructions — Google has said for years it
 * largely ignores them. lastmod is the one field that still carries weight, so
 * it is set from real data wherever real data exists.
 */
const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/devotionals', priority: '0.9', changefreq: 'daily' },
  { path: '/events', priority: '0.9', changefreq: 'daily' },
  { path: '/manuals', priority: '0.7', changefreq: 'weekly' },
  { path: '/media', priority: '0.7', changefreq: 'weekly' },
  { path: '/get-ticket', priority: '0.6', changefreq: 'monthly' },
];

/** Escape the five XML entities. Titles are not in the sitemap, but URLs can
 *  carry & in a query string and one unescaped ampersand invalidates the file. */
const xml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const isoDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

async function fetchList(path) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`  ${path} -> HTTP ${res.status}, skipping`);
      return [];
    }
    const data = await res.json();
    // Paginated endpoints return {results}, hard-sliced actions return an array.
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch (e) {
    console.warn(`  ${path} -> unreachable (${e.message}), skipping`);
    return [];
  }
}

function urlEntry({ path, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${xml(SITE + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = STATIC_ROUTES.map((r) => urlEntry({ ...r, lastmod: today }));

  console.log(`Sitemap for ${SITE} (API: ${API})`);

  const events = await fetchList('/events/events/?status=published&page_size=200');
  for (const e of events) {
    if (!e?.id) continue;
    entries.push(
      urlEntry({
        path: `/events/${e.id}`,
        lastmod: isoDate(e.updated_at || e.created_at),
        changefreq: 'weekly',
        priority: '0.8',
      })
    );
  }

  const devotionals = await fetchList('/content/devotionals/?status=published&page_size=200');
  for (const d of devotionals) {
    if (!d?.id) continue;
    entries.push(
      urlEntry({
        path: `/devotionals/${d.id}`,
        // A devotional's own date is a truer lastmod than its row timestamps.
        lastmod: isoDate(d.date || d.updated_at),
        changefreq: 'monthly',
        priority: '0.7',
      })
    );
  }

  const doc =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>\n';

  await writeFile(OUT, doc, 'utf8');
  console.log(
    `${OUT}: ${entries.length} URLs ` +
      `(${STATIC_ROUTES.length} static, ${events.length} events, ${devotionals.length} devotionals)`
  );
}

run().catch((e) => {
  // Never fail the build over a sitemap.
  console.error('Sitemap generation failed:', e.message);
  process.exit(0);
});
