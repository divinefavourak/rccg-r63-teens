import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'accent';

type Props = {
  /** A route (rendered as a router Link) or an in-page / external href. */
  to: string;
  variant?: Variant;
  /** Layout only (width, display). Colour and size belong to the variant. */
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-body-md-strong ' +
  'transition-transform duration-150 hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-95 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * The Figma Button. Primary is the one main action in a section, secondary
 * supports it. Accent is the green pill on the dark leaders card, which is a
 * touch shorter on phones.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'h-14 min-w-[140px] bg-ink px-6 text-on-ink focus-visible:outline-ink',
  secondary: 'h-14 min-w-[140px] border-[1.5px] border-ink px-6 text-ink focus-visible:outline-ink',
  accent: 'h-[52px] bg-pop-green px-7 text-pop-on focus-visible:outline-on-ink lg:h-14',
};

const SiteButton = ({ to, variant = 'primary', className, children, onClick }: Props) => {
  const classes = clsx(BASE, VARIANTS[variant], className);

  // Hash and absolute links must be real anchors. React Router does not scroll
  // to a hash target, so a Link to "#install" would change the URL and go nowhere.
  if (to.startsWith('#') || /^[a-z]+:/i.test(to)) {
    return (
      <a href={to} className={classes} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={classes} onClick={onClick}>
      {children}
    </Link>
  );
};

export default SiteButton;
