/**
 * Reads back what the build wrote and complains about the things that were
 * wrong before this pipeline existed.
 *
 * It fails the build on the mistakes that actually cost traffic:
 *
 *   - two pages with one title (every route used to share the home page's);
 *   - a canonical that is missing, relative, on the wrong host, or naming a
 *     different page than the file it sits in;
 *   - a sitemap URL on a host that redirects;
 *   - structured data that is not valid JSON.
 *
 * Lengths are reported as warnings, not failures: a title four characters over
 * is a badly written result, not a broken site, and failing a deploy for it
 * would teach everyone to bypass this script.
 *
 * Run as part of `npm run build`, and on its own with `npm run seo:check`.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { SITE, absoluteUrl } from '../seo/site.mjs';

const DIST = 'dist';
const failures = [];
const warnings = [];

const fail = (file, message) => failures.push(`${file}: ${message}`);
const warn = (file, message) => warnings.push(`${file}: ${message}`);

const decode = (value) =>
  String(value)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");

/** The URL a generated file is served at. */
function urlFor(file) {
  const path = relative(DIST, file).split(sep).join('/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'/index.html'.length)}`;
  return `/${path}`;
}

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

function metaContent(html, attribute, value) {
  const pattern = new RegExp(`<meta[^>]*${attribute}="${value}"[^>]*content="([^"]*)"`, 'i');
  return html.match(pattern)?.[1];
}

function linkHref(html, rel) {
  const pattern = new RegExp(`<link[^>]*rel="${rel}"[^>]*href="([^"]*)"`, 'i');
  return html.match(pattern)?.[1];
}

async function checkHtml(files) {
  const titles = new Map();
  const descriptions = new Map();

  for (const file of files) {
    const name = relative(DIST, file).split(sep).join('/');

    // The SPA shell is not a page: no canonical, no unique title. Everything
    // else is expected to be a real document.
    if (name === 'app.html') {
      if (linkHref(await readFile(file, 'utf8'), 'canonical')) {
        fail(name, 'the app shell must not carry a canonical — its URL is only known in the browser');
      }
      continue;
    }

    const html = await readFile(file, 'utf8');
    const url = urlFor(file);
    // A noindex page is a sign-in form, a ticket or a payment step. Its copy
    // length is nobody's search result, so it is not worth a warning.
    const noindex = /noindex/i.test(metaContent(html, 'name', 'robots') || '');

    const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    if (!title?.trim()) fail(name, 'no <title>');
    else {
      const decoded = decode(title);
      if (titles.has(decoded)) fail(name, `title is the same as ${titles.get(decoded)}: “${decoded}”`);
      else titles.set(decoded, name);
      if (!noindex && decoded.length > 65) warn(name, `title is ${decoded.length} characters; Google shows about 60`);
      if (!noindex && decoded.length < 15) warn(name, `title is only ${decoded.length} characters`);
    }

    const description = decode(metaContent(html, 'name', 'description') || '');
    if (!description) fail(name, 'no meta description');
    else {
      if (descriptions.has(description)) warn(name, `description is the same as ${descriptions.get(description)}`);
      else descriptions.set(description, name);
      if (!noindex && description.length > 165) warn(name, `description is ${description.length} characters; about 155 fits`);
      if (!noindex && description.length < 70) warn(name, `description is only ${description.length} characters`);
    }

    const canonical = linkHref(html, 'canonical');
    if (!canonical) fail(name, 'no canonical');
    else {
      if (!canonical.startsWith(`${SITE.origin}/`) && canonical !== `${SITE.origin}/`) {
        fail(name, `canonical is not on ${SITE.origin}: ${canonical}`);
      }
      if (canonical !== absoluteUrl(url)) fail(name, `canonical ${canonical} does not match this page ${absoluteUrl(url)}`);
    }

    const robots = metaContent(html, 'name', 'robots');
    if (!robots) fail(name, 'no robots directive');

    const ogImage = metaContent(html, 'property', 'og:image');
    if (!ogImage) fail(name, 'no og:image');
    else if (!/^https?:\/\//.test(ogImage)) fail(name, `og:image is not an absolute URL: ${ogImage}`);

    // The generated tag carries `data-seo-static`, so match the type attribute
// wherever it sits in the opening tag rather than requiring it to be first.
    for (const block of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(block[1].replace(/\\u003c/g, '<'));
      } catch {
        fail(name, 'structured data is not valid JSON');
      }
    }

    if (!/<script[^>]*type="application\/ld\+json"/.test(html)) warn(name, 'no structured data');
  }

  return titles.size;
}

async function checkSitemap() {
  let sitemap;
  try {
    sitemap = await readFile(join(DIST, 'sitemap.xml'), 'utf8');
  } catch {
    fail('sitemap.xml', 'missing');
    return 0;
  }

  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1]));
  if (locations.length === 0) fail('sitemap.xml', 'has no URLs');

  for (const location of locations) {
    if (!location.startsWith(`${SITE.origin}/`) && location !== `${SITE.origin}/`) {
      fail('sitemap.xml', `URL is not on ${SITE.origin}: ${location}`);
    }
    if (/[?&]/.test(location)) warn('sitemap.xml', `URL carries a query string: ${location}`);
  }

  if (/<loc>[^<]*\/<\/loc>/.test(sitemap) === false && !locations.includes(`${SITE.origin}/`)) {
    warn('sitemap.xml', 'the home page is not listed');
  }

  return locations.length;
}

