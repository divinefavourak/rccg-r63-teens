import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig, domAnimation, m, useScroll, useSpring } from 'framer-motion';

/**
 * Wrap a website page in this once.
 *
 * - LazyMotion + `m`: loads only the DOM animation features (variants, in-view,
 *   hover, tap) instead of everything `motion` carries, which is about half the
 *   weight. `strict` turns an accidental `motion.div` into an error, so the
 *   saving cannot quietly disappear.
 * - reducedMotion="user": for someone who has asked their device for less
 *   motion, transforms are skipped and only opacity fades remain.
 */
const MotionRoot = ({ children }: { children: ReactNode }) => (
  <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </LazyMotion>
);

/** A thin bar across the top of the window that fills as the page is read. */
export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  // The spring smooths the steps of a mouse wheel into one glide.
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });

  return (
    <m.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-ink"
    />
  );
};

export default MotionRoot;
