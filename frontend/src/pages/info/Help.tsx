import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { m } from 'framer-motion';
import { ILLUSTRATIONS, OBJECTS } from '../../assets/site';
import FloatingObject from '../../components/site/FloatingObject';
import { Art } from '../../components/site/Glyph';
import InfoShell from '../../components/site/InfoShell';
import SiteButton from '../../components/site/SiteButton';
import { IN_VIEW, fadeUp, stagger, zoomIn } from '../../components/site/motion';
import { SITE_CONTACT } from '../../constants/site';
import { FAQ_QUESTIONS, FAQ_TOPICS, type FaqQuestion } from '../../../content/faq.mjs';
import { faqLd } from '../../../seo/schema.mjs';

/** The questions themselves live in content/faq.mjs. The build writes the same
 *  answers into the help page as FAQPage structured data and as the
 *  no-JavaScript version of the page, and all three have to agree. */
const matches = (question: FaqQuestion, term: string) =>
  `${question.q} ${question.a}`.toLowerCase().includes(term);

const Item = ({ question, open, onToggle }: { question: FaqQuestion; open: boolean; onToggle: () => void }) => {
  const panelId = useId();

  return (
    <m.li variants={fadeUp} className="rounded-3xl bg-surface-raised shadow-elevation-1">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center gap-3 rounded-3xl p-4 text-left text-body-md-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:p-5"
        >
          <span className="min-w-0 flex-1">{question.q}</span>
          <span
            aria-hidden
            className={clsx(
              'grid size-8 shrink-0 place-items-center rounded-full text-title-md transition-transform duration-300',
              open ? 'rotate-45 bg-ink text-on-ink' : 'bg-surface-sunken',
            )}
          >
            +
          </span>
        </button>
      </h3>
      {/* .collapsible (index.css) animates to the answer's own height. `inert`
          keeps the link inside a closed answer out of the tab order. */}
      <div id={panelId} inert={!open} className={clsx('collapsible', open && 'is-open')}>
        <div>
          <div className="flex flex-col items-start gap-3 px-4 pb-4 lg:px-5 lg:pb-5">
            <p className="text-body-md text-content-secondary">{question.a}</p>
            {question.link && (
              <Link
                to={question.link.to}
                className="rounded-full text-label-md text-content-brand underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {question.link.label} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </m.li>
  );
};

const Help = () => {
  const [search, setSearch] = useState('');
  // One answer open at a time, keyed by its question. Null means all closed.
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const searchId = useId();

  const term = search.trim().toLowerCase();
  const topics = useMemo(
    () =>
      FAQ_TOPICS.map((topic) => ({
        ...topic,
        questions: term ? topic.questions.filter((question) => matches(question, term)) : topic.questions,
      })).filter((topic) => topic.questions.length > 0),
    [term],
  );
  const total = topics.reduce((sum, topic) => sum + topic.questions.length, 0);

  return (
    <InfoShell
      path="/help"
      seoJsonLd={faqLd({ url: '/help', questions: FAQ_QUESTIONS })}
      eyebrow="HELP"
      title="How can we help?"
      intro="Answers to the questions we hear most. If yours is not here, write to us. A real person will reply."
      tone="bg-pop-sky"
      object={OBJECTS.bulb}
    >
      <div className="px-5 py-10 lg:px-10 lg:py-24">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-10 lg:max-w-[1200px] lg:gap-16">
          <div className="flex flex-col gap-2">
            <label htmlFor={searchId} className="text-label-md">
              Search the answers
            </label>
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Try “password” or “ticket”"
              className="h-14 w-full max-w-[560px] rounded-full border-[1.5px] border-line-strong bg-surface-raised px-6 text-body-md text-content-primary placeholder:text-content-muted focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            />
            {/* Announced politely, so a screen reader user hears the list change. */}
            <p aria-live="polite" className="text-body-sm text-content-muted">
              {term ? `${total} ${total === 1 ? 'answer' : 'answers'} for “${search.trim()}”` : ' '}
            </p>
          </div>

          {topics.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-[32px] bg-surface-sunken p-6 lg:p-10">
              <Art art={ILLUSTRATIONS.clumsy} className="size-[160px]" />
              <h2 className="text-title-lg">Nothing matches that yet.</h2>
              <p className="text-body-md text-content-secondary">
                Try a different word, or write to us and we will answer you directly.
              </p>
              <SiteButton to={`mailto:${SITE_CONTACT.email}`}>Email us</SiteButton>
            </div>
          ) : (
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-16">
              {FAQ_TOPICS.map((topic) => (
                // Keyed on the search term as well, so a filtered list replays
                // its entrance instead of staying wherever the old one left it.
                <m.section
                  key={`${topic.title}-${term}`}
                  {...IN_VIEW}
                  variants={stagger(0.06)}
                  className="flex flex-col gap-4"
                >
                  <m.h2 variants={fadeUp} className="flex items-center gap-3 text-title-lg lg:text-display">
                    <span aria-hidden className={`size-4 shrink-0 rounded-full ${topic.tone}`} />
                    {topic.title}
                  </m.h2>
                  <ul className="flex flex-col gap-3">
                    {topic.questions.map((question) => (
                      <Item
                        key={question.q}
                        question={question}
                        open={openQuestion === question.q}
                        onToggle={() => setOpenQuestion((current) => (current === question.q ? null : question.q))}
                      />
                    ))}
                  </ul>
                </m.section>
              ))}
            </div>
          )}

          <m.section
            {...IN_VIEW}
            variants={zoomIn}
            className="group relative flex flex-col items-start gap-4 rounded-[32px] bg-ink p-6 text-on-ink lg:flex-row lg:items-center lg:gap-10 lg:rounded-[48px] lg:px-14 lg:py-12"
          >
            <div className="flex flex-col gap-2 lg:min-w-0 lg:flex-1">
              <h2 className="text-title-lg lg:text-display">Still stuck?</h2>
              <p className="text-body-md lg:text-body-lg">
                Write to {SITE_CONTACT.organisation}. Tell us what you were trying to do and what happened.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
              <SiteButton to={`mailto:${SITE_CONTACT.email}`} variant="accent" className="w-full lg:w-auto">
                Email us
              </SiteButton>
              <a
                href={SITE_CONTACT.phoneHref}
                className="inline-flex h-[52px] w-full items-center justify-center whitespace-nowrap rounded-full border-[1.5px] border-on-ink px-7 text-body-md-strong text-on-ink transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink lg:h-14 lg:w-auto"
              >
                Call {SITE_CONTACT.phone}
              </a>
            </div>
            <FloatingObject src={OBJECTS.mail} className="absolute -top-10 right-11 hidden size-24 lg:block" />
          </m.section>
        </div>
      </div>
    </InfoShell>
  );
};

export default Help;
