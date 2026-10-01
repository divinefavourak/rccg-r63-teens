import { m } from 'framer-motion';
import { ILLUSTRATIONS, OBJECTS, type Illustration } from '../../assets/site';
import FloatingObject from '../../components/site/FloatingObject';
import { Art } from '../../components/site/Glyph';
import { IN_VIEW, fadeUp, stagger } from '../../components/site/motion';
import { CONTAINER, H2, Swap } from './shared';

type Feature = {
  title: string;
  mobile: string;
  desktop: string;
  art: Illustration;
  object: string;
  bg: string;
  /** Degrees the card leans when hovered. Alternating keeps the row playful. */
  lean: number;
};

const FEATURES: Feature[] = [
  {
    title: 'One short reading a day',
    mobile: 'Four minutes, a memory verse and one small challenge.',
    desktop: 'Four minutes, a memory verse and one small challenge. When you’re done, you’re done.',
    art: ILLUSTRATIONS.sittingReading,
    object: OBJECTS.sun,
    bg: 'bg-pop-violet',
    lean: -1.5,
  },
  {
    title: 'The whole Bible, your way',
    mobile: 'Light, dark or warm paper. Share a verse in two taps.',
    desktop: 'WEB and KJV. Light, dark or warm paper. Share a verse in two taps.',
    art: ILLUSTRATIONS.reading,
    object: OBJECTS.bookmarkFav,
    bg: 'bg-pop-amber',
    lean: 1.5,
  },
  {
    title: 'Your tribe, in real life',
    mobile: 'Events at your parish and tickets on your phone.',
    desktop: 'Events at your parish, tickets on your phone, and notices from your leaders.',
    art: ILLUSTRATIONS.jumping,
    object: OBJECTS.mapPin,
    bg: 'bg-pop-sky',
    lean: -1.5,
  },
];

const Features = () => (
  <section id="how-it-works" className="scroll-mt-6 px-5 py-10 lg:px-10 lg:py-24">
    <div className={`${CONTAINER} flex flex-col gap-4 lg:gap-12`}>
      <m.h2 {...IN_VIEW} variants={fadeUp} className={`${H2} text-content-primary`}>
        Three things, done well
      </m.h2>
      {/* items-start on desktop: the cards are as tall as their copy, which is
          what gives the row its stepped bottom edge in the design. */}
      <m.ul
        {...IN_VIEW}
        variants={stagger(0.14)}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        {FEATURES.map(({ title, mobile, desktop, art, object, bg, lean }, i) => (
          <m.li
            key={title}
            variants={fadeUp}
            whileHover={{ y: -10, rotate: lean }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className={`group relative flex flex-col gap-2 rounded-[32px] px-5 pb-6 pt-5 text-pop-on lg:min-w-0 lg:flex-1 lg:gap-3 lg:rounded-[40px] lg:p-8 ${bg}`}
          >
            <div className="flex h-[170px] w-full items-center justify-center lg:h-[220px]">
              <Art
                art={art}
                className="size-[180px] transition-transform duration-500 ease-out group-hover:scale-110 lg:size-[230px]"
              />
            </div>
            <h3 className="text-title-lg lg:text-display">{title}</h3>
            <p className="text-body-md">
              <Swap mobile={mobile} desktop={desktop} />
            </p>
            <FloatingObject
              src={object}
              floatDelay={-i * 1.4}
              className="absolute -top-[22px] right-1 size-[72px] lg:-top-[30px] lg:right-5 lg:size-24"
            />
          </m.li>
        ))}
      </m.ul>
    </div>
  </section>
);

export default Features;
