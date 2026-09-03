const SITE_NAME = 'RCCG Region 63 Teens';
const SITE_URL = 'https://thefaithtribe.live';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

type Props = {
  /** Page title. Rendered as "<title> — RCCG Region 63 Teens" unless `bare`. */
  title: string;
  description: string;
  /** Path only, e.g. "/events/123". Becomes the canonical and og:url. */
  path?: string;
  /** Absolute URL. Must be JPEG or PNG — social crawlers do not decode AVIF and
   *  are unreliable on WebP, which is why the pipeline emits og-image.jpg. */
  image?: string;
  type?: 'website' | 'article';
  /** Keeps crawlers off pages that carry no content (auth, mid-flow screens). */
  noindex?: boolean;
  /** Use the title verbatim, without the site-name suffix. */
  bare?: boolean;
  /** Rendered as a JSON-LD script. Pass a schema.org object. */
  jsonLd?: Record<string, unknown>;
};

/**
 * Per-route document metadata.
 *
 * No head-manager dependency: React 19 hoists <title>, <meta> and <link> to
 * <head> from anywhere in the tree, so react-helmet-async would be ~8KB spent on
 * something the runtime already does.
 *
 * Before this, all ~35 routes shared one title, one description, and one
 * hardcoded Event JSON-LD block advertising a camp that had been over for
 * twenty months.
 */
const Seo = ({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  bare = false,
  jsonLd,
}: Props) => {
  const fullTitle = bare ? title : `${title} — ${SITE_NAME}`;
  const url = path ? `${SITE_URL}${path}` : undefined;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="en_NG" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        // Rendered from real data. The index.html block is Organization only.
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            // Escaping "<" prevents a title containing "</script>" from breaking
            // out of the block — the one injection vector a JSON-LD tag has.
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      )}
    </>
  );
};

export default Seo;
