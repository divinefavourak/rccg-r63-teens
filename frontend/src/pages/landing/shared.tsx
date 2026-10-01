import type { ReactNode } from 'react';

/*
  Layout rules shared by the landing sections.

  The design is two frames: 360 wide (phone) and 1440 wide (desktop). The page
  switches between them at `lg`. In between:

  - Below `lg` the phone layout is kept and its column is capped at 640px, so a
    tablet gets a comfortable measure rather than stretched cards.
  - From `lg` up to the 1200px container the desktop layout is fluid. The big
    type scales with the viewport and settles on the Figma size at 1440.
*/

/** Centres a section's content and applies the cap for each layout. */
export const CONTAINER = 'mx-auto w-full max-w-[640px] lg:max-w-[1200px]';

/** Section heading: display (32/40) on phones, display/xl (56/64) on desktop. */
export const H2 =
  'text-display lg:text-[clamp(2.5rem,3.89vw,3.5rem)] lg:leading-[1.143] lg:tracking-[-0.03em]';

type Props = {
  mobile: ReactNode;
  desktop: ReactNode;
};

/**
 * Copy that is worded differently in the two frames. The phone frame trims
 * several lines so they fit in two rows. Both versions are in the markup and
 * display:none removes the unused one from the accessibility tree as well.
 */
export const Swap = ({ mobile, desktop }: Props) => (
  <>
    <span className="lg:hidden">{mobile}</span>
    <span className="hidden lg:inline">{desktop}</span>
  </>
);
