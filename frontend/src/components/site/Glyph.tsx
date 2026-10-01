import clsx from 'clsx';
import type { Illustration } from '../../assets/site';
import type { IconDef } from './icons';

type GlyphProps = {
  icon: IconDef;
  /** Edge of the square icon frame, in px. Must match the size in the icon's name. */
  size: number;
  className?: string;
};

/**
 * One of the design's own icons, placed exactly as Figma places it. See icons.ts
 * for what the two insets mean. Always decorative: the control it sits in
 * carries the label.
 */
export const Glyph = ({ icon, size, className }: GlyphProps) => (
  <span
    aria-hidden
    className={clsx('relative block shrink-0', className)}
    style={{ width: size, height: size }}
  >
    <span className="absolute" style={{ inset: icon.inset }}>
      <span className="absolute" style={{ inset: icon.bleed }}>
        <img src={icon.src} alt="" className="block h-full w-full max-w-none" />
      </span>
    </span>
  </span>
);

type ArtProps = {
  art: Illustration;
  /** Sizes the square art box, e.g. "size-[180px] lg:size-[230px]". */
  className?: string;
};

/** An illustration inside its square art box. Decorative. */
export const Art = ({ art, className }: ArtProps) => (
  <span aria-hidden className={clsx('relative block shrink-0', className)}>
    <span className="absolute" style={{ inset: art.inset }}>
      <img
        src={art.src}
        alt=""
        loading="lazy"
        decoding="async"
        className="block h-full w-full max-w-none"
      />
    </span>
  </span>
);

type ObjectProps = {
  src: string;
  /** Size and position, e.g. "absolute right-5 -top-[30px] size-24". */
  className?: string;
  /** Set on the few objects visible before any scrolling. */
  eager?: boolean;
};

/** A 3D object that breaks out of the card it decorates. Decorative. */
export const Object3D = ({ src, className, eager = false }: ObjectProps) => (
  <img
    src={src}
    alt=""
    aria-hidden
    width={400}
    height={400}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    className={clsx('pointer-events-none max-w-none select-none object-cover', className)}
  />
);