async function checkFeed() {
  try {
    const feed = await readFile(join(DIST, 'feed.xml'), 'utf8');
    if (!feed.includes('<rss')) fail('feed.xml', 'is not an RSS document');
    if (!/<item>/.test(feed)) warn('feed.xml', 'has no items');
  } catch {
    warn('feed.xml', 'missing — the feed link in every head will 404');
  }
}

async function checkLlmsTxt() {
  try {
    const llms = await readFile(join(DIST, 'llms.txt'), 'utf8');
    if (!llms.includes(`# ${SITE.name}`)) fail('llms.txt', 'does not name the site');
    if (!llms.includes(SITE.origin)) fail('llms.txt', `does not link to ${SITE.origin}`);
    if (!/## Pages/.test(llms)) warn('llms.txt', 'has no Pages section');
  } catch {
    // A missing map is not fatal to a crawl, but every head links to the
    // convention and it costs one file. Warn rather than fail, like feed.xml.
    warn('llms.txt', 'missing — the answer-engine map is not being published');
  }
}

async function checkRobots() {
  try {
    const robots = await readFile(join(DIST, 'robots.txt'), 'utf8');
    if (!robots.includes(`Sitemap: ${SITE.origin}/sitemap.xml`)) {
      fail('robots.txt', `does not point at ${SITE.origin}/sitemap.xml`);
    }
    if (/Disallow: \/\s*$/m.test(robots)) fail('robots.txt', 'disallows the whole site');
  } catch {
    fail('robots.txt', 'missing');
  }
}

async function run() {
  let files;
  try {
    files = await htmlFiles(DIST);
  } catch {
    console.error(`${DIST}/ is missing. Run this after \`npm run build\`.`);
    process.exit(1);
  }

  const pages = await checkHtml(files);
  const urls = await checkSitemap();
  await checkFeed();
  await checkLlmsTxt();
  await checkRobots();

  console.log(`SEO check: ${pages} pages, ${urls} sitemap URLs`);

  for (const warning of warnings) console.warn(`  warning  ${warning}`);
  for (const failure of failures) console.error(`  FAILED   ${failure}`);

  if (failures.length) {
    console.error(`\n${failures.length} problem${failures.length === 1 ? '' : 's'} that must be fixed before this deploys.`);
    process.exit(1);
  }

  console.log(`  OK — ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
}

run().catch((error) => {
  console.error('SEO check crashed:', error);
  process.exit(1);
});
