import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ResponsiveImage from './ResponsiveImage';
import type { ImageName } from '../generated/images';

const SLIDES: { name: ImageName; alt: string }[] = [
  { name: 'img1', alt: 'Teens worshipping together at camp' },
  { name: 'img2', alt: 'Group photo of the Faith Tribe teens' },
  { name: 'img3', alt: 'Teens at an outdoor camp activity' },
  { name: 'img4', alt: 'Praise and worship session' },
  { name: 'img5', alt: 'Teens gathered at Glory Arena' },
];

const AUTOPLAY_MS = 5000;

/**
 * Depth carousel over the camp photos.
 *
 * The previous version mounted all five slides at once from
 * `import img1 from '../assets/img1.JPG'` — five 5184x3456 camera originals,
 * 37.5MB over the wire and ~358MB of decoded bitmap, which is enough to have
 * the browser kill the tab on a 2GB Android.
 *
 * Two changes fix it: images come from the responsive pipeline (11-17KB each on
 * a phone), and only the three visible slides are mounted, so the offscreen
 * neighbours are never decoded at all.
 */
const HeroCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const go = useCallback((delta: number) => {
    setActiveIndex((prev) => (prev + delta + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused || prefersReducedMotion.current) return;
    const timer = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, go]);

  // Pause while the tab is hidden. An interval firing behind a backgrounded tab
  // burns battery on a phone for animation nobody can see.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div
      className="relative flex h-[400px] w-full items-center justify-center overflow-hidden md:h-[500px]"
      style={{ perspective: '1000px' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Camp photos"
    >
      <div className="relative flex h-full w-full items-center justify-center">
        {/*
          Only -1, 0, +1 are mounted. The old version rendered [-2..+2], so the
          two far slides were downloaded and decoded to sit at opacity 0.4
          behind the others.
        */}
        {[-1, 0, 1].map((offset) => {
          const index = (activeIndex + offset + SLIDES.length) % SLIDES.length;
          const slide = SLIDES[index];
          const isCenter = offset === 0;

          const transform = isCenter
            ? 'translateX(0) scale(1.1) rotateY(0deg)'
            : `translateX(${offset * 220}px) scale(0.85) rotateY(${offset * -15}deg)`;

          return (
            <div
              key={slide.name}
              className="absolute overflow-hidden rounded-2xl border-4 border-white bg-gray-900 shadow-2xl dark:border-gray-800"
              style={{
                width: '300px',
                height: '400px',
                // Plain CSS transitions on transform/opacity only. These are
                // compositor-driven, so they do not trigger layout or paint —
                // the reason this drops framer-motion here rather than keeping
                // an animation library on the landing page's critical path.
                transform,
                opacity: isCenter ? 1 : 0.7,
                zIndex: isCenter ? 20 : 10,
                transformStyle: 'preserve-3d',
                transition: prefersReducedMotion.current
                  ? 'none'
                  : 'transform 0.8s cubic-bezier(0.16,1,0.3,1), opacity 0.8s cubic-bezier(0.16,1,0.3,1)',
                cursor: isCenter ? 'default' : 'pointer',
              }}
              onClick={() => !isCenter && go(offset)}
              aria-hidden={!isCenter}
            >
              <ResponsiveImage
                name={slide.name}
                alt={slide.alt}
                // Only the first slide of the first render is the LCP candidate.
                priority={isCenter && index === 0}
                /*
                  600px, not the slot's 300px width.

                  The slot is 300x400 — portrait — while the photos are 3:2
                  landscape, so `object-cover` scales to cover the *height*:
                  400 * 3/2 = 600 CSS px of image content, with the sides cropped.
                  Declaring 300px made the browser choose the 480-wide file and
                  then upscale it 1.25x to fill the box, which is what made the
                  carousel look soft regardless of encoder quality.

                  The side slides render at scale(0.85) under a 40% black
                  overlay at 0.7 opacity, so they ask for less: detail there is
                  not perceptible and the bytes are better spent on the slide
                  someone is actually looking at.
                */
                sizes={isCenter ? '600px' : '420px'}
                className="h-full w-full object-cover"
              />
              {!isCenter && <div className="absolute inset-0 bg-black opacity-40" />}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => go(-1)}
        aria-label="Previous photo"
        className="absolute left-4 z-30 rounded-full border border-white/20 bg-black/30 p-3 text-white transition-colors hover:bg-black/50 md:left-10"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={() => go(1)}
        aria-label="Next photo"
        className="absolute right-4 z-30 rounded-full border border-white/20 bg-black/30 p-3 text-white transition-colors hover:bg-black/50 md:right-10"
      >
        <ChevronRight size={24} />
      </button>

      <div className="absolute bottom-4 z-30 flex gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.name}
            onClick={() => setActiveIndex(i)}
            aria-label={`Go to photo ${i + 1}`}
            aria-current={i === activeIndex}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIndex ? 'w-6 bg-primary-500' : 'w-2 bg-gray-500/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroCarousel;
