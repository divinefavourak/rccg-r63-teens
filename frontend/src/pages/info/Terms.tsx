import { OBJECTS } from '../../assets/site';
import InfoShell from '../../components/site/InfoShell';
import LegalDocument, { A, B, List, P, To, type LegalSection } from '../../components/site/LegalDocument';
import { useHashScroll } from '../../components/site/useHashScroll';
import { LEGAL_UPDATED, SITE_CONTACT } from '../../constants/site';

const MAIL = `mailto:${SITE_CONTACT.email}`;

/*
  The rules for using Faith Tribe. Written to match what the product does today:
  accounts, readings, the Bible, events with Squad payments, and the Console.

  Two sections state the church's position rather than describing code, and
  should be confirmed by Region 63 leadership before this is relied on:
  "Events, tickets and payments" (refunds) and "If something goes wrong".

  It has not been reviewed by a lawyer. See the pull request that added it.
*/
const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Using Faith Tribe',
    summary: 'By using Faith Tribe you agree to these rules. If you are under 18, a parent or guardian should agree too.',
    body: (
      <>
        <P>
          Faith Tribe is the website and app of {SITE_CONTACT.organisation}. These terms are the agreement
          between you and us for using it. They apply to the website, the app, and the Console that leaders use.
        </P>
        <P>
          If you are under 18, please read them with a parent or guardian. By creating an account you are telling
          us that they are happy for you to use Faith Tribe.
        </P>
        <P>If you do not agree with these terms, please do not use Faith Tribe.</P>
      </>
    ),
  },
  {
    id: 'who-its-for',
    title: 'Who it is for',
    summary: 'Teens aged 13 to 19 in RCCG Region 63, and the leaders who serve them. It is free.',
    body: (
      <>
        <P>
          Faith Tribe is made for teenagers aged 13 to 19 in RCCG Region 63, and for the teachers, coordinators
          and pastors who serve them. Anyone can read the daily reading without an account.
        </P>
        <P>
          Reading, the Bible and your account are free. Some events have a ticket price, which is always shown
          before you pay.
        </P>
      </>
    ),
  },
  {
    id: 'your-account',
    title: 'Your account',
    summary: 'Give us true details, keep your password to yourself, and tell us if someone else gets in.',
    body: (
      <List
        items={[
          'Give your real name and correct details. Leaders use them to know who is in their parish and to keep events safe.',
          'One account per person. Do not create an account for someone else, or pretend to be someone else.',
          'Keep your password private. You are responsible for what happens on your account.',
          <>
            If you think someone else has used your account, change your password and email{' '}
            <A href={MAIL}>{SITE_CONTACT.email}</A>.
          </>,
          'Keep your details up to date, especially your phone number and parish.',
        ]}
      />
    ),
  },
  {
    id: 'being-kind',
    title: 'How to behave here',
    summary: 'Treat this like church. Be kind, be honest, and do not try to break things.',
    body: (
      <>
        <P>When you use Faith Tribe, do not:</P>
        <List
          items={[
            'Bully, threaten, harass or embarrass anyone.',
            'Post or send anything hateful, sexual, violent or illegal.',
            'Share another person’s private information.',
            'Use someone else’s account or ticket.',
            'Try to get into parts of the service you are not allowed into, or get around its security.',
            'Copy large amounts of content with scripts or bots, or overload the service.',
            'Use Faith Tribe to sell things or advertise.',
          ]}
        />
        <P>
          If you see something that worries you, or something that makes you feel unsafe, tell a leader you trust
          or email <A href={MAIL}>{SITE_CONTACT.email}</A>.
        </P>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Readings, the Bible and other content',
    summary: 'Use it for yourself, your family and your church. Share verses freely. Do not sell it or pass it off as yours.',
    body: (
      <>
        <P>
          The devotionals, manuals, articles, audio, video and artwork in Faith Tribe belong to{' '}
          {SITE_CONTACT.organisation} or to the people who made them for us.
        </P>
        <List
          items={[
            'You may read, watch, listen and share them for personal, family and church use.',
            'Please do not sell them, republish them elsewhere, or remove the credit.',
            <>
              <B>The Bible.</B> The World English Bible is in the public domain. Other translations are used under
              their own terms.
            </>,
            <>
              <B>Anything you add,</B> such as a profile photo or bio, stays yours. You let us show it inside Faith
              Tribe, and you must have the right to use it.
            </>,
          ]}
        />
        <P>We may remove content that breaks these terms.</P>
      </>
    ),
  },
  {
    id: 'events',
    title: 'Events, tickets and payments',
    summary: 'Prices are shown before you pay. Payments go through Squad. For a refund or a change, ask the organisers.',
    body: (
      <>
        <List
          items={[
            'The price, date and place of an event are shown before you register. Details can change, and we will tell you if they do.',
            'Payments are handled by Squad. We do not see or keep your card details.',
            'A ticket is for the person named on it. Bring it with you. It is checked at the door.',
            'The details you give when registering must be true, including guardian, emergency and medical information. They are used to keep you safe.',
            'If you are under 18, a parent or guardian must agree to you attending.',
            <>
              <B>Refunds and changes.</B> If you cannot attend, or an event is cancelled, contact the organisers at{' '}
              <A href={MAIL}>{SITE_CONTACT.email}</A>. Refunds are decided by the event’s organisers.
            </>,
          ]}
        />
        <P>Each event may have its own rules, such as a camp code of conduct. Those apply as well as these terms.</P>
      </>
    ),
  },
  {
    id: 'leaders',
    title: 'If you are a leader',
    summary: 'The Console gives you access to young people’s information. Use it only for your ministry role, and guard it.',
    body: (
      <>
        <P>Teachers, coordinators and pastors who use the Console also agree to the following.</P>
        <List
          items={[
            'Use what you can see only to serve the teens in your care and to run your part of the church.',
            'Do not copy, export or share teens’ personal information outside the Console, unless your role requires it.',
            'Do not share your sign-in. Your access is yours alone and what you do is logged.',
            'Tell us straight away if you see information you should not have access to.',
            'Your access ends when your role ends.',
          ]}
        />
        <P>
          How that information is handled is set out in our <To to="/privacy">Privacy notice</To>.
        </P>
      </>
    ),
  },
  {
    id: 'if-something-goes-wrong',
    title: 'If something goes wrong',
    summary: 'We work hard to keep Faith Tribe running and correct, but we cannot promise it will never fail.',
    body: (
      <>
        <P>
          Faith Tribe is run by a church team. We do our best to keep it available, accurate and secure, but we
          provide it as it is. It may be unavailable at times, and it may contain mistakes.
        </P>
        <P>
          As far as the law allows, we are not responsible for loss that comes from the service being unavailable
          or from relying on it. Nothing in these terms takes away rights the law gives you.
        </P>
        <P>
          Faith Tribe is not an emergency service. If you or someone else is in danger, tell a trusted adult or
          contact the emergency services straight away.
        </P>
      </>
    ),
  },
  {
    id: 'ending',
    title: 'Closing an account',
    summary: 'You can leave whenever you like. We may suspend an account that breaks these rules.',
    body: (
      <>
        <P>
          You can stop using Faith Tribe at any time. To have your account and information deleted, email{' '}
          <A href={MAIL}>{SITE_CONTACT.email}</A>.
        </P>
        <P>
          We may suspend or close an account that breaks these terms, or where we need to in order to keep people
          safe. Where we can, we will tell you why.
        </P>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    summary: 'We will tell you in the app when these terms change in a way that matters. Nigerian law applies.',
    body: (
      <>
        <P>
          We may update these terms as Faith Tribe grows. We will change the date at the top, and tell you in the
          app about anything important. Carrying on using Faith Tribe after a change means you accept it.
        </P>
        <P>These terms are governed by the laws of the Federal Republic of Nigeria.</P>
        <P>
          Questions? Email <A href={MAIL}>{SITE_CONTACT.email}</A> or call{' '}
          <A href={SITE_CONTACT.phoneHref}>{SITE_CONTACT.phone}</A>. The <To to="/help">Help page</To> answers the
          common ones.
        </P>
      </>
    ),
  },
];

const Terms = () => {
  // Lets a link such as /privacy#your-rights open at that section.
  useHashScroll();

  return (
    <InfoShell
      seoTitle="Terms"
      seoDescription="The rules for using Faith Tribe: accounts, how to behave, content, events and payments, and what leaders agree to."
      path="/terms"
      eyebrow="TERMS"
      title="The rules, kept short."
      intro="What you agree to when you use Faith Tribe, and what we agree to in return. Each section starts with the short version."
      meta={`Last updated ${LEGAL_UPDATED}`}
      tone="bg-pop-amber"
      object={OBJECTS.fileText}
    >
      <LegalDocument sections={SECTIONS} />
    </InfoShell>
  );
};

export default Terms;
