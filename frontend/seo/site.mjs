/**
 * One description of the site and of every route that has a head worth serving.
 *
 * This file is read by two things that must never disagree:
 *
 *   - `src/components/Seo.tsx`, at runtime, in the browser;
 *   - `scripts/generate-static-html.mjs`, at build time, which writes a real
 *     HTML file per route.
 *
 * That second one is the point. Until now every URL on the site — `/events`,
 * `/devotionals/38b7…`, the lot — was answered with the same `index.html`,
 * carrying the home page's title, description and canonical. A crawler that
 * does not run JavaScript (and most that matter do not) saw 400 URLs that all
 * claimed to be the home page. Rolling the metadata and the generated files off
 * the same table means the two can only differ if this file is wrong.
 *
 * Nothing here imports Node or React. It is plain data and pure functions so
 * both consumers can use it unchanged.
 */

/**
 * The canonical origin.
 *
 * The short host, `thefaithtribe.live`, answers 307 to the `www` one. A
 * canonical that points at a redirecting host is a contradiction: the sitemap,
 * the canonicals, the Open Graph URLs and the JSON-LD all used to name it while
 * the server insisted on this. One origin, and it is the one that serves 200.
 *
 * Changing the domain is a change to this line, the deployment's domain
 * settings, and `public/robots.txt`.
 */
export const SITE = {
  origin: 'https://www.thefaithtribe.live',
  name: 'Faith Tribe',
  /** The organisation behind the product, used in JSON-LD `legalName`. */
  legalName: 'RCCG Region 63 Junior Church',
  /** One line the organisation uses about itself. Not the meta description. */
  slogan: 'One day. One verse. One message.',
  locale: 'en_NG',
  language: 'en-NG',
  description:
    'A few minutes with God, every day. Free daily devotionals, the Bible, study manuals and camp registration for teenagers in RCCG Region 63 Junior Church.',

  /** 288×288 PNG. Google wants at least 112×112, and will not accept WebP for a logo. */
  logo: { path: '/img/faithTribeLogo-fallback.png', width: 288, height: 288 },

  /** Social cards. JPEG because X, WhatsApp and LinkedIn do not decode WebP reliably. */
  image: {
    path: '/og-image.jpg',
    width: 1200,
    height: 630,
    type: 'image/jpeg',
    alt: 'Faith Tribe — the teen app of RCCG Region 63 Junior Church',
  },

  contact: {
    email: 'region63juniorchurch@gmail.com',
    /** E.164, which is what `telephone` expects. */
    telephone: '+2348064254001',
    /** As a human reads it, and as a `tel:` link needs it. */
    phone: '+234 806 425 4001',
    phoneHref: 'tel:+2348064254001',
  },

  /** The church body the region belongs to. Used as `parentOrganization`. */
  parent: { name: 'The Redeemed Christian Church of God', url: 'https://rccg.org' },

  /** Where the search engine should understand this to serve. */
  areaServed: 'RCCG Region 63, Lagos, Nigeria',

  /**
   * The postal address behind the organisation. City and country only: the
   * church meets in many parishes, so a street address here would describe one
   * building as if it were the whole region.
   */
  address: { locality: 'Lagos', region: 'Lagos', country: 'NG' },

  /**
   * Official profiles, used as `sameAs`. Empty until there are accounts the
   * church controls; a guessed handle in structured data is worse than none.
   */
  sameAs: [],

  /** The iPhone web app. Linked from the landing page, and a separate project. */
  webApp: 'https://app.thefaithtribe.live',

  /** The feed this site publishes, linked from every head. */
  feedPath: '/feed.xml',
};

/**
 * Routes that may be indexed, in the order the sitemap lists them.
 *
 * `title` is the finished `<title>`, brand included — no consumer appends
 * anything to it. `description` is the finished meta description.
 *
 * `index: false` routes are still written as HTML files (so a direct visit has
 * a correct title), but carry `noindex` and stay out of the sitemap.
 *
 * Anything with a dynamic segment lives in `DYNAMIC_ROUTES` below; those pages
 * are generated from the API at build time.
 */
