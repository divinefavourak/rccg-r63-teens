import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useAuthContext } from '../../context/AuthContext';
import { Glyph } from './Glyph';
import { ICONS } from './icons';
import LogoLockup from './LogoLockup';
import SiteButton from './SiteButton';

const LINK =
  'rounded-full text-body-md-strong text-content-primary underline-offset-4 hover:underline ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink';

/**
 * The website's top bar. Static, not fixed: the page opens on a full-bleed
 * colour card and a bar pinned over it would need a backdrop, which the design
 * does not have.
 *
 * Below `lg` the links fold into a menu behind the "more" button. The Figma
 * mobile frame draws that button but not the open menu, so the panel reuses the
 * page's own surfaces and the .collapsible transition from index.css.
 */
const SiteNav = () => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const { isAuthenticated } = useAuthContext();

  // Someone already signed in has no use for "Log in".
  const account = isAuthenticated
    ? { label: 'Dashboard', to: '/dashboard' }
    : { label: 'Log in', to: '/login' };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="relative z-20 px-5 py-3 lg:px-10 lg:py-5">
      <div className="mx-auto flex w-full max-w-[640px] items-center gap-2.5 lg:min-h-[100px] lg:max-w-[1200px] lg:gap-8">
        <Link
          to="/"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink lg:flex-none lg:gap-3"
        >
          <LogoLockup />
          <span className="truncate text-title-md text-content-primary lg:text-title-lg">
            Faith Tribe
          </span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center justify-end gap-8 lg:flex">
          <a href="#how-it-works" className={LINK}>
            How it works
          </a>
          <a href="#leaders" className={LINK}>
            For leaders
          </a>
          <Link to={account.to} className={LINK}>
            {account.label}
          </Link>
          <SiteButton to="#install">Get the app</SiteButton>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls={menuId}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
        >
          <Glyph icon={ICONS.more20} size={20} />
        </button>
      </div>

      <div
        id={menuId}
        // `inert` keeps the collapsed links out of the tab order; aria-hidden
        // alone would leave them focusable but unannounced.
        inert={!open}
        className={clsx(
          'collapsible absolute inset-x-4 top-full lg:hidden',
          open ? 'is-open' : 'pointer-events-none',
        )}
      >
        <div>
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-[640px] flex-col gap-1 rounded-[28px] bg-surface-raised p-3 shadow-elevation-3"
          >
            <a href="#how-it-works" onClick={close} className={clsx(LINK, 'px-4 py-3')}>
              How it works
            </a>
            <a href="#leaders" onClick={close} className={clsx(LINK, 'px-4 py-3')}>
              For leaders
            </a>
            <Link to={account.to} onClick={close} className={clsx(LINK, 'px-4 py-3')}>
              {account.label}
            </Link>
            <SiteButton to="#install" onClick={close} className="mt-1 w-full">
              Get the app
            </SiteButton>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default SiteNav;
