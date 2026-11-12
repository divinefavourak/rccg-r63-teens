/**
 * The questions on the help page, in the order the page shows them.
 *
 * They live here, away from the component, for one reason: the build script
 * writes the same answers into `/help` as structured data and as the no-JavaScript
 * fallback, and the page a search engine reads has to say what the page a person
 * reads says. One array, two consumers.
 *
 * `tone` is the pop colour on the topic's heading card. `link` is where a reader
 * goes to act on the answer; every destination must exist in `App.tsx`.
 */
import { SITE } from '../seo/site.mjs';

export const FAQ_TOPICS = [
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
        a: `Email ${SITE.contact.email} from the address on your account and ask us to delete it. We will remove your personal details. A parent or guardian can also ask for you.`,
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
        a: 'Payments go through Squad. We never see your card details. You get your ticket once the payment is confirmed.',
      },
      {
        q: 'I paid but I have no ticket.',
        a: 'Confirmation can take a few minutes. Check the status of your ticket first. If it still has not arrived, email us with the name used to register and your payment reference.',
        link: { label: 'Check a ticket', to: '/ticket-not-found' },
      },
      {
        q: 'Can I get a refund or change my registration?',
        a: `Contact the organisers at ${SITE.contact.email} as early as you can. Refunds and changes are decided by the event’s organisers.`,
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
        a: `Tell a parent, guardian or a leader you trust, and tell us at ${SITE.contact.email}. If you or someone else is in danger right now, contact the emergency services. Faith Tribe is not an emergency service.`,
      },
      {
        q: 'I am a parent. Can I see or remove my child’s information?',
        a: `Yes. Email ${SITE.contact.email} or call ${SITE.contact.phone} and we will help you see it, correct it or have the account deleted.`,
      },
    ],
  },
];

/** Every question, flattened — the shape FAQPage wants. */
export const FAQ_QUESTIONS = FAQ_TOPICS.flatMap((topic) => topic.questions);