export const STATIC_ROUTES = [
  {
    path: '/',
    title: 'Faith Tribe — Daily Devotionals & Bible for RCCG Teens',
    description:
      'A few minutes with God, every day. Free daily devotionals, the Bible, study manuals and camp registration for teenagers in RCCG Region 63 Junior Church.',
    priority: 1,
    changeFrequency: 'daily',
  },
  {
    path: '/devotionals',
    title: 'Teenage Open Heavens — Daily Teen Devotionals — Faith Tribe',
    description:
      'Read today’s Teenage Open Heavens devotional: the memory verse, the message, the key point and the prayer point, written every day for teenagers.',
    priority: 0.9,
    changeFrequency: 'daily',
  },
  {
    path: '/events',
    title: 'RCCG Teen Camps & Events — Faith Tribe',
    description:
      'Camps, conferences and hangouts for RCCG Region 63 teenagers. See what is coming, register online, pay by card or transfer, and keep your ticket on your phone.',
    priority: 0.9,
    changeFrequency: 'daily',
  },
  {
    path: '/manuals',
    title: 'Bible Study Manuals for Teens — Faith Tribe',
    description:
      'The weekly RCCG Junior Church teaching manual, by series and week, with a PDF to read in the browser or download. For teachers and the classes they lead.',
    priority: 0.7,
    changeFrequency: 'weekly',
  },
  {
    path: '/media',
    title: 'Podcasts & Worship Videos for Teens — Faith Tribe',
    description:
      'Podcasts, worship videos and teaching from Faith Tribe and RCCG Region 63 Junior Church, free to stream in your browser or the app.',
    priority: 0.7,
    changeFrequency: 'weekly',
  },
  {
    path: '/help',
    title: 'Help & Frequently Asked Questions — Faith Tribe',
    description:
      'Answers about Faith Tribe: getting started, your account, the daily reading, events and tickets, the Console for leaders, and staying safe.',
    priority: 0.5,
    changeFrequency: 'monthly',
  },
  {
    path: '/get-ticket',
    title: 'Get an Event Ticket — Faith Tribe',
    description:
      'Register for an RCCG Region 63 teen event and get your ticket on this phone. Bring it to the door, or have it scanned on arrival.',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    path: '/privacy',
    title: 'Privacy Notice — Faith Tribe',
    description:
      'What Faith Tribe collects, who can see it, how long it is kept and how a teenager or a parent can have it corrected or deleted.',
    priority: 0.3,
    changeFrequency: 'yearly',
  },
  {
    path: '/terms',
    title: 'Terms of Use — Faith Tribe',
    description:
      'The rules for using Faith Tribe: accounts, event registration and payment, content, and what happens if something goes wrong.',
    priority: 0.3,
    changeFrequency: 'yearly',
  },

  // Screens that exist but carry nothing a search engine should hold. They get
  // a file so the tab title is right, and a noindex tag so they stay out.
  { path: '/login', title: 'Log in — Faith Tribe', description: 'Log in to Faith Tribe.', index: false },
  { path: '/register', title: 'Create an account — Faith Tribe', description: 'Create a Faith Tribe account.', index: false },
  { path: '/forgot-password', title: 'Reset your password — Faith Tribe', description: 'Ask for a password reset for your Faith Tribe account.', index: false },
  { path: '/reset-password', title: 'Set a new password — Faith Tribe', description: 'Choose a new password for your Faith Tribe account.', index: false },
  { path: '/admin-login', title: 'Leader sign-in — Faith Tribe', description: 'Sign in to the Faith Tribe Console.', index: false },
  { path: '/coordinator-login', title: 'Coordinator sign-in — Faith Tribe', description: 'Sign in as a coordinator.', index: false },
  { path: '/ticket-preview', title: 'Your ticket — Faith Tribe', description: 'Your event ticket.', index: false },
  { path: '/ticket-not-found', title: 'Find your ticket — Faith Tribe', description: 'Look up an event ticket.', index: false },
  { path: '/upload-payment', title: 'Upload a payment — Faith Tribe', description: 'Send proof of an event payment.', index: false },
  { path: '/payment', title: 'Checkout — Faith Tribe', description: 'Complete an event payment.', index: false },
  { path: '/payment/callback', title: 'Payment received — Faith Tribe', description: 'Your payment result.', index: false },
];

