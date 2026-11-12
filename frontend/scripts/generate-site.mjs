/**
 * Writes the half of the site a crawler can read.
 *
 * A Vite build produces one `index.html` and a bundle. Without this script every
 * URL — `/events`, `/devotionals/<id>`, `/help` — is answered with that one file,
 * carrying the home page's title, description and canonical. That is what the
 * site shipped until now: tens of URLs, one canonical, all of them claiming to
 * be `/`. A search engine resolves that by picking one URL and dropping the
 * rest.
 *
 * This script fixes it at the source. After `vite build` it writes:
 *
 *   dist/<path>/index.html   one per route, with its own head and JSON-LD
 *   dist/feed.xml            the devotionals as RSS
 *   dist/sitemap.xml         every indexable URL, with real last-modified dates
 *   dist/app.html            the neutral shell the SPA fallback serves
 *
 * The head of each file comes from `seo/site.mjs` and `seo/schema.mjs` — the
 * same modules the React app imports — so the static document and the rendered
 * one cannot disagree.
 *
 * Vercel serves a real file before it applies a rewrite, so these files win over
 * the catch-all without any change to the routing for real pages. The catch-all
 * stays for everything that has no file: the Console, the dashboard, and any
 * event created after this deploy.
 *
 * Run as part of `npm run build`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ROBOTS_NOINDEX,
  SITE,
  STATIC_ROUTES,
  absoluteUrl,
  devotionalDescription,
  devotionalTitle,
  eventDescription,
  headToHtml,
  metaFor,
} from '../seo/site.mjs';
import {
  articleLd,
  breadcrumbLd,
  eventLd,
  faqLd,
  itemListLd,
  organizationLd,
  webPageLd,
  websiteLd,
} from '../seo/schema.mjs';
import { FAQ_QUESTIONS } from '../content/faq.mjs';
import { escapeHtml, escapeXml, isoDate, loadContent, text } from './lib/cms.mjs';

const DIST = 'dist';
const BASE = join(DIST, 'index.html');
/**
 * A pristine copy of the built shell.
 *
 * The first run reads `dist/index.html` and replaces the `seo:start` region in
 * the file it writes back. A second run on the same `dist/` would therefore
 * find no region. Keeping the untouched shell outside `dist/` makes `npm run
 * seo` idempotent without shipping a second HTML file to Vercel.
 */
const SHELL = '.seo-shell.html';

/** The regions of the template this script replaces. */
const HEAD_REGION = /<!--\s*seo:start\s*-->[\s\S]*?<!--\s*seo:end\s*-->/;
const NOSCRIPT_REGION = /<!--\s*seo:noscript:start\s*-->[\s\S]*?<!--\s*seo:noscript:end\s*-->/;

/* -------------------------------------------------------------------- pages */

/** The site-wide nodes every page carries, plus whatever the page adds. */
function pageGraph(meta, extra = []) {
  return [
    organizationLd(),
    websiteLd(),
    webPageLd({
      url: meta.url,
      title: meta.title,
      description: meta.description,
      image: meta.image.url,
      dateModified: meta.lastModified,
    }),
    ...extra,
  ].filter(Boolean);
}

