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

type Question = {
  q: string;
  /** Plain text, so the search box can match against it. */
  a: string;
  /** Where to go to act on the answer. */
  link?: { label: string; to: string };
};

type Topic = { title: string; tone: string; questions: Question[] };

/*
  Answers describe what the product does today. Routes named here must exist in
  App.tsx. If one is renamed, this file is the other place to change.
*/
const TOPICS: Topic[] = [
  {
    title: 'Getting started',
    tone: 'bg-pop-green',
    questions: [
      {
        q: 'What is Faith Tribe?',
        a: 'It is the app of RCCG Region 63 Junior Church. Each day there is one short reading with a verse to keep. You also get the whole Bible, a library of things to read, watch and listen to, and the events happening in your part of the church.',
      },
      {
        q: 'Does it cost anything?',
        a: 'No. Reading, the Bible and your account are free. Some events have a ticket price, and you always see it before you pay.',
      },
      {
        q: 'Do I need an account?',
        a: 'Not to read. Anyone can open today’s reading. An account lets you keep your streak, save your place and register for events.',
        link: { label: 'Create an account', to: '/register' },
      },
      {
        q: 'How do I put it on my phone?',
        a: 'Open this site in Chrome on Android or Safari on iPhone. Open the browser menu and choose “Add to Home screen”. It then opens from your home screen like any other app.',
      },
    ],
  },
  {
    title: 'Your account',
    tone: 'bg-pop-violet',
    questions: [
      {
        q: 'I forgot my password.',
        a: 'Ask for a reset and we will email you instructions. Use the email address you signed up with, and check your spam folder if it does not arrive within a few minutes.',
        link: { label: 'Reset my password', to: '/forgot-password' },
      },
      {
        q: 'How do I change my details or my parish?',
        a: 'Sign in and open your settings. You can change your name, phone number, photo and church details there. If you have moved parish, update it so you see the right events.',
        link: { label: 'Open settings', to: '/dashboard/settings' },
      },
      {
        q: 'My account is locked.',
        a: 'After several wrong passwords in a row, an account is locked for a short while to keep it safe. Wait a little, then try again or reset your password.',
        link: { label: 'Reset my password', to: '/forgot-password' },
      },
      {
        q: 'How do I delete my account?',
        a: `Email ${SITE_CONTACT.email} from the address on your account and ask us to delete it. We will remove your personal details. A parent or guardian can also ask for you.`,
        link: { label: 'Read the privacy notice', to: '/privacy' },
      },
    ],
  },
  {
    title: 'Reading and the Bible',
    tone: 'bg-pop-amber',
    questions: [
      {
        q: 'When does the daily reading change?',
        a: 'A new reading is ready every morning. Yesterday’s readings stay available, so you can catch up.',
        link: { label: 'Read today’s reading', to: '/devotionals' },
      },
      {
        q: 'What is a streak?',
        a: 'It counts the days in a row you have finished the reading. It is there to encourage you, not to judge you. If it resets, you simply start again.',
      },
      {
        q: 'Which Bible translations are there?',
        a: 'The World English Bible and the King James Version.',
      },
    ],
  },
  {
    title: 'Events and tickets',
    tone: 'bg-pop-sky',
    questions: [
      {
        q: 'How do I register for an event?',
        a: 'Open the event, choose Register and fill in the form. If you are under 18 you will be asked for a parent or guardian’s details. If the event has a price, you pay at the end.',
        link: { label: 'See events', to: '/events' },
      },
      {
        q: 'How do I pay?',
        a: 'Payments go through Paystack. We never see your card details. You get your ticket once the payment is confirmed.',
      },
      {
        q: 'I paid but I have no ticket.',
        a: 'Confirmation can take a few minutes. Check the status of your ticket first. If it still has not arrived, email us with the name used to register and your payment reference.',
        link: { label: 'Check a ticket', to: '/ticket-not-found' },
      },
      {
        q: 'Can I get a refund or change my registration?',
        a: `Contact the organisers at ${SITE_CONTACT.email} as early as you can. Refunds and changes are decided by the event’s organisers.`,
      },
    ],
  },
  {
    title: 'For leaders',
    tone: 'bg-pop-lime',
    questions: [
      {
        q: 'What is the Console?',
        a: 'It is where leaders publish readings, plan events, check teens in at the door and see how their part of the church is doing. Teacher tools work on a phone. The full Console is best on a computer.',
        link: { label: 'Open the Console', to: '/admin' },
      },
      {
        q: 'I signed in but it says I have no role.',
        a: 'A role has to be given to you by a coordinator or pastor above you. Ask them to assign your role for your parish, zone or province. It takes effect the next time you open the Console.',
      },
      {
        q: 'What can I see about the teens in my care?',
        a: 'Only what your role and your part of the church allow. Treat it as you would a paper register: use it for your ministry and do not share it. The details are in the privacy notice.',
        link: { label: 'Read the privacy notice', to: '/privacy' },
      },
    ],
  },
  {
    title: 'Safety and privacy',
    tone: 'bg-pop-pink',
    questions: [
      {
        q: 'Who can see my information?',
        a: 'Leaders in your own part of the church can see your details and your event registrations. They see activity as totals, not a record of what you read. No adult can message you privately in Faith Tribe.',
        link: { label: 'Read the privacy notice', to: '/privacy' },
      },
      {
        q: 'Something made me feel unsafe. What do I do?',
        a: `Tell a parent, guardian or a leader you trust, and tell us at ${SITE_CONTACT.email}. If you or someone else is in danger right now, contact the emergency services. Faith Tribe is not an emergency service.`,
      },
      {
        q: 'I am a parent. Can I see or remove my child’s information?',
        a: `Yes. Email ${SITE_CONTACT.email} or call ${SITE_CONTACT.phone} and we will help you see it, correct it or have the account deleted.`,
      },
    ],
  },
];

const matches = (question: Question, term: string) =>
  `${question.q} ${question.a}`.toLowerCase().includes(term);

const Item = ({ question, open, onToggle }: { question: Question; open: boolean; onToggle: () => void }) => {
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
      TOPICS.map((topic) => ({
        ...topic,
        questions: term ? topic.questions.filter((question) => matches(question, term)) : topic.questions,
      })).filter((topic) => topic.questions.length > 0),
    [term],
  );
  const total = topics.reduce((sum, topic) => sum + topic.questions.length, 0);

  return (
    <InfoShell
      seoTitle="Help"
      seoDescription="Answers about Faith Tribe: getting started, your account, the daily reading, events and tickets, the Console for leaders, and staying safe."
      path="/help"
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
              {topics.map((topic) => (
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
