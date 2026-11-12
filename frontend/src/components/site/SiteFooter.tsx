import { Link } from 'react-router-dom';
import LogoLockup from './LogoLockup';

/**
 * The site's footer, which is also its sitemap.
 *
 * The old footer carried three links. A visitor who scrolled to the bottom of
 * the landing page — and a crawler, for whom this is the one block of links
 * every page shares — was offered no way into the quarterly readings, the
 * events, the manuals or the media. Those pages are the site's actual content.
 */
const READS = [
  { label: 'Daily devotionals', to: '/devotionals' },
  { label: 'Events & camps', to: '/events' },
  { label: 'Study manuals', to: '/manuals' },
  { label: 'Podcasts & video', to: '/media' },
];

const ABOUT = [
  { label: 'Help', to: '/help' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
];

const LINK =
  'rounded-full text-label-md text-content-secondary underline-offset-4 hover:underline ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink';

const SiteFooter = () => (
  <footer className="bg-surface-sunken px-5 pb-8 pt-7 lg:p-10">
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 lg:max-w-[1200px] lg:gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-16">
        <nav aria-label="Read" className="flex flex-col gap-2 lg:min-w-[160px]">
          <h2 className="text-label-sm uppercase tracking-[0.08em] text-content-muted">Read</h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 lg:flex-col lg:gap-2">
            {READS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={LINK}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="About" className="flex flex-col gap-2 lg:min-w-[160px]">
          <h2 className="text-label-sm uppercase tracking-[0.08em] text-content-muted">About</h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 lg:flex-col lg:gap-2">
            {ABOUT.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={LINK}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-2 lg:flex-1">
          <h2 className="text-label-sm uppercase tracking-[0.08em] text-content-muted">Who we are</h2>
          <p className="max-w-[480px] text-body-sm text-content-secondary">
            Faith Tribe is the daily companion of RCCG Region 63 Junior Church. One short reading a
            day, the whole Bible, and the events happening in your part of the church.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-line-strong pt-5 lg:flex-row lg:items-center lg:gap-6">
        <LogoLockup />
        <p className="text-body-sm text-content-secondary lg:flex-1">
          Faith Tribe · RCCG Region 63 Junior Church · © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
