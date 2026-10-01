import { Link } from 'react-router-dom';
import LogoLockup from './LogoLockup';

const LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Help', to: '/help' },
];

const SiteFooter = () => (
  <footer className="bg-surface-sunken px-5 pb-8 pt-7 lg:p-10">
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-start gap-3 lg:max-w-[1200px] lg:flex-row lg:items-center lg:gap-6">
      <LogoLockup />
      <p className="text-body-sm text-content-secondary lg:flex-1">
        Faith Tribe · RCCG Region 63 Junior Church · © {new Date().getFullYear()}
      </p>
      <nav aria-label="Footer" className="flex gap-5 lg:gap-6">
        {LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-full text-label-md text-content-secondary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  </footer>
);

export default SiteFooter;
