/**
 * Types for `site.mjs`.
 *
 * The data lives in the .mjs file because the build scripts are plain Node and
 * cannot read TypeScript. This declaration is what lets the React side import
 * the same file with the same guarantees. `.d.mts` (not `.d.ts`) is what
 * `moduleResolution: "bundler"` looks for beside a `.mjs` import.
 */

export type SiteImage = {
  /** Path on this site, or an absolute URL from the API. */
  url?: string;
  path?: string;
  width?: number;
  height?: number;
  type?: string;
  alt?: string;
};

/** A `{ tag, attrs, children }` triple the head renderer turns into markup. */
export type HeadTag = {
  tag: string;
  attrs?: Record<string, string | number | undefined> | null;
  children?: string;
  /** Pre-escaped markup (a JSON-LD body). */
  html?: string;
};

export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  priority?: number;
  changeFrequency?: string;
  index?: boolean;
  type?: string;
  image?: SiteImage;
};

export type DynamicRoute = {
  collection: string;
  api: string;
  url: (item: Record<string, unknown>) => string;
  title: (item: Record<string, unknown>) => string;
  description: (item: Record<string, unknown>) => string;
  image: (item: Record<string, unknown>) => string | null;
  type: string;
  priority: number;
  changeFrequency: string;
  lastModified: (item: Record<string, unknown>) => string | undefined;
};

export type MetaInput = {
  path?: string;
  /** Page-specific title. Branded here unless `bare`. */
  title?: string;
  description?: string;
  image?: string | SiteImage;
  type?: 'website' | 'article';
  index?: boolean;
  jsonLd?: Record<string, unknown>[];
  bare?: boolean;
  lastModified?: string;
};

export type ResolvedMeta = {
  path?: string;
  title: string;
  description: string;
  /** Null when the page named no path and so has no canonical. */
  url: string | null;
  image: Required<Pick<SiteImage, 'url'>> & SiteImage;
  type: string;
  robots: string;
  indexable: boolean;
  jsonLd: Record<string, unknown>[];
  lastModified?: string;
};

export const SITE: {
  origin: string;
  name: string;
  legalName: string;
  locale: string;
  language: string;
  description: string;
  logo: { path: string; width: number; height: number };
  image: { path: string; width: number; height: number; type: string; alt: string };
  contact: { email: string; telephone: string; phone: string; phoneHref: string };
  parent: { name: string; url: string };
  areaServed: string;
  webApp: string;
  feedPath: string;
};

export const STATIC_ROUTES: RouteMeta[];
export const DYNAMIC_ROUTES: DynamicRoute[];
export const ROBOTS_INDEX: string;
export const ROBOTS_NOINDEX: string;

export function squash(value: string, limit?: number): string;
export function absoluteUrl(path?: string): string;
export function assetUrl(path: string): string;
export function withBrand(title: string): string;
export function formatDay(value?: string | null): string;
export function devotionalTitle(item: { title?: string; date?: string }): string;
export function devotionalDescription(item: {
  title?: string;
  date?: string;
  memory_verse_passage?: string;
  memory_verse_content?: string;
}): string;
export function eventDescription(event: Record<string, unknown>): string;
export function metaFor(input?: MetaInput): ResolvedMeta;
export function buildHead(meta: ResolvedMeta): HeadTag[];
export function headToHtml(meta: ResolvedMeta, indent?: string): string;
