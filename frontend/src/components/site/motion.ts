import type { Variants } from 'framer-motion';

/*
  Motion vocabulary for the website. Sections compose these rather than writing
  their own numbers, so the page moves as one thing.

  Variants only ever animate transform and opacity. Both stay on the compositor,
  which matters on the low-end phones most of this audience uses.
*/

/** A quick start and a long, soft landing. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Text and cards: rise a little and fade in. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    // delayChildren lets a card settle before the 3D object on it pops.
    transition: { duration: 0.7, ease: EASE_OUT, delayChildren: 0.25 },
  },
};

/** 3D objects: spring in from small, slightly turned, and overshoot. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.3, rotate: -18 },
  show: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 260, damping: 13 },
  },
};

/** Photos and large blocks: grow into place. */
export const zoomIn: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT, delayChildren: 0.3 } },
};

/** List rows: slide in from the side they are read from. */
export const slideIn: Variants = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

/** Phones: come up from below on a spring. */
export const riseUp: Variants = {
  hidden: { opacity: 0, y: 120 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 90, damping: 16 } },
};

/** A parent that plays its children one after another. */
export const stagger = (gap = 0.1, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/**
 * Spread onto a motion element to play its variants the first time it scrolls
 * into view. `once` matters: replaying on every pass makes a page feel jumpy.
 */
export const IN_VIEW = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, amount: 0.15 },
} as const;
