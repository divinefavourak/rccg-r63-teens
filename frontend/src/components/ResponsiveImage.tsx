import { useState } from 'react';
import { images, type ImageName } from '../generated/images';

type Props = {
  /** Key into the generated manifest (see scripts/optimize-images.mjs). */
  name: ImageName;
  alt: string;
  className?: string;
  /**
   * The `sizes` attribute — how wide this image renders at each breakpoint.
   * Getting it wrong is the usual reason srcset appears to do nothing: without
   * it the browser assumes 100vw and downloads the largest candidate even into
   * a 300px box.
   *
   * The default follows the documented breakpoint scale in
   * docs/10-design-system.md (`sm 360 · md 480 · lg 768 · xl 1024 · 2xl 1280`)
   * and the 1200px max content width, minus the 16/24px gutters specified there.
   */
  sizes?: string;
  /**
   * Set on the LCP image only. Turns off lazy-loading and asks the browser to
   * fetch it ahead of other subresources. Marking everything priority is the
   * same as marking nothing.
   */
  priority?: boolean;
  draggable?: boolean;
};

function srcSet(map: Record<number, string>) {
  return Object.entries(map)
    .map(([w, url]) => `${url} ${w}w`)
    .join(', ');
}

/**
 * <picture> with AVIF -> WebP -> JPEG/PNG fallback, responsive srcset, and a
 * blurred LQIP behind the real image.
 *
 * Replaces direct `import img from '../assets/img1.JPG'`, which made Vite copy
 * the untouched 8MB camera original into dist/ and serve it to a phone.
 */
const ResponsiveImage = ({
  name,
  alt,
  className = '',
  sizes = '(max-width: 480px) calc(100vw - 32px), (max-width: 768px) calc(100vw - 48px), (max-width: 1024px) 50vw, 600px',
  priority = false,
  draggable = false,
}: Props) => {
  const img = images[name];
  const [loaded, setLoaded] = useState(false);

  return (
    <span
      className="relative block h-full w-full overflow-hidden"
      style={{
        // The LQIP sits underneath rather than in a second <img>, so it costs no
        // extra request and cannot itself shift layout.
        backgroundImage: `url(${img.lqip})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <picture>
        <source type="image/avif" srcSet={srcSet(img.avif)} sizes={sizes} />
        <source type="image/webp" srcSet={srcSet(img.webp)} sizes={sizes} />
        <img
          src={img.fallback}
          alt={alt}
          width={img.width}
          height={img.height}
          draggable={draggable}
          // width/height are the *source* pixel dimensions. The browser only
          // uses them to reserve the correct aspect ratio before decode, which
          // is what keeps CLS at zero; CSS still controls the rendered size.
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setLoaded(true)}
          className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </picture>
    </span>
  );
};

export default ResponsiveImage;
