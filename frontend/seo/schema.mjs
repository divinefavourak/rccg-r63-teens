/**
 * schema.org objects, built from real data only.
 *
 * Every node that has a stable `@id` is linked, not repeated: the Organisation
 * is declared once per page and everything else points at it. That matters here
 * because the same page can carry structured data twice — once in the HTML the
 * build wrote, once in the DOM React renders — and two nodes with one `@id` are
 * merged by a search engine rather than counted as a conflict.
 *
 * The rules these follow:
 *
 *   - Never describe something that did not happen. The old index.html carried
 *     a schema.org/Event for a camp that ended twenty months earlier.
 *   - `url` is always the canonical, so a rich result cannot point at a
 *     redirect.
 *   - Optional fields are dropped when the data is absent rather than padded
 *     with a placeholder.
 */
import { SITE, absoluteUrl, eventDescription, eventIsFree, eventPrice } from './site.mjs';

const ORGANIZATION_ID = `${SITE.origin}/#organization`;
const WEBSITE_ID = `${SITE.origin}/#website`;

/** Drop every undefined key, recursively, so nothing serialises as `null`. */
function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter((entry) => entry !== undefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, compact(entry)])
      .filter(([, entry]) => entry !== undefined && entry !== null && entry !== ''),
  );
}

const logo = () => ({
  '@type': 'ImageObject',
  url: absoluteUrl(SITE.logo.path),
  width: SITE.logo.width,
  height: SITE.logo.height,
});

/** The church behind the product. */
export function organizationLd() {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE.name,
    alternateName: [...SITE.alternateNames, SITE.legalName],
    legalName: SITE.legalName,
    slogan: SITE.slogan,
    url: SITE.origin,
    logo: logo(),
    image: logo(),
    description: SITE.description,
    email: SITE.contact.email,
    telephone: SITE.contact.telephone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.country,
    },
    areaServed: { '@type': 'AdministrativeArea', name: SITE.areaServed },
    sameAs: SITE.sameAs.length ? SITE.sameAs : undefined,
    parentOrganization: { '@type': 'Organization', name: SITE.parent.name, url: SITE.parent.url },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE.contact.email,
      telephone: SITE.contact.telephone,
      availableLanguage: ['en'],
    },
  });
}

/** The site itself. One per URL, and every page points at it. */
export function websiteLd() {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    // Google's site-name system reads this node on the home page: `name` first,
    // then `alternateName` when the name alone is ambiguous. `url` is the home
    // page with its trailing slash, the same string as the home canonical.
    url: `${SITE.origin}/`,
    name: SITE.name,
    alternateName: SITE.alternateNames,
    description: SITE.description,
    inLanguage: SITE.language,
    publisher: { '@id': ORGANIZATION_ID },
  });
}

/**
 * The page a URL serves. `dateModified` is worth setting on content pages: it
 * is one of the few signals a crawler uses to decide a page is worth revisiting.
 */
export function webPageLd({ url, title, description, image, dateModified, type = 'WebPage' }) {
  const pageUrl = absoluteUrl(url);
  return compact({
    '@context': 'https://schema.org',
    '@type': type,
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    description,
    inLanguage: SITE.language,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORGANIZATION_ID },
    primaryImageOfPage: image ? { '@type': 'ImageObject', url: absoluteUrl(image) } : undefined,
    dateModified,
  });
}

