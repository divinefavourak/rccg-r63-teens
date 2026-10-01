import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import { IN_VIEW, fadeUp, riseUp, stagger } from '../../components/site/motion';
import BibleScreen from '../../components/site/phone/BibleScreen';
import LibraryScreen from '../../components/site/phone/LibraryScreen';
import PhoneFrame from '../../components/site/phone/PhoneFrame';
import TribeScreen from '../../components/site/phone/TribeScreen';
import { CONTAINER, H2 } from './shared';

const PHONES: { name: string; label: string; screen: ReactNode; lean: number }[] = [
  { name: 'Bible', label: 'The Bible reader, open at John chapter 3', screen: <BibleScreen />, lean: -2 },
  { name: 'Library', label: 'The Library, with a video series and audio to listen to', screen: <LibraryScreen />, lean: 0 },
  { name: 'Tribe', label: 'The Tribe tab, listing upcoming events', screen: <TribeScreen />, lean: 2 },
];

/**
 * Three more screens of the app. Desktop only: the phone frame has no such
 * section, and three phones would not fit side by side on one anyway.
 */
const Showcase = () => (
  <section className="hidden bg-pop-lime px-10 py-24 lg:block">
    <div className={`${CONTAINER} flex flex-col items-center gap-12`}>
      <m.h2 {...IN_VIEW} variants={fadeUp} className={`${H2} text-center text-pop-on`}>
        See it for yourself
      </m.h2>
      <m.ul {...IN_VIEW} variants={stagger(0.16)} className="flex items-end gap-8 xl:gap-14">
        {PHONES.map(({ name, label, screen, lean }) => (
          <m.li key={name} variants={riseUp} className="flex flex-col items-center gap-5">
            <m.div
              whileHover={{ y: -14, rotate: lean, scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <PhoneFrame
                label={label}
                className="h-[560px] rounded-[44px] shadow-elevation-3 [--phone-bezel:8px] [--phone-w:280]"
              >
                {screen}
              </PhoneFrame>
            </m.div>
            <p className="rounded-full bg-ink px-5 py-2 text-label-md text-on-ink">{name}</p>
          </m.li>
        ))}
      </m.ul>
    </div>
  </section>
);

export default Showcase;
