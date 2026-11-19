import Seo from '../components/Seo';
import SitePage from '../components/site/SitePage';
import PageHeader from '../components/site/PageHeader';
import SiteButton from '../components/site/SiteButton';
import { NextLinks } from '../components/site/ContentBlocks';
import { OBJECTS } from '../assets/site';

/**
 * The page for any URL the site does not have.
 *
 * It used to be a maroon screen with a snowflake, left over from a December
 * camp theme, under the old dark nav. Now it is the site's own frame with the
 * ways back in, since most people land here from an old or mistyped link and
 * still want what they came for.
 */
const NotFound = () => (
  <SitePage>
    {/*
      noindex matters more here than on a normal 404. vercel.json rewrites every
      unmatched path to the app shell, so this page is served with HTTP 200 — a
      soft 404. Without this tag a crawler would index every mistyped URL.
    */}
    <Seo
      title="Page not found"
      description="That page does not exist. Head back to the Faith Tribe home page."
      noindex
    />
    <PageHeader
      eyebrow="404"
      title="This page isn’t here."
      intro="The link may be old, or the address mistyped. Today’s devotional and the events are one tap away."
      tone="bg-pop-sky"
      object={OBJECTS.zoom}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <SiteButton to="/">Go to the home page</SiteButton>
        <SiteButton to="/devotionals" variant="secondary">
          Today’s devotional
        </SiteButton>
      </div>
    </PageHeader>
    <div className="pb-16 lg:pb-24">
      <NextLinks
        title="Or try one of these"
        links={[
          { to: '/events', label: 'Events and camps', note: 'What is coming up, and how to register.' },
          { to: '/manuals', label: 'Study manuals', note: 'The lesson your class studies on Sunday.' },
          { to: '/media', label: 'Podcasts and video', note: 'Messages and ministration to listen to.' },
          { to: '/help', label: 'Help', note: 'Answers about accounts, tickets and the app.' },
        ]}
      />
    </div>
  </SitePage>
);

export default NotFound;