/** Trail from the home page to this one, as a search result can show. */
export function breadcrumbLd({ url, trail }) {
  const pageUrl = absoluteUrl(url);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: trail.map((item, position) => ({
      '@type': 'ListItem',
      position: position + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * A devotional. `Article` rather than `BlogPosting`: these are published daily
 * by an organisation, not written by an individual blogger, and the extra
 * BlogPosting promises would be empty fields.
 */
export function articleLd({ url, title, description, datePublished, dateModified, image, author }) {
  const pageUrl = absoluteUrl(url);
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    mainEntityOfPage: { '@id': `${pageUrl}#webpage` },
    url: pageUrl,
    headline: title,
    description,
    datePublished,
    dateModified: dateModified || datePublished,
    image: image ? [absoluteUrl(image)] : undefined,
    inLanguage: SITE.language,
    isAccessibleForFree: true,
    articleSection: 'Teenage Open Heavens',
    author: author
      ? { '@type': 'Person', name: author }
      : { '@id': ORGANIZATION_ID },
    publisher: compact({
      '@id': ORGANIZATION_ID,
      '@type': 'Organization',
      name: SITE.legalName,
      logo: logo(),
    }),
  });
}

/**
 * Where an event happens. Google treats a missing `location` as a critical
 * error that keeps the event out of results, so every attendance mode gets one:
 * a Place for in-person, a VirtualLocation for online (the event page, never
 * the private join link), and both for hybrid. A physical event with no venue
 * falls back to the region, which is where every event here is held.
 */
function eventLocation(event, pageUrl) {
  const place = compact({
    '@type': 'Place',
    name: event.venue || event.city || SITE.areaServed,
    address: {
      '@type': 'PostalAddress',
      streetAddress: event.address,
      addressLocality: event.city || SITE.address.locality,
      addressRegion: event.state || SITE.address.region,
      addressCountry: SITE.address.country,
    },
  });
  const online = { '@type': 'VirtualLocation', url: pageUrl };
  if (event.is_virtual) return online;
  if (event.is_hybrid) return [place, online];
  return place;
}

/**
 * An event, from the row the API returned.
 *
 * `offers` is only added when the site actually sells something: a free event
 * still gets an Offer at price 0, because Google needs one to show the date and
 * the registration link together.
 */
export function eventLd(event, url) {
  const pageUrl = absoluteUrl(url);
  const free = eventIsFree(event);
  const price = eventPrice(event);
  const soldOut = event.spots_remaining === 0;
  const organizerName = event.organizer_name || SITE.legalName;
  const siteOrganizer = organizerName === SITE.name || organizerName === SITE.legalName;

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${pageUrl}#event`,
    name: event.title,
    url: pageUrl,
    // `short_description` is sometimes just the word "flyer"; the built
    // description always says when, where and how much.
    description: eventDescription(event) || event.description,
    startDate: event.start_datetime,
    endDate: event.end_datetime,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.is_virtual
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : event.is_hybrid
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
    image: event.cover_image ? [event.cover_image] : undefined,
    isAccessibleForFree: free,
    inLanguage: SITE.language,
    location: eventLocation(event, pageUrl),
    offers: free || price !== null
      ? {
          '@type': 'Offer',
          url: pageUrl,
          price: free ? '0' : String(price),
          priceCurrency: 'NGN',
          availability: soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
          validFrom: event.registration_opens_at || event.registration_opens,
        }
      : undefined,
    organizer: siteOrganizer
      ? compact({
          '@id': ORGANIZATION_ID,
          '@type': 'Organization',
          name: organizerName,
          url: SITE.origin,
        })
      : compact({ '@type': 'Organization', name: organizerName }),
  });
}

/**
 * A list page's items.
 *
 * The archive and the events page are the two places a crawler can discover
 * content that is not linked from the home page. The visible cards are links;
 * this states the same list in a form a machine can read, in order, with the
 * text the card shows. Google has used ItemList for carousel and list results
 * since 2023, and an answer engine can quote it without guessing at the DOM.
 */
export function itemListLd({ url, name, items }) {
  const pageUrl = absoluteUrl(url);
  // Google's "summary page" form: each ListItem is just a link to the page
  // that carries the full object. Typing the entries (`Event`, `Article`)
  // made Google validate them as stand-alone events with no location, offers
  // or organiser — the detail pages already describe each one completely.
  return compact({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${pageUrl}#items`,
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(item.url),
      name: item.name,
    })),
  });
}

/**
 * The help page's questions.
 *
 * Google stopped showing FAQ rich results for most sites in 2023, so this is
 * not here for stars in a result. It is here because the questions are the
 * clearest statement on the site of what the product does and who it is for, and
 * answer engines read it without guessing.
 */
export function faqLd({ url, questions }) {
  const pageUrl = absoluteUrl(url);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: questions.map((question) => ({
      '@type': 'Question',
      name: question.q,
      acceptedAnswer: { '@type': 'Answer', text: question.a },
    })),
  };
}
