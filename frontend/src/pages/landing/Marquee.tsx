import { OBJECTS } from '../../assets/site';
import { Object3D } from '../../components/site/Glyph';

const WORDS = [
  { word: 'READ', object: OBJECTS.bookmark },
  { word: 'PRAY', object: OBJECTS.candle },
  { word: 'GROW TOGETHER', object: OBJECTS.heart },
];

// One pass of the three words is 724px at desktop size. Four passes make a
// group wider than any screen this will meet, so the strip never shows a gap.
const PASSES = [0, 1, 2, 3];

const Group = () => (
  <div className="flex shrink-0 items-center gap-5 pl-5 lg:gap-10 lg:pl-10">
    {PASSES.map((pass) =>
      WORDS.map(({ word, object }) => (
        <span key={`${pass}-${word}`} className="flex shrink-0 items-center gap-5 lg:gap-10">
          <span className="whitespace-nowrap text-title-sm tracking-[0.06em] text-on-ink lg:text-title-lg lg:tracking-[0.06em]">
            {word}
          </span>
          <Object3D src={object} eager className="size-6 lg:size-9" />
        </span>
      )),
    )}
  </div>
);

/**
 * The ink strip under the hero. The moving track is hidden from assistive tech,
 * which gets the three words once instead of a dozen times.
 *
 * The global reduced-motion rule in index.css stops the animation.
 */
const Marquee = () => (
  <div className="overflow-hidden bg-ink py-3.5 lg:py-5">
    <p className="sr-only">Read. Pray. Grow together.</p>
    <div aria-hidden className="flex w-max animate-marquee">
      <Group />
      <Group />
    </div>
  </div>
);

export default Marquee;
