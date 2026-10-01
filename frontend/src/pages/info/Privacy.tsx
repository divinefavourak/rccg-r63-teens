import { OBJECTS } from '../../assets/site';
import InfoShell from '../../components/site/InfoShell';
import LegalDocument, { A, B, List, P, To, type LegalSection } from '../../components/site/LegalDocument';
import { useHashScroll } from '../../components/site/useHashScroll';
import { LEGAL_UPDATED, SITE_CONTACT } from '../../constants/site';

const MAIL = `mailto:${SITE_CONTACT.email}`;

/*
  Every statement below describes something the product actually does. When the
  product changes, this page has to change with it. The places to check:

  - What is collected:  backend/users/models.py, backend/profiles/models.py,
                        backend/progress/models.py, backend/payments/models.py,
                        backend/notifications/models.py
  - Who it is shared with: the services configured in backend/backend/settings.py
                        (Paystack, Brevo, Cloudflare R2) and <Analytics /> in App.tsx
  - What sits on the device: the localStorage keys in api/axios.ts and hooks/useTheme.ts
  - The promises about leaders and private data: docs/13-community.md, "Privacy"

  It has not been reviewed by a lawyer. See the pull request that added it.
*/
const SECTIONS: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    summary:
      'Faith Tribe is run by RCCG Region 63 Junior Church. We decide how your information is used, and we are the people to ask about it.',
    body: (
      <>
        <P>
          Faith Tribe is the website and app of {SITE_CONTACT.organisation}, part of The Redeemed Christian Church
          of God. When this page says “we”, it means the Region 63 Junior Church team that runs it.
        </P>
        <P>
          This notice covers the Faith Tribe website, the app, and the Console that leaders use. Questions about
          any of it can go to <A href={MAIL}>{SITE_CONTACT.email}</A>.
        </P>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    summary:
      'What you tell us when you sign up, what you do in the app, and extra details only when you register for an event.',
    body: (
      <>
        <P>We try to ask only for what the ministry needs. Here is all of it.</P>
        <List
          items={[
            <>
              <B>Your account.</B> Your name, username, email address, phone number, gender, and your date of
              birth or age group.
            </>,
            <>
              <B>Your church.</B> Your province, zone, area and parish, so you see the right events and the right
              leaders can find you.
            </>,
            <>
              <B>Your profile, if you add it.</B> A photo and a short bio. Both are optional.
            </>,
            <>
              <B>What you do in the app.</B> Which readings you finish and on which days, your streak, and when you
              were last active.
            </>,
            <>
              <B>Event registrations.</B> When you register for an event we ask for a parent or guardian’s name,
              phone, email and relationship to you, and an emergency contact. Some events, such as camps, also ask
              about medical conditions, allergies, medication, dietary needs and blood group, so the people
              looking after you can keep you safe.
            </>,
            <>
              <B>Payments.</B> The amount, a payment reference, and the payer’s name, email and phone. Card details
              go straight to our payment provider. We never see or store your card number.
            </>,
            <>
              <B>Your device.</B> Your IP address and browser type when you sign in or pay, and a record of sign-in
              attempts. If you turn on notifications, we store the address your browser gives us to send them to.
            </>,
            <>
              <B>Your settings.</B> Which reminders you want and when, including quiet hours.
            </>,
          ]}
        />
        <P>You can read the daily reading without an account. In that case we collect none of the above about you.</P>
      </>
    ),
  },
  {
    id: 'why-we-use-it',
    title: 'Why we use it',
    summary: 'To run the app, to run events safely, and to help your leaders care for their teens. Never for adverts.',
    body: (
      <>
        <List
          items={[
            'To give you an account and keep it secure.',
            'To show you today’s reading, keep your streak, and send the reminders you chose.',
            'To register you for events, take payment, issue your ticket and check you in at the door.',
            'To reach a parent, guardian or emergency contact if something happens at an event.',
            'To let leaders see how their parish, zone or province is doing.',
            'To find and fix problems, and to stop misuse.',
          ]}
        />
        <P>
          We do not sell your information. We do not show adverts, and we do not use advertising or tracking
          tools from other companies.
        </P>
      </>
    ),
  },
  {
    id: 'who-can-see-it',
    title: 'Who can see it',
    summary:
      'Leaders in your own part of the church can see your details and your event registrations. They see activity as totals, not a record of what you read.',
    body: (
      <>
        <P>
          Leaders use a separate tool called the Console. What a leader can see depends on the role they hold and
          the part of the church they serve. A parish teacher sees their own parish. A zone coordinator sees their
          zone.
        </P>
        <List
          items={[
            <>
              <B>Leaders in your part of the church</B> can see your name, contact details and church, and your
              event registrations, including the guardian, emergency and medical details given for that event.
            </>,
            <>
              <B>Your activity</B> reaches leaders as totals and simple signals, such as how many teens read this
              week or that someone has not been active for a while.
            </>,
            <>
              <B>The team that runs Faith Tribe</B> can reach the data when they need to, to fix a problem or
              answer a request from you. Changes they make are logged.
            </>,
          ]}
        />
        <P>
          No adult can send you a private message in Faith Tribe. Other teens cannot see your details.
        </P>
      </>
    ),
  },
  {
    id: 'who-we-share-with',
    title: 'Who we share it with',
    summary: 'A small number of companies that help us run the service. They only get what they need to do their job.',
    body: (
      <>
        <List
          items={[
            <>
              <B>Paystack</B> processes payments. It receives the payer’s name, email, phone and the amount, and it
              handles the card details.
            </>,
            <>
              <B>Brevo</B> delivers our emails, such as sign-in codes, password resets and tickets. It receives
              your email address and the message.
            </>,
            <>
              <B>A text message provider</B> may be used to send a sign-in code to your phone. It receives your
              phone number and the code.
            </>,
            <>
              <B>Cloudflare and Vercel</B> host the site and store uploaded files such as profile photos.
            </>,
            <>
              <B>Vercel Analytics</B> counts page visits on the website. It does not use cookies and does not
              identify you.
            </>,
          ]}
        />
        <P>
          Some of these companies keep data on computers outside Nigeria. We may also share information if the law
          requires it, or if we need to in order to keep a young person safe.
        </P>
      </>
    ),
  },
  {
    id: 'on-your-device',
    title: 'What we keep on your device',
    summary: 'We do not use advertising cookies. Your browser remembers that you are signed in and which theme you chose.',
    body: (
      <>
        <P>Faith Tribe saves a few things in your browser’s own storage so the app works:</P>
        <List
          items={[
            'That you are signed in, so you do not have to sign in on every visit.',
            'Your light or dark theme.',
            'Which notifications you have already read.',
          ]}
        />
        <P>
          Signing out removes the sign-in. Clearing your browser’s site data removes all of it. On a shared phone
          or computer, always sign out when you finish.
        </P>
      </>
    ),
  },
  {
    id: 'how-long',
    title: 'How long we keep it',
    summary: 'For as long as you have an account. Ask us to delete it and we will, apart from records we must keep.',
    body: (
      <>
        <P>
          We keep your account information while your account is open. If you ask us to delete your account, we
          delete or anonymise your personal details.
        </P>
        <P>A few records are kept longer because we have to:</P>
        <List
          items={[
            'Payment records, which we keep for accounting.',
            'Records needed to keep young people safe, or that the law requires us to keep.',
          ]}
        />
        <P>Sign-in codes expire within minutes and cannot be reused.</P>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your choices and rights',
    summary:
      'You can see your information, correct it, ask us to delete it, and turn reminders off. Email us and we will sort it out.',
    body: (
      <>
        <P>Under the Nigeria Data Protection Act you have the right to:</P>
        <List
          items={[
            'Ask what information we hold about you and get a copy.',
            'Correct anything that is wrong. Most of it you can change yourself in your settings.',
            'Ask us to delete your account and your information.',
            'Object to how we use your information, or ask us to stop.',
            'Withdraw a consent you gave earlier.',
          ]}
        />
        <P>
          To use any of these, email <A href={MAIL}>{SITE_CONTACT.email}</A> from the address on your account. We
          aim to answer within 30 days. There is no charge.
        </P>
        <P>
          You can turn each kind of reminder on or off in your settings at any time. If you are unhappy with how
          we handled a request, you can complain to the Nigeria Data Protection Commission.
        </P>
      </>
    ),
  },
  {
    id: 'parents',
    title: 'If you are under 18, and for parents',
    summary:
      'Faith Tribe is made for teenagers. If you are under 18, read this page with a parent or guardian. Parents can ask us anything about their child’s information.',
    body: (
      <>
        <P>
          Faith Tribe is for teens aged 13 to 19 in RCCG Region 63. If you are under 18, please show this page to
          a parent or guardian before you sign up, and before you register for an event.
        </P>
        <P>
          We ask for a parent or guardian’s contact details when a teen registers for an event, so there is an
          adult we can reach.
        </P>
        <P>
          If you are a parent or guardian, you can ask to see your child’s information, have it corrected, or
          have the account deleted. Email <A href={MAIL}>{SITE_CONTACT.email}</A> or call{' '}
          <A href={SITE_CONTACT.phoneHref}>{SITE_CONTACT.phone}</A>.
        </P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we keep it safe',
    summary: 'The connection is encrypted, passwords are scrambled, and access is limited by role. No system is perfect, so tell us if something looks wrong.',
    body: (
      <>
        <List
          items={[
            'Everything travels over an encrypted connection.',
            'Passwords are stored scrambled. Nobody on our team can read yours.',
            'An account is locked for a while after repeated wrong sign-in attempts.',
            'Leaders only reach the data their role and their part of the church allow.',
            'Sensitive actions in the Console are logged.',
          ]}
        />
        <P>
          If you think someone else has used your account, change your password and tell us at{' '}
          <A href={MAIL}>{SITE_CONTACT.email}</A>. If a problem on our side puts your information at risk, we will
          tell you.
        </P>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    summary: 'If this notice changes in a way that matters, we will tell you in the app. You can always reach us by email or phone.',
    body: (
      <>
        <P>
          We will update this page when what we do changes, and change the date at the top. For anything
          important we will also tell you in the app.
        </P>
        <P>
          Email <A href={MAIL}>{SITE_CONTACT.email}</A> or call{' '}
          <A href={SITE_CONTACT.phoneHref}>{SITE_CONTACT.phone}</A>. The rules for using Faith Tribe are in our{' '}
          <To to="/terms">Terms</To>
          .
        </P>
      </>
    ),
  },
];

const Privacy = () => {
  // Lets a link such as /privacy#your-rights open at that section.
  useHashScroll();

  return (
    <InfoShell
      seoTitle="Privacy"
      seoDescription="What Faith Tribe collects, why, who can see it, and how to have it corrected or deleted. Written to be read by teenagers and their parents."
      path="/privacy"
      eyebrow="PRIVACY"
      title="Your information, in plain words."
      intro="What we collect, why we need it, who can see it, and how to change or delete it. Each section starts with the short version."
      meta={`Last updated ${LEGAL_UPDATED}`}
      tone="bg-pop-violet"
      object={OBJECTS.shield}
    >
      <LegalDocument sections={SECTIONS} />
    </InfoShell>
  );
};

export default Privacy;
