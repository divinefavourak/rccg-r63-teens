import { createElement, Fragment, useEffect, type ReactNode } from 'react';
import { buildHead, metaFor, type HeadTag, type SiteImage } from '../../seo/site.mjs';
import { breadcrumbLd, organizationLd, webPageLd, websiteLd } from '../../seo/schema.mjs';

type Props = {
  /**
   * Path only, e.g. "/events". Becomes the canonical and og:url. Omit it on a
   * screen that has no URL worth naming — a 404, a modal state — and no
   * canonical is rendered at all.
   */
  path?: string;
  /**
   * Page title. Omit it to take the title this route has in `seo/site.mjs` —
   * which is also the title the build wrote into the HTML, so the two agree.
   * Pass it only for content that exists at runtime (an event, a devotional);
   * the brand suffix is added for you unless `bare`.
   */
  title?: string;
  description?: string;
  /** Absolute URL from the API, or a `{ url, width, height, alt }` object. */
  image?: string | SiteImage;
  type?: 'website' | 'article';
  /** Keeps crawlers off pages that carry no content (auth, mid-flow screens). */
  noindex?: boolean;
  /** Use the title verbatim, without the site-name suffix. */
  bare?: boolean;
  /** schema.org objects. An array is rendered as one script per object. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Adds a BreadcrumbList, and is what the visible trail should show. */
  trail?: { name: string; path: string }[];
  /** Feeds `dateModified` on the WebPage node. */
  lastModified?: string;
};

/**
 * Per-route document metadata.
 *
 * No head-manager dependency: React 19 hoists <title>, <meta> and <link> to
 * <head> from anywhere in the tree, so react-helmet-async would be ~8KB spent on
 * something the runtime already does.
 *
 * The tags themselves are not written here. `buildHead` in `seo/site.mjs`
 * decides them, and `scripts/generate-static-html.mjs` renders the same list
 * into the HTML files the build writes. That is deliberate: a crawler that does
 * not run JavaScript reads the file, a browser reads this component, and both
 * see one set of tags rather than two that were meant to match.
 */
const Seo = ({
  path,
  title,
  description,
  image,
  type,
  noindex = false,
  bare = false,
  jsonLd,
  trail,
  lastModified,
}: Props) => {
  const meta = metaFor({
    path,
    title,
    description,
    image,
    type,
    index: noindex ? false : undefined,
    bare,
    lastModified,
  });

  // The build writes this route's JSON-LD into the static <head>. On a direct
// load React renders its own nodes too, and a client-side navigation leaves the
// old static ones behind. They are marked at generation time, so only the
// duplicates this component did not create are removed.
useEffect(() => {
    document
      .querySelectorAll('script[data-seo-static]')
      .forEach((node) => node.remove());
  }, [path, title]);

  const pageNodes = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const nodes = [
    organizationLd(),
    websiteLd(),
    // A WebPage is a statement about a URL. With no URL there is nothing to
    // describe, so a screen that does not name its path gets no page node.
    meta.url
      ? webPageLd({
          url: meta.url,
          title: meta.title,
          description: meta.description,
          image: meta.image.url,
          dateModified: lastModified,
        })
      : null,
    trail?.length && meta.url ? breadcrumbLd({ url: meta.url, trail }) : null,
    ...pageNodes,
  ].filter(Boolean) as Record<string, unknown>[];

  return (
    <Fragment>
      {buildHead({ ...meta, jsonLd: nodes }).map((tag, index) => renderTag(tag, index))}
    </Fragment>
  );
};

/**
 * One head tag as a React element. `html` is only ever a JSON-LD body, which
 * `buildHead` has already escaped; everything else is a plain attribute.
 */
const renderTag = ({ tag, attrs, children, html }: HeadTag, index: number): ReactNode => {
  const props: Record<string, unknown> = { ...(attrs as Record<string, unknown> | null) };

  if (html !== undefined) {
    props.dangerouslySetInnerHTML = { __html: html };
    return createElement(tag, { key: index, ...props });
  }

  return createElement(tag, { key: index, ...props }, children);
};

export default Seo;
