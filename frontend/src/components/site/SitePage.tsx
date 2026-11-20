import type { HTMLAttributes, ReactNode } from 'react';
import MotionRoot, { ScrollProgress } from './MotionRoot';
import SiteFooter from './SiteFooter';
import SiteNav from './SiteNav';

/**
 * The frame every public website page sits in: the landing page's nav, footer,
 * surface colours and motion root.
 *
 * Until this existed the content pages (devotionals, events, manuals, media)
 * still wore the first version of the site: a dark bar that called the product
 * "RCCG Region 63 Teens Platform", a different footer, and the app's dark mode.
 * A visitor who arrived from a search result saw one brand, clicked through
 * and saw another. The surface is set here rather than inherited, so the app's
 * `dark` class has no effect on these pages, as on the landing page.
 *
 * The page renders its own <Seo>; React 19 hoists it into <head> from anywhere.
 */
const SitePage = ({ children }: { children: ReactNode }) => (
  <MotionRoot>
    <div className="flex min-h-screen flex-col bg-surface-base font-sans text-content-primary antialiased">
      <ScrollProgress />
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  </MotionRoot>
);

/** The page's horizontal frame: phone gutter, desktop gutter, two max widths. */
export const Section = ({
  children,
  className = '',
  narrow = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Reading width, for prose and articles. */
  narrow?: boolean;
} & HTMLAttributes<HTMLElement>) => (
  <section className={`px-4 lg:px-10 ${className}`} {...rest}>
    <div className={`mx-auto w-full max-w-[640px] ${narrow ? 'lg:max-w-[760px]' : 'lg:max-w-[1200px]'}`}>
      {children}
    </div>
  </section>
);

/** Underlined brand-coloured link, for links inside running text. */
export const PROSE_LINK =
  'rounded text-content-brand underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** A raised card, the site's one card surface. */
export const CARD = 'rounded-[28px] bg-surface-raised shadow-elevation-1';

/** Text field and select, matching the help page's search. */
export const FIELD =
  'h-12 w-full rounded-full border-[1.5px] border-line-strong bg-surface-raised px-5 text-body-md text-content-primary ' +
  'placeholder:text-content-muted focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink';

export default SitePage;
