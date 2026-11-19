import type { ReactNode } from 'react';
import Seo from '../Seo';
import PageHeader from './PageHeader';
import SitePage from './SitePage';

type Props = {
  /**
   * Browser tab title and search-result title. Leave it out and the title comes
   * from `seo/site.mjs`, which is what the build wrote into the HTML file for
   * this route — one source, so the tab and the file cannot disagree.
   */
  seoTitle?: string;
  seoDescription?: string;
  path: string;
  /** schema.org objects for this page, e.g. the help page's FAQPage. */
  seoJsonLd?: Record<string, unknown>;
  /** Small caps tag above the heading, e.g. "PRIVACY". */
  eyebrow: string;
  title: string;
  intro: ReactNode;
  /** A pop colour class for the header card, e.g. "bg-pop-violet". */
  tone: string;
  /** The 3D object that sits on the header card. */
  object: string;
  /** Extra line under the intro, e.g. the "last updated" date. */
  meta?: ReactNode;
  children: ReactNode;
};

/**
 * The frame for the website's text pages: Privacy, Terms and Help.
 *
 * The same SitePage and PageHeader the content pages use; this only adds the
 * <Seo> those three pages share.
 */
const InfoShell = ({
  seoTitle,
  seoDescription,
  path,
  seoJsonLd,
  eyebrow,
  title,
  intro,
  tone,
  object,
  meta,
  children,
}: Props) => (
  <SitePage>
    <Seo path={path} title={seoTitle} description={seoDescription} jsonLd={seoJsonLd} />
    <PageHeader eyebrow={eyebrow} title={title} intro={intro} tone={tone} object={object} meta={meta} />
    {children}
  </SitePage>
);

export default InfoShell;