/**
 * Routes whose URL carries an identifier. The build script asks the API for the
 * slugs of everything published and writes one file per item.
 *
 * `url(item)` is the path the site actually links to. If the API ever learns to
 * resolve by slug, this is the only function that has to change.
 */
export const DYNAMIC_ROUTES = [
  {
    collection: 'devotionals',
    api: '/content/devotionals/?status=published&page_size=200',
    url: (item) => `/devotionals/${item.id}`,
    title: (item) => devotionalTitle(item),
    description: (item) =>
      [
        item.memory_verse_passage ? `${item.memory_verse_passage}: “${squash(item.memory_verse_content)}”` : null,
        'Read the full devotional, with the message, key point and prayer point, on Faith Tribe.',
      ]
        .filter(Boolean)
        .join(' '),
    /** The image a social card should show, if the item has one. */
    image: (item) => item.cover_image || null,
    type: 'article',
    priority: 0.8,
    changeFrequency: 'monthly',
    lastModified: (item) => item.updated_at || item.date,
  },
  {
    collection: 'events',
    api: '/events/events/?status=published&page_size=200',
    url: (item) => `/events/${item.id}`,
    title: (item) => `${item.title} — RCCG Region 63 Teens — Faith Tribe`,
    description: (item) =>
      item.short_description?.trim() ||
      `An RCCG Region 63 Junior Church event: ${item.title}. See the date, the venue, what it costs and how to register.`,
    image: (item) => item.cover_image || null,
    type: 'article',
    priority: 0.8,
    changeFrequency: 'weekly',
    lastModified: (item) => item.updated_at || item.start_datetime,
  },
];

/* ------------------------------------------------------------------ helpers */

/**
 * A `YYYY-MM-DD` as "9 November 2026".
 *
 * Read in UTC on purpose: the API sends a calendar date, and parsing it in a
 * timezone behind UTC would turn the 1st into the 31st.
 */
