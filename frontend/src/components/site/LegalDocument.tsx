import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { m } from 'framer-motion';
import { IN_VIEW, fadeUp } from './motion';

export type LegalSection = {
  /** Used as the anchor, so keep it stable: other pages and emails link to it. */
  id: string;
  title: string;
  /** One or two plain sentences. Someone who reads only these should still get it right. */
  summary: string;
  body: ReactNode;
};

/** Body paragraph. */
export const P = ({ children }: { children: ReactNode }) => (
  <p className="text-body-md text-content-secondary">{children}</p>
);

/** Bulleted list. */
export const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="flex flex-col gap-2">
    {items.map((item, i) => (
      <li key={i} className="flex gap-3 text-body-md text-content-secondary">
        <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/** A term being defined, or a category label at the start of a list item. */
export const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-content-primary">{children}</strong>
);

const LINK =
  'font-semibold text-content-brand underline underline-offset-4 hover:no-underline ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** Inline link. Use for mailto:, tel: and external addresses. */
export const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className={LINK}>
    {children}
  </a>
);

/** Inline link to another page of the site. */
export const To = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className={LINK}>
    {children}
  </Link>
);

/**
 * Which section is being read. Watches a thin band near the top of the window
 * rather than listening to scroll, so nothing runs on every scroll frame.
 */
const useActiveSection = (ids: string[]) => {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      // The band runs from 15% to 30% down the window. A section is "current"
      // while its body crosses that band.
      { rootMargin: '-15% 0px -70% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // The id list is static for the life of a page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);

  return active;
};

/**
 * A long policy laid out for reading: numbered sections, each opening with an
 * "In short" line in plain words, and a contents list that follows along on
 * desktop. docs/13-community.md asks for a notice a teenager can read, which is
 * what the summaries are for.
 */
const LegalDocument = ({ sections }: { sections: LegalSection[] }) => {
  const active = useActiveSection(sections.map((s) => s.id));

  return (
    <div className="px-5 py-10 lg:px-10 lg:py-24">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8 lg:max-w-[1200px] lg:flex-row lg:items-start lg:gap-16">
        {/* Phones: a closed list above the text. Desktop: a column that stays put. */}
        <details className="group rounded-3xl bg-surface-sunken p-4 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between text-body-md-strong [&::-webkit-details-marker]:hidden">
            On this page
            <span aria-hidden className="text-title-md transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <ol className="mt-3 flex flex-col gap-1">
            {sections.map((section, i) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="block rounded-xl px-2 py-2 text-body-md text-content-secondary">
                  {i + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </details>

        <nav aria-label="On this page" className="sticky top-8 hidden w-[280px] shrink-0 lg:block">
          <p className="mb-3 text-label-sm tracking-[0.1em] text-content-muted">ON THIS PAGE</p>
          <ol className="flex flex-col gap-1">
            {sections.map((section, i) => {
              const isActive = section.id === active;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={clsx(
                      'flex gap-3 rounded-full px-4 py-2 text-label-md transition-colors duration-200',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                      isActive ? 'bg-ink text-on-ink' : 'text-content-secondary hover:bg-surface-sunken',
                    )}
                  >
                    <span aria-hidden className="w-5 shrink-0 tabular-nums">
                      {i + 1}
                    </span>
                    {section.title}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <article className="flex min-w-0 flex-1 flex-col gap-12 lg:max-w-[760px] lg:gap-16">
          {sections.map((section, i) => (
            <m.section
              key={section.id}
              id={section.id}
              {...IN_VIEW}
              variants={fadeUp}
              className="flex scroll-mt-8 flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-title-sm text-on-ink"
                >
                  {i + 1}
                </span>
                <h2 className="text-title-lg lg:text-display">{section.title}</h2>
              </div>
              <div className="rounded-3xl bg-surface-sunken p-5">
                <p className="mb-1 text-label-sm tracking-[0.1em] text-content-muted">IN SHORT</p>
                <p className="text-body-md-strong">{section.summary}</p>
              </div>
              {section.body}
            </m.section>
          ))}
        </article>
      </div>
    </div>
  );
};

export default LegalDocument;
