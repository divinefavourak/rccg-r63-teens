import { m } from 'framer-motion';
import { AVATARS, OBJECTS } from '../../assets/site';
import FloatingObject from '../../components/site/FloatingObject';
import SiteButton from '../../components/site/SiteButton';
import { IN_VIEW, fadeUp, pop, stagger, zoomIn } from '../../components/site/motion';
import { CONTAINER, Swap } from './shared';

const LEADERS = [
  { src: AVATARS.tunde, bg: 'bg-pop-lime', overlap: '-mr-3 lg:-mr-4' },
  { src: AVATARS.ngozi, bg: 'bg-pop-pink', overlap: '' },
];

const Leaders = () => (
  <section id="leaders" className="scroll-mt-6 px-5 py-10 lg:px-10 lg:py-24">
    <div className={CONTAINER}>
      <m.div
        {...IN_VIEW}
        variants={zoomIn}
        className="group relative flex flex-col items-start gap-3 rounded-[32px] bg-ink p-6 text-on-ink lg:flex-row lg:items-center lg:gap-10 lg:rounded-[48px] lg:px-14 lg:py-12"
      >
        <m.span aria-hidden variants={stagger(0.12)} className="flex shrink-0 items-center">
          {LEADERS.map(({ src, bg, overlap }) => (
            <m.span
              key={src}
              variants={pop}
              className={`relative size-16 shrink-0 overflow-hidden rounded-full border-[3px] border-ink lg:size-24 ${bg} ${overlap}`}
            >
              <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            </m.span>
          ))}
        </m.span>
        <m.div variants={fadeUp} className="flex flex-col gap-3 lg:min-w-0 lg:flex-1 lg:gap-2">
          <h2 className="text-title-lg lg:text-display">Lead a parish or teach a class?</h2>
          <p className="text-body-md lg:text-body-lg">
            <Swap
              mobile="Teacher tools work on your phone. The full Console is on desktop."
              desktop="The Console is where leaders publish readings, plan events and check teens in at the door."
            />
          </p>
        </m.div>
        <m.div variants={fadeUp} className="w-full lg:w-auto">
          <SiteButton to="/admin" variant="accent" className="w-full lg:w-auto">
            <Swap mobile="Open leader tools" desktop="Open the Console" />
          </SiteButton>
        </m.div>
        <FloatingObject src={OBJECTS.target} className="absolute -top-10 right-11 hidden size-24 lg:block" />
      </m.div>
    </div>
  </section>
);

export default Leaders;
