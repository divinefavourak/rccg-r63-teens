import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import Seo from '../Seo';
import FloatingObject from './FloatingObject';
import MotionRoot, { ScrollProgress } from './MotionRoot';
import SiteFooter from './SiteFooter';
import SiteNav from './SiteNav';
import { fadeUp, stagger } from './motion';

type Props = {
  /** Browser tab title and search-result title. */
  seoTitle: string;
  seoDescription: string;
  path: string;
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
 * Same nav, footer, surfaces and motion as the landing page, with a colour card
 * for a header in place of the hero. There is no Figma frame for these pages,
 * so they are composed from the landing page's parts and tokens.
 */
const InfoShell = ({
  seoTitle,
  seoDescription,
  path,
  eyebrow,
  title,
  intro,
  tone,
  object,
  meta,
  children,
}: Props) => (
  <MotionRoot>
    <div className="flex min-h-screen flex-col bg-surface-base font-sans text-content-primary antialiased">
      <Seo title={seoTitle} description={seoDescription} path={path} />
      <ScrollProgress />
      <SiteNav />
      <main className="flex-1">
        <section className="px-4 pt-1 lg:px-10 lg:py-4">
          <m.div
            initial="hidden"
            animate="show"
            variants={stagger(0.08, 0.05)}
            className={`group relative mx-auto flex w-full max-w-[640px] flex-col items-start gap-4 rounded-[36px] px-6 py-8 text-pop-on lg:max-w-[1200px] lg:gap-6 lg:rounded-[48px] lg:p-16 ${tone}`}
          >
            <m.p
              variants={fadeUp}
              className="rounded-full bg-ink px-3 py-1.5 text-label-sm tracking-[0.08em] text-on-ink lg:px-3.5 lg:tracking-[0.1em]"
            >
              {eyebrow}
            </m.p>
            <m.h1
              variants={fadeUp}
              className="max-w-[820px] pr-16 text-display-lg lg:pr-0 lg:text-[clamp(3rem,4.86vw,4.375rem)] lg:leading-[1.06] lg:tracking-[-0.035em]"
            >
              {title}
            </m.h1>
            <m.p variants={fadeUp} className="max-w-[640px] text-body-md lg:text-body-lg">
              {intro}
            </m.p>
            {meta && (
              <m.p variants={fadeUp} className="text-label-md">
                {meta}
              </m.p>
            )}
            <FloatingObject
              src={object}
              eager
              className="absolute -top-3 right-3 size-20 lg:right-16 lg:top-12 lg:size-[180px]"
            />
          </m.div>
        </section>
        {children}
      </main>
      <SiteFooter />
    </div>
  </MotionRoot>
);

export default InfoShell;
