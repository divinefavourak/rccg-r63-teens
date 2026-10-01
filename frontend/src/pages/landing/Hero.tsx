import type { PointerEvent } from 'react';
import { m, useMotionValue, useSpring, useTransform, type MotionValue, type Variants } from 'framer-motion';
import { AVATARS, OBJECTS, heroEllipse } from '../../assets/site';
import FloatingObject from '../../components/site/FloatingObject';
import SiteButton from '../../components/site/SiteButton';
import { EASE_OUT, fadeUp, pop, riseUp, stagger } from '../../components/site/motion';
import PhoneFrame from '../../components/site/phone/PhoneFrame';
import TodayScreen from '../../components/site/phone/TodayScreen';
import { Swap } from './shared';

const TEENS = [
  { src: AVATARS.tolu, bg: 'bg-pop-amber' },
  { src: AVATARS.amaka, bg: 'bg-pop-lime' },
  { src: AVATARS.chidi, bg: 'bg-pop-violet' },
  { src: AVATARS.zainab, bg: 'bg-pop-sky' },
];

const HEADLINE = 'A few minutes with God, every day.';

/** Each word of the headline tips up into place. */
const word: Variants = {
  hidden: { opacity: 0, y: '0.5em', rotate: 6 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

const ellipse: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { duration: 1.1, ease: EASE_OUT } },
};

/**
 * One parallax layer. `depth` is how many px the layer travels when the pointer
 * goes from the middle of the card to its edge. Bigger numbers read as nearer.
 */
const useLayer = (x: MotionValue<number>, y: MotionValue<number>, depth: number) => ({
  x: useTransform(x, (v) => v * depth),
  y: useTransform(y, (v) => v * depth),
});

