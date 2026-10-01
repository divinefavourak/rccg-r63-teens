import clsx from 'clsx';
import { m, type MotionStyle } from 'framer-motion';
import { pop } from './motion';

type Props = {
  src: string;
  /** Position and size, e.g. "absolute right-5 -top-[30px] size-24". */
  className?: string;
  /** Set on the few objects visible before any scrolling. */
  eager?: boolean;
  /** Seconds. Give neighbours different values so they do not bob in step. */
  floatDelay?: number;
  /** Motion values for pointer parallax. Optional. */
  style?: MotionStyle;
};

/**
 * A 3D object that pops in, then drifts.
 *
 * Two elements because there are two kinds of movement. The wrapper is driven
 * by framer-motion: the spring entrance (it takes the `pop` variant from
 * whichever parent is orchestrating) and any parallax. The image inside runs
 * the endless float as a plain CSS animation, which costs no JavaScript per
 * frame. Sharing one element would have the two fight over `transform`.
 *
 * Inside a `group`, hovering the group swaps the float for a quick wiggle.
 */
const FloatingObject = ({ src, className, eager = false, floatDelay = 0, style }: Props) => (
  <m.span aria-hidden variants={pop} style={style} className={clsx('pointer-events-none', className)}>
    <img
      src={src}
      alt=""
      width={400}
      height={400}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={{ animationDelay: `${floatDelay}s` }}
      className="block h-full w-full max-w-none animate-float select-none object-cover group-hover:animate-wiggle"
    />
  </m.span>
);

export default FloatingObject;
