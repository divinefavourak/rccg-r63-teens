import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { m } from 'framer-motion';
import FloatingObject from './FloatingObject';
import { IN_VIEW, fadeUp, stagger } from './motion';
import { CARD, Section } from './SitePage';

/**
 * The prose section under a list: what the content is, who makes it, how often
 * it changes. A grid of cards says what things are called and nothing about
 * what they are, and that missing paragraph is what a reader deciding whether
 * to come back, and a search engine, both need.
 */
export const AboutSection = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) => (
  <Section narrow aria-labelledby={id} className="pt-16 lg:pt-24">
    <m.div {...IN_VIEW} variants={stagger(0.08)} className="flex flex-col gap-4">
      <m.h2 variants={fadeUp} id={id} className="text-display lg:text-display-lg">
        {title}
      </m.h2>
      <m.div variants={fadeUp} className="flex flex-col gap-4 text-body-md text-content-secondary lg:text-body-lg">
        {children}
      </m.div>
    </m.div>
  </Section>
);

/** A row of links to the other parts of the site, as cards. */
export const NextLinks = ({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string; note: string }[];
}) => (
  <Section narrow className="pt-10">
    <m.div {...IN_VIEW} variants={stagger(0.06)} className="flex flex-col gap-4">
      <m.h2 variants={fadeUp} className="text-title-lg">
        {title}
      </m.h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <m.li key={link.to} variants={fadeUp}>
            <Link
              to={link.to}
              className={`${CARD} flex h-full flex-col gap-1 p-5 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
            >
              <span className="text-title-sm">{link.label} →</span>
              <span className="text-body-sm text-content-secondary">{link.note}</span>
            </Link>
          </m.li>
        ))}
      </ul>
    </m.div>
  </Section>
);

/** Pill toggle for list filters. Announced as a group of pressed buttons. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-full bg-surface-sunken p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              'h-10 rounded-full px-4 text-label-md transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:px-5',
              active ? 'bg-ink text-on-ink' : 'text-content-secondary hover:text-content-primary',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Nothing to show: an object, a sentence, and optionally a way out. */
export const EmptyState = ({
  object,
  title,
  children,
}: {
  object: string;
  title: string;
  children?: ReactNode;
}) => (
  <m.div
    initial="hidden"
    animate="show"
    variants={stagger(0.08)}
    className={`${CARD} group flex flex-col items-center gap-3 px-6 py-12 text-center`}
  >
    <FloatingObject src={object} className="size-24" />
    <m.p variants={fadeUp} className="text-title-md">
      {title}
    </m.p>
    {children && (
      <m.div variants={fadeUp} className="max-w-[440px] text-body-md text-content-secondary">
        {children}
      </m.div>
    )}
  </m.div>
);

/** Placeholder cards while a list loads, at the height of the real ones. */
export const SkeletonGrid = ({ count = 6, height = 'h-72' }: { count?: number; height?: string }) => (
  <div aria-busy="true" aria-label="Loading" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className={`${height} animate-pulse rounded-[28px] bg-surface-sunken`} />
    ))}
  </div>
);