export function formatDay(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * The document title for one devotional.
 *
 * Devotional titles repeat. The archive carries several readings called "Divine
 * Help", and a run of scraped "Open Heavens Today …" headlines that repeat
 * month after month. Two pages with one title are two pages competing for one
 * result, so the date goes into the title — and when the headline is too long to
 * leave room for the date and the brand, the series and the date replace it
 * rather than a truncated headline that reads as neither.
 *
 * The 30-character budget is what is left of a 60-character result after
 * " — 9 November 2026 — Faith Tribe".
 */
export function devotionalTitle(item) {
  const headline = String(item?.title || '').trim();
  const day = formatDay(item?.date);
  if (headline && headline.length <= 30) return day ? `${headline} — ${day}` : headline;
  return day ? `Teenage Open Heavens — ${day}` : 'Teenage Open Heavens';
}

/**
 * The meta description for one devotional.
 *
 * Built from the memory verse and the date rather than from the message, because
 * the list endpoint the build reads does not carry the message and the page the
 * browser renders does. Both call this, so the file and the document say the
 * same thing. The date is also what makes two readings with one title — which
 * this archive has — distinct.
 */
export function devotionalDescription(item) {
  const day = formatDay(item?.date);
  const passage = String(item?.memory_verse_passage || '').trim();
  const verse = squash(item?.memory_verse_content, 70);

  if (passage && verse) {
    return `“${verse}” (${passage}) Read the ${day || 'daily'} Teenage Open Heavens devotional for teenagers.`;
  }

  return `The ${day || 'daily'} Teenage Open Heavens devotional for teenagers: a short reading, a memory verse, a key point and a prayer point.`;
}

/**
 * The price a reader would actually pay.
 *
 * `current_price` is the early-bird or tier price when one is active; `price`
 * is the base. A null base price with a live current price is a paid event, so
 * treating the missing base as 0 would advertise it as free.
 */
export function eventPrice(event) {
  const raw = event?.current_price ?? event?.price;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Free only when the organiser says so or the effective price is zero. */
export function eventIsFree(event) {
  return event?.is_free === true || eventPrice(event) === 0;
}

/**
 * The meta description for one event.
 *
 * Event rows carry a `short_description` that is sometimes a sentence and
 * sometimes the word "flyer", so it cannot be the description on its own. What
 * matters to the reader — when, where, how much — is in the fields, and this
 * puts them first.
 */
export function eventDescription(event) {
  const when = event?.start_datetime
    ? new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Lagos',
      }).format(new Date(event.start_datetime))
    : '';

  const where = [event?.venue, event?.city].filter(Boolean).join(', ');
  const lead = `${event?.title || 'Event'}${when ? `, ${when}` : ''}${where ? ` at ${where}` : ''}.`;
  const supplied = String(event?.short_description || '').trim();

  return [
    lead,
    supplied.length > 24 ? supplied : null,
    eventIsFree(event)
      ? 'Free admission. See what is on and register online.'
      : 'See the ticket price and register online.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** The robots directive for pages that should be found. The extra values let a
 *  result show a large image and keep the snippet long, which is what Google
 *  shows by default only for sites it trusts. */
export const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const ROBOTS_NOINDEX = 'noindex, follow';

/** Collapse whitespace and trim to a length that reads as a sentence. */
export function squash(value, limit = 155) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  return `${cut.slice(0, stop > 40 ? stop : limit).replace(/[,;:.\s]+$/, '')}…`;
}

/** A path or absolute URL as an absolute URL on the canonical origin. */
export function absoluteUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean === '/' ? `${SITE.origin}/` : `${SITE.origin}${clean.replace(/\/+$/, '')}`;
}

/** An absolute URL for one of the site's own files. */
export const assetUrl = (path) => absoluteUrl(path);

/** The brand suffix used on pages whose title is written per request. */
export const withBrand = (title) => `${title} — ${SITE.name}`;

/**
 * Normalise a social image. A per-page image is usually a bare CDN URL from the
 * API; the defaults are paths in `public/`.
 */
function normaliseImage(image) {
  if (!image) return null;
  if (typeof image === 'string') {
    return { url: absoluteUrl(image), width: undefined, height: undefined, type: undefined, alt: undefined };
  }
  return {
    ...image,
    url: absoluteUrl(image.url || image.path),
  };
}

/**
 * Everything a page's head needs, from the static table plus whatever the page
 * knows at runtime.
 *
 * A page either names its `path` and takes the table's copy, or passes its own
 * `title`/`description` for content that only exists at runtime (an event, a
 * devotional). The second form is branded here so a page never has to remember
 * the separator.
 */
export function metaFor({
  path,
  title,
  description,
  image,
  type,
  index,
  jsonLd = [],
  bare = false,
  lastModified,
} = {}) {
  const route = STATIC_ROUTES.find((candidate) => candidate.path === path);

  const docTitle = title ? (bare ? title : withBrand(title)) : route?.title || SITE.name;
  const docDescription = squash(description || route?.description || SITE.description);
  // Normalise whichever image won: a per-page CDN URL, a route's own image, or
  // the site default, which is a `{ path, width, height }` record rather than a
  // URL. Missing this step is how `og:image` came out as "undefined".
  const docImage =
    normaliseImage(image) || normaliseImage(route?.image) || normaliseImage(SITE.image);
  const indexable = index ?? route?.index ?? true;

  return {
    path,
    title: docTitle,
    description: docDescription,
    // A page with no path has no canonical: it is either a screen that should
    // not be indexed or one whose URL is only known in the browser.
    url: path ? absoluteUrl(path) : null,
    image: docImage,
    type: type || route?.type || 'website',
    robots: indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX,
    indexable,
    jsonLd: jsonLd.filter(Boolean),
    lastModified,
  };
}

