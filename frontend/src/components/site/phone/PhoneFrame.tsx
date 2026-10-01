import type { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  /** What the mock shows. Read out in place of its contents. */
  label: string;
  /**
   * Sets the frame's size through three things: `--phone-w` (outer width as a
   * bare number of px), `--phone-bezel` (frame thickness), and ordinary height
   * and radius classes. All of them can change per breakpoint.
   */
  className?: string;
  /** A 360x800 app screen. */
  children: ReactNode;
};

/**
 * A phone with an app screen in it.
 *
 * The screen is always laid out at the app's real size, 360x800, and then
 * scaled as one piece to the frame's width. That is how the design was made
 * too: its 300, 280 and 240 wide phones are the same screen shrunk, which is
 * where values like 16.667px in the Figma output come from. Building at 360
 * keeps every number here a whole one and means a screen is written once
 * however many sizes it appears at.
 *
 * The screen is scaled to the frame's outer width but starts inside the bezel,
 * so the bezel crops a little off its right and bottom edges. That matches the
 * Figma frame exactly and is not worth "fixing": the left padding lining up
 * with the design depends on it.
 *
 * To assistive tech this is a single image. Nothing inside is interactive.
 */
const PhoneFrame = ({ label, className, children }: Props) => (
  <div
    role="img"
    aria-label={label}
    className={clsx(
      'relative box-border w-[calc(var(--phone-w)*1px)] shrink-0 overflow-hidden border-[length:var(--phone-bezel)] border-bezel bg-surface-base',
      className,
    )}
  >
    <div
      aria-hidden
      className="absolute left-0 top-0 h-[800px] w-[360px] origin-top-left [transform:scale(calc(var(--phone-w)/360))]"
    >
      {children}
    </div>
  </div>
);

export default PhoneFrame;