/** The visible-to-nobody-but-a-crawler content of a page. */
function noscriptBlock({ heading, intro, items = [], paragraphs = [] }) {
  const list = items.length
    ? `<ul>\n${items
        .map((item) => `      <li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>${item.note ? ` — ${escapeHtml(item.note)}` : ''}</li>`)
        .join('\n')}\n    </ul>`
    : '';

  const body = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n    ');

  return [
    '    <div>',
    `      <h1>${escapeHtml(heading)}</h1>`,
    intro ? `      <p>${escapeHtml(intro)}</p>` : null,
    body || null,
    list || null,
    '    </div>',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * One finished HTML document.
 *
 * `replace` is given a function so a `$` in a title or a JSON-LD body is not
 * read as a replacement pattern.
 */
function renderPage(shell, meta, noscript) {
  return shell
    .replace(HEAD_REGION, () => headToHtml(meta))
    .replace(NOSCRIPT_REGION, () => noscript);
}

async function writePage(routePath, html) {
  const target = routePath === '/' ? BASE : join(DIST, routePath.replace(/^\//, ''), 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

/* ------------------------------------------------------------------- static */

/** A short name for a breadcrumb, from the page's own title. */
const crumbName = (route) => route.title.split(' — ')[0];

/** The links every no-JavaScript reader should still be able to follow. */
const PRIMARY_LINKS = [
  { href: '/devotionals', label: 'Today’s devotional' },
  { href: '/events', label: 'Events and camps' },
  { href: '/manuals', label: 'Bible study manuals' },
  { href: '/media', label: 'Podcasts and videos' },
  { href: '/help', label: 'Help' },
];

function staticNoscript(route, content) {
  const heading = crumbName(route);

  if (route.path === '/help') {
    return noscriptBlock({
      heading,
      intro: route.description,
      paragraphs: FAQ_QUESTIONS.map((question) => `${question.q} ${question.a}`),
      items: PRIMARY_LINKS,
    });
  }

  if (route.path === '/devotionals') {
    return noscriptBlock({
      heading,
      intro: route.description,
      items: content.devotionals.slice(0, 25).map((item) => ({
        href: `/devotionals/${item.id}`,
        label: item.title,
        note: item.date ? new Date(item.date).toDateString() : undefined,
      })),
    });
  }

  if (route.path === '/events') {
    return noscriptBlock({
      heading,
      intro: route.description,
      items: content.events.slice(0, 25).map((item) => ({
        href: `/events/${item.id}`,
        label: item.title,
        note: [item.start_datetime ? new Date(item.start_datetime).toDateString() : null, item.venue]
          .filter(Boolean)
          .join(', '),
      })),
    });
  }

  if (route.path === '/') {
    return noscriptBlock({
      heading: `${SITE.name} — ${SITE.legalName}`,
      intro: SITE.description,
      items: PRIMARY_LINKS,
    });
  }

  return noscriptBlock({
    heading,
    intro: route.description,
    items: PRIMARY_LINKS.filter((link) => link.href !== route.path),
  });
}

async function writeStaticPages(shell, content) {
  let written = 0;

  for (const route of STATIC_ROUTES) {
    const extra = [];

    if (route.path !== '/') {
      extra.push(
        breadcrumbLd({
          url: route.path,
          trail: [
            { name: 'Home', path: '/' },
            { name: crumbName(route), path: route.path },
          ],
        }),
      );
    }

    if (route.path === '/help') {
      // The strongest statement on the site of what this product is and who it
      // is for. Answer engines read it without having to run the app.
      extra.push(faqLd({ url: '/help', questions: FAQ_QUESTIONS }));
    }

    if (route.path === '/devotionals') {
      extra.push(
        itemListLd({
          url: '/devotionals',
          name: 'Teenage Open Heavens — daily devotionals',
          itemType: 'Article',
          items: content.devotionals.slice(0, 20).map((item) => ({
            url: `/devotionals/${item.id}`,
            name: item.title,
            datePublished: isoDate(item.date) || undefined,
            image: item.cover_image || undefined,
          })),
        }),
      );
    }

    if (route.path === '/events') {
      extra.push(
        itemListLd({
          url: '/events',
          name: 'Camps, retreats and events for RCCG Region 63 teenagers',
          itemType: 'Event',
          items: content.events.slice(0, 20).map((item) => ({
            url: `/events/${item.id}`,
            name: item.title,
            startDate: item.start_datetime,
            image: item.cover_image || undefined,
          })),
        }),
      );
    }

    const meta = metaFor({ path: route.path, index: route.index !== false });
    await writePage(route.path, renderPage(shell, { ...meta, jsonLd: pageGraph(meta, extra) }, staticNoscript(route, content)));
    written += 1;
  }

  return written;
}

/* ------------------------------------------------------------------ dynamic */

async function writeDynamicPages(shell, content) {
  const counts = { devotionals: 0, events: 0 };

  for (const devotional of content.devotionals) {
    if (!devotional?.id) continue;

    const path = `/devotionals/${devotional.id}`;
    const description = devotionalDescription(devotional);

    const meta = metaFor({
      path,
      title: devotionalTitle(devotional),
      description,
      image: devotional.cover_image || undefined,
      type: 'article',
      lastModified: isoDate(devotional.date || devotional.updated_at) || undefined,
    });

    const extra = [
      articleLd({
        url: path,
        title: devotional.title,
        description,
        datePublished: devotional.date,
        dateModified: devotional.updated_at,
        image: devotional.cover_image || undefined,
        author: devotional.author,
      }),
      breadcrumbLd({
        url: path,
        trail: [
          { name: 'Home', path: '/' },
          { name: 'Teenage Open Heavens', path: '/devotionals' },
          { name: devotional.title, path },
        ],
      }),
    ];

    const noscript = noscriptBlock({
      heading: devotional.title,
      intro: description,
      paragraphs: [
        devotional.date ? `Devotional for ${new Date(devotional.date).toDateString()}.` : '',
        devotional.memory_verse_passage
          ? `Memory verse: ${devotional.memory_verse_passage} — ${text(devotional.memory_verse_content)}`
          : '',
      ].filter(Boolean),
      items: [{ href: '/devotionals', label: 'All devotionals' }],
    });

    await writePage(path, renderPage(shell, { ...meta, jsonLd: pageGraph(meta, extra) }, noscript));
    counts.devotionals += 1;
  }

  for (const event of content.events) {
    if (!event?.id) continue;

    const path = `/events/${event.id}`;
    const description = eventDescription(event);

    const meta = metaFor({
      path,
      title: event.title,
      description,
      image: event.cover_image || undefined,
      type: 'article',
      lastModified: isoDate(event.updated_at || event.start_datetime) || undefined,
    });

    const extra = [
      eventLd(event, path),
      breadcrumbLd({
        url: path,
        trail: [
          { name: 'Home', path: '/' },
          { name: 'Events', path: '/events' },
          { name: event.title, path },
        ],
      }),
    ];

    const noscript = noscriptBlock({
      heading: event.title,
      intro: description,
      paragraphs: [
        event.start_datetime
          ? `Starts ${new Date(event.start_datetime).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}.`
          : '',
        event.venue ? `Venue: ${event.venue}${event.city ? `, ${event.city}` : ''}.` : '',
        event.is_free || Number(event.price) === 0
          ? 'Admission is free.'
          : `Admission: ₦${Number(event.current_price ?? event.price ?? 0).toLocaleString('en-NG')}.`,
      ].filter(Boolean),
      items: [{ href: '/events', label: 'All events' }],
    });

    await writePage(path, renderPage(shell, { ...meta, jsonLd: pageGraph(meta, extra) }, noscript));
    counts.events += 1;
  }

  return counts;
}

/* ------------------------------------------------------------------- sitemap */

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

async function writeSitemap(content) {
  // A `lastmod` is a claim about when the content last changed, and a wrong
  // one teaches a crawler to ignore the field. Derive it from the content the
  // page lists: the newest devotional updates the home page and the archive;
  // the most recently edited event updates the events page. Pages with no
  // dated content get no `lastmod` at all rather than "today".
  const latestOf = (rows, field) =>
    rows
      .map((row) => isoDate(row?.[field]))
      .filter(Boolean)
      .sort()
      .pop();

  const latestDevotional = latestOf(content.devotionals, 'date')
    || latestOf(content.devotionals, 'updated_at');
  const latestEvent = latestOf(content.events, 'updated_at')
    || latestOf(content.events, 'start_datetime');

  const lastModifiedFor = (path) => {
    if (path === '/' || path === '/devotionals') return latestDevotional;
    if (path === '/events') return latestEvent;
    return undefined;
  };

  const entries = [];

  for (const route of STATIC_ROUTES) {
    if (route.index === false) continue;
    entries.push(
      urlEntry({
        loc: absoluteUrl(route.path),
        lastmod: lastModifiedFor(route.path),
        changefreq: route.changeFrequency,
        priority: route.priority?.toFixed(1),
      }),
    );
  }

  for (const devotional of content.devotionals) {
    if (!devotional?.id) continue;
    entries.push(
      urlEntry({
        loc: absoluteUrl(`/devotionals/${devotional.id}`),
        lastmod: isoDate(devotional.date || devotional.updated_at),
        changefreq: 'monthly',
        priority: '0.7',
      }),
    );
  }

  for (const event of content.events) {
    if (!event?.id) continue;
    entries.push(
      urlEntry({
        loc: absoluteUrl(`/events/${event.id}`),
        lastmod: isoDate(event.updated_at || event.start_datetime),
        changefreq: 'weekly',
        priority: '0.8',
      }),
    );
  }

  const doc =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>\n';

  await writeFile(join(DIST, 'sitemap.xml'), doc, 'utf8');
  return entries.length;
}

/* ---------------------------------------------------------------------- feed */

/**
 * The devotionals as RSS.
 *
 * Not a ranking device. It is how a feed reader, a church newsletter tool or an
 * aggregator finds today's reading without being told, and it costs one file.
 */
async function writeFeed(content) {
  const latest = [...content.devotionals]
    .filter((item) => item?.id && item.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 30);

  const items = latest
    .map((item) => {
      const link = absoluteUrl(`/devotionals/${item.id}`);
      const published = new Date(`${item.date}T06:00:00+01:00`).toUTCString();
      const summary =
        item.memory_verse_passage
          ? `${item.memory_verse_passage}: ${text(item.memory_verse_content)}`
          : text(item.title);

      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${published}</pubDate>`,
        `      <description>${escapeXml(summary)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const doc =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '  <channel>\n' +
    `    <title>${escapeXml(`${SITE.name} — Teenage Open Heavens`)}</title>\n` +
    `    <link>${escapeXml(absoluteUrl('/devotionals'))}</link>\n` +
    `    <description>${escapeXml('The daily Teenage Open Heavens devotional for teenagers, from RCCG Region 63 Junior Church.')}</description>\n` +
    `    <language>${SITE.language}</language>\n` +
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
    `    <atom:link href="${escapeXml(absoluteUrl(SITE.feedPath))}" rel="self" type="application/rss+xml" />\n` +
    `${items}\n` +
    '  </channel>\n' +
    '</rss>\n';

  await writeFile(join(DIST, SITE.feedPath.replace(/^\//, '')), doc, 'utf8');
  return latest.length;
}

/* ---------------------------------------------------------------- SPA shell */

/**
 * The document the catch-all rewrite serves.
 *
 * No canonical, because the URL is only known in the browser. Everything else
 * (assets, icons, fonts) is identical to the home page, so the app boots the
 * same way from any path.
 */
async function writeAppShell(shell) {
  const home = metaFor({ path: '/' });
  const neutral = {
    ...home,
    title: `${SITE.name} — the teen app of ${SITE.legalName}`,
    // No canonical: the URL is only known in the browser.
    url: null,
    // Noindex on purpose. This file is served for every path without one:
    // a newly created event (which gets a real file on the next build), the
    // signed-in Console (already disallowed in robots.txt), and every made-up
    // URL. Marking the first of those noindex for a few hours is a small cost;
    // letting every made-up URL return an indexable 200 is a soft 404 for the
    // whole domain.
    robots: ROBOTS_NOINDEX,
    // No WebPage node either. A WebPage with no URL is a WebPage about nothing.
    jsonLd: [organizationLd(), websiteLd()],
  };

  const html = renderPage(shell, neutral, noscriptBlock({ heading: SITE.name, intro: SITE.description, items: PRIMARY_LINKS }));
  await writeFile(join(DIST, 'app.html'), html, 'utf8');
}

/* ---------------------------------------------------------------- llms.txt */

/**
 * A plain-text map of the site for answer engines.
 *
 * The convention (llmstxt.org) is young and no engine promises to read it. It
 * costs one file and it states, in the format those crawlers already prefer,
 * what this site is, which pages matter, and what the newest readings are — all
 * from the same data the sitemap and the feed use.
 */
async function writeLlmsTxt(content) {
  const latest = [...content.devotionals]
    .filter((item) => item?.id && item.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 15);

  const doc = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    `${SITE.name} is the app and website of ${SITE.legalName}, part of ${SITE.parent.name}. It publishes the daily Teenage Open Heavens devotional for teenagers, the weekly Junior Church teaching manual, worship media, and the region's event registration. Reading and the Bible are free; some events have a ticket price.`,
    '',
    '## Pages',
    ...STATIC_ROUTES.filter((route) => route.index !== false).map(
      (route) => `- [${route.title.split(' — ')[0]}](${absoluteUrl(route.path)}): ${route.description}`,
    ),
    '',
    '## Latest devotionals',
    ...latest.map(
      (item) => `- [${item.title}](${absoluteUrl(`/devotionals/${item.id}`)}): ${isoDate(item.date)}`,
    ),
    '',
    '## More',
    `- [Sitemap](${absoluteUrl('/sitemap.xml')})`,
    `- [Feed](${absoluteUrl(SITE.feedPath)})`,
    `- [Help and FAQ](${absoluteUrl('/help')})`,
    '',
    '## Contact',
    `- Email: ${SITE.contact.email}`,
    `- Telephone: ${SITE.contact.phone}`,
    '',
  ].join('\n');

  await writeFile(join(DIST, 'llms.txt'), doc, 'utf8');
  return latest.length;
}

/* ---------------------------------------------------------------------- main */

async function run() {
  let shell;
  try {
    shell = await readFile(BASE, 'utf8');
  } catch {
    console.error(`${BASE} is missing. Run this after \`vite build\`.`);
    process.exit(1);
  }

  // A generated page has already had the region replaced. Use the pristine
  // copy saved by the run that did it, so `npm run seo` can be re-run.
  if (!HEAD_REGION.test(shell)) {
    try {
      shell = await readFile(SHELL, 'utf8');
    } catch {
      // Fall through to the same clear error as before.
    }
  }

  if (!HEAD_REGION.test(shell)) {
    console.error('The `<!--seo:start-->` region is missing from index.html. Refusing to write pages with no head.');
    process.exit(1);
  }

  await writeFile(SHELL, shell, 'utf8');

  console.log(`Writing crawlable pages for ${SITE.origin}`);
  const content = await loadContent();

  const staticCount = await writeStaticPages(shell, content);
  const dynamicCounts = await writeDynamicPages(shell, content);
  await writeAppShell(shell);
  const urls = await writeSitemap(content);
  const feedItems = await writeFeed(content);
  // `writeLlmsTxt` was defined but never called, so the file every head links
  // to as an answer-engine map was missing from `dist/`. Call it here, next to
  // the sitemap and feed it shares data with.
  const llmsItems = await writeLlmsTxt(content);

  console.log(
    `  ${staticCount} static pages, ${dynamicCounts.devotionals} devotionals, ${dynamicCounts.events} events\n` +
      `  sitemap.xml: ${urls} URLs\n` +
      `  feed.xml: ${feedItems} items\n` +
      `  llms.txt: ${llmsItems} latest devotionals\n` +
      `  app.html: the shell for paths that have no file`,
  );
}

run().catch((error) => {
  console.error('Site generation failed:', error);
  process.exit(1);
});