/**
 * The head of a page, as data.
 *
 * Both consumers render *this*, so the static file and the client-rendered
 * document cannot drift: `Seo.tsx` maps these to React elements and
 * `generate-static-html.mjs` serialises them to a string.
 *
 * Each entry is `{ tag, attrs?, children?, html? }`. `html` means the content is
 * already-safe raw markup (a JSON-LD script body).
 */
export function buildHead(meta) {
  const tags = [];
  const push = (tag, attrs, extra = {}) => tags.push({ tag, attrs, ...extra });

  push('title', null, { children: meta.title });
  push('meta', { name: 'description', content: meta.description });
  // A page served from the SPA fallback has no canonical of its own: the URL is
  // decided in the browser. Saying nothing is right; pointing at the home page
  // would have said every unknown URL is a duplicate of it.
  if (meta.url) push('link', { rel: 'canonical', href: meta.url });
  push('meta', { name: 'robots', content: meta.robots });

  // Open Graph. `og:image:alt` is not decoration: a card without it is read out
  // as the file name by some clients.
  push('meta', { property: 'og:type', content: meta.type });
  push('meta', { property: 'og:site_name', content: SITE.name });
  push('meta', { property: 'og:locale', content: SITE.locale });
  push('meta', { property: 'og:title', content: meta.title });
  push('meta', { property: 'og:description', content: meta.description });
  if (meta.url) push('meta', { property: 'og:url', content: meta.url });
  push('meta', { property: 'og:image', content: meta.image.url });
  if (meta.image.width) push('meta', { property: 'og:image:width', content: String(meta.image.width) });
  if (meta.image.height) push('meta', { property: 'og:image:height', content: String(meta.image.height) });
  if (meta.image.type) push('meta', { property: 'og:image:type', content: meta.image.type });
  if (meta.image.alt) push('meta', { property: 'og:image:alt', content: meta.image.alt });

  push('meta', { name: 'twitter:card', content: 'summary_large_image' });
  push('meta', { name: 'twitter:title', content: meta.title });
  push('meta', { name: 'twitter:description', content: meta.description });
  push('meta', { name: 'twitter:image', content: meta.image.url });
  if (meta.image.alt) push('meta', { name: 'twitter:image:alt', content: meta.image.alt });

  // Discoverable by feed readers and by anything that looks for a feed before
  // it looks for a sitemap.
  push('link', {
    rel: 'alternate',
    type: 'application/rss+xml',
    title: `${SITE.name} — Teenage Open Heavens`,
    href: absoluteUrl(SITE.feedPath),
  });

  for (const object of meta.jsonLd) {
    push('script', { type: 'application/ld+json' }, { html: JSON.stringify(object).replace(/</g, '\\u003c') });
  }

  return tags;
}

/* ------------------------------------------------------ serialisation (Node) */

const escapeAttribute = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Text inside an element needs no quote escaping, only the three that end it. */
const escapeText = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const VOID = new Set(['meta', 'link', 'base', 'br', 'hr', 'img', 'input']);

/**
 * The same tags as an HTML string, for the build script. Kept next to
 * `buildHead` so a tag added there cannot be forgotten here.
 */
export function headToHtml(meta, indent = '  ') {
  return buildHead(meta)
    .map(({ tag, attrs, children, html }) => {
      const renderedAttrs = { ...(attrs || {}) };
      // Mark JSON-LD written into the static document. `Seo.tsx` removes only
      // these when the client takes over, so a direct load does not leave two
      // copies of the same route's schema in <head>.
      if (tag === 'script' && renderedAttrs.type === 'application/ld+json') {
        renderedAttrs['data-seo-static'] = '1';
      }
      const rendered = Object.entries(renderedAttrs)
        .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
        .join(' ');
      if (VOID.has(tag)) return `${indent}<${tag}${rendered ? ` ${rendered}` : ''} />`;
      const body = html ?? escapeText(children ?? '');
      return `${indent}<${tag}${rendered ? ` ${rendered}` : ''}>${body}</${tag}>`;
    })
    .join('\n');
}