const Hero = () => {
  // Pointer position over the card, from -1 to 1 on each axis. The springs are
  // what the layers follow, so they trail the pointer instead of sticking to it.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 110, damping: 18 });
  const y = useSpring(pointerY, { stiffness: 110, damping: 18 });

  const fire = useLayer(x, y, 26);
  const star = useLayer(x, y, 40);
  const notebook = useLayer(x, y, 32);
  const chat = useLayer(x, y, 20);
  // The phone leans the other way, which is what sells the depth.
  const phone = useLayer(x, y, -8);
  const phoneTilt = useTransform(x, (v) => v * 2.5);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // Touch has no hover, and a parallax that jumps on every tap is worse than none.
    if (e.pointerType !== 'mouse') return;
    const box = e.currentTarget.getBoundingClientRect();
    pointerX.set(((e.clientX - box.left) / box.width) * 2 - 1);
    pointerY.set(((e.clientY - box.top) / box.height) * 2 - 1);
  };

  const onPointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <section className="px-4 pt-1 lg:px-10 lg:py-4">
      {/* overflow-hidden is what crops the phone: it is taller than its stage on
          purpose and runs off the bottom of the card.

          This is the one section that animates on load rather than on scroll.
          The card orchestrates: its children play in document order. */}
      <m.div
        initial="hidden"
        animate="show"
        variants={stagger(0.07, 0.1)}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative mx-auto flex w-full max-w-[640px] flex-col gap-4 overflow-hidden rounded-[36px] bg-pop-green px-6 pt-7 lg:h-[720px] lg:max-w-[1200px] lg:flex-row lg:items-end lg:gap-10 lg:rounded-[48px] lg:px-10 lg:pt-16 xl:px-16"
      >
        <m.img
          src={heroEllipse}
          alt=""
          aria-hidden
          variants={ellipse}
          className="pointer-events-none absolute -right-[60px] top-[120px] hidden size-[620px] max-w-none lg:block"
        />

        <div className="relative flex flex-col items-start gap-4 lg:h-full lg:min-w-0 lg:flex-1 lg:justify-center lg:gap-6 lg:pb-16">
          <m.p
            variants={fadeUp}
            className="whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-label-sm tracking-[0.08em] text-on-ink lg:px-3.5 lg:tracking-[0.1em]"
          >
            RCCG REGION 63 JUNIOR CHURCH
          </m.p>
          {/* The words animate separately, so the heading carries the whole
              sentence as its label and the pieces are hidden from assistive tech. */}
          <m.h1
            aria-label={HEADLINE}
            variants={stagger(0.06)}
            className="text-display-lg text-pop-on lg:text-[clamp(3.5rem,5.83vw,5.25rem)] lg:leading-[1.048] lg:tracking-[-0.04em]"
          >
            {HEADLINE.split(' ').map((text, i) => (
              <span key={i} aria-hidden>
                <m.span variants={word} className="inline-block origin-bottom-left">
                  {text}
                </m.span>{' '}
              </span>
            ))}
          </m.h1>
          <m.p variants={fadeUp} className="text-body-md text-pop-on lg:text-body-lg">
            <Swap
              mobile="One short reading, one verse to keep, and the whole Bible. Made for teens."
              desktop="One short reading, one verse to keep, and the whole Bible. Made for teens, with no noisy feed."
            />
          </m.p>
          <m.div variants={fadeUp} className="flex w-full flex-col gap-4 lg:w-auto lg:flex-row lg:gap-3">
            <SiteButton to="#install" className="w-full lg:w-auto">
              Get the app
            </SiteButton>
            <SiteButton to="/devotionals" variant="secondary" className="w-full lg:w-auto">
              Read today’s reading
            </SiteButton>
          </m.div>
          <m.div variants={fadeUp} className="hidden items-center gap-3 lg:flex">
            <m.span aria-hidden variants={stagger(0.08)} className="flex items-center">
              {TEENS.map(({ src, bg }, i) => (
                <m.span
                  key={src}
                  variants={pop}
                  className={`relative size-10 shrink-0 overflow-hidden rounded-full border-[3px] border-pop-green ${bg} ${i < TEENS.length - 1 ? '-mr-2.5' : ''}`}
                >
                  <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </m.span>
              ))}
            </m.span>
            <p className="whitespace-nowrap text-label-md text-pop-on">Built with teens across Region 63</p>
          </m.div>
        </div>

        {/* A fixed-width stage, so the 3D objects keep their place around the
            phone however wide the card gets. */}
        <div className="relative flex h-[330px] w-[280px] shrink-0 items-start justify-center self-center lg:h-[656px] lg:w-[440px] lg:items-end lg:self-auto">
          <m.div variants={riseUp} style={{ x: phone.x, rotate: phoneTilt }} className="origin-bottom">
            <PhoneFrame
              label="The Faith Tribe app, open on today’s reading"
              className="h-[480px] rounded-[36px] [--phone-bezel:6px] [--phone-w:240] lg:h-[600px] lg:rounded-b-none lg:rounded-t-[44px] lg:shadow-elevation-3 lg:[--phone-bezel:8px] lg:[--phone-w:300]"
            >
              <TodayScreen />
            </PhoneFrame>
          </m.div>
          <FloatingObject
            src={OBJECTS.fire}
            eager
            style={fire}
            className="absolute left-[-8px] top-[30px] size-20 lg:left-[-20px] lg:top-[60px] lg:size-[120px]"
          />
          <FloatingObject
            src={OBJECTS.star}
            eager
            floatDelay={-1.6}
            style={star}
            className="absolute left-[246px] top-[6px] size-16 lg:left-[356px] lg:top-5 lg:size-24"
          />
          <FloatingObject
            src={OBJECTS.notebook}
            eager
            floatDelay={-3.1}
            style={notebook}
            className="absolute left-[350px] top-[330px] hidden size-[130px] lg:block"
          />
          <FloatingObject
            src={OBJECTS.chatBubble}
            eager
            floatDelay={-2.3}
            style={chat}
            className="absolute left-[-30px] top-[380px] hidden size-[100px] lg:block"
          />
        </div>
      </m.div>
    </section>
  );
};

export default Hero;
