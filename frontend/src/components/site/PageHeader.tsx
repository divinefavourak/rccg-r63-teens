import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import FloatingObject from './FloatingObject';
import { fadeUp, stagger } from './motion';
import Breadcrumbs, { type Crumb } from './Breadcrumbs';

type Props = {
  /** Small caps tag above the heading, e.g. "DAILY DEVOTIONAL". */
  eyebrow: string;
  /** The page's one <h1>. */
  title: ReactNode;
  intro?: ReactNode;
  /** A pop colour class for the card, e.g. "bg-pop-violet". */
  tone: string;
  /** The 3D object that sits on the card. Leave out when `aside` fills the corner. */
  object?: string;
  /** Visible trail. The BreadcrumbList structured data comes from <Seo trail>. */
  trail?: Crumb[];
  /** Extra line under the intro, e.g. the "last updated" date. */
  meta?: ReactNode;
  /** Shown beside the text on desktop and under it on phones (an event flier). */
  aside?: ReactNode;
  /** Under the intro, inside the card: chips, buttons. */
  children?: ReactNode;
};

/**
 * The colour card that opens every website page other than the landing page.
 * It replaces the hero there; there is no Figma frame for these pages, so it is
 * composed from the landing page's tokens, type styles and motion.
 */
const PageHeader = ({ eyebrow, title, intro, tone, object, trail, meta, aside, children }: Props) => (
  <section className="px-4 pt-1 lg:px-10 lg:py-4">
    <m.div
      initial="hidden"
      animate="show"
      variants={stagger(0.08, 0.05)}
      className={`group relative mx-auto flex w-full max-w-[640px] flex-col gap-6 rounded-[36px] px-6 py-8 text-pop-on lg:max-w-[1200px] lg:flex-row lg:items-center lg:gap-12 lg:rounded-[48px] lg:p-16 ${tone}`}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-4 lg:gap-6">
        {trail && (
          <m.div variants={fadeUp}>
            <Breadcrumbs trail={trail} />
          </m.div>
        )}
        <m.p
          variants={fadeUp}
          className="rounded-full bg-ink px-3 py-1.5 text-label-sm tracking-[0.08em] text-on-ink lg:px-3.5 lg:tracking-[0.1em]"
        >
          {eyebrow}
        </m.p>
        <m.h1
          variants={fadeUp}
          className={`max-w-[820px] text-display-lg lg:text-[clamp(3rem,4.86vw,4.375rem)] lg:leading-[1.06] lg:tracking-[-0.035em] ${object && !aside ? 'pr-16 lg:pr-0' : ''}`}
        >
          {title}
        </m.h1>
        {intro && (
          <m.p variants={fadeUp} className="max-w-[640px] text-body-md lg:text-body-lg">
            {intro}
          </m.p>
        )}
        {meta && (
          <m.p variants={fadeUp} className="text-label-md">
            {meta}
          </m.p>
        )}
        {children && (
          <m.div variants={fadeUp} className="flex w-full flex-col items-start gap-4">
            {children}
          </m.div>
        )}
      </div>
      {aside && (
        <m.div variants={fadeUp} className="w-full shrink-0 lg:w-[400px]">
          {aside}
        </m.div>
      )}
      {object && !aside && (
        <FloatingObject
          src={object}
          eager
          className="absolute -top-3 right-3 size-20 lg:right-16 lg:top-12 lg:size-[180px]"
        />
      )}
    </m.div>
  </section>
);

export default PageHeader;
