import { m } from 'framer-motion';
import { OBJECTS } from '../../assets/site';
import FloatingObject from '../../components/site/FloatingObject';
import SiteButton from '../../components/site/SiteButton';
import { IN_VIEW, fadeUp, pop, stagger } from '../../components/site/motion';
import { CONTAINER, H2, Swap } from './shared';

const STEPS = [
  {
    title: 'Open this page on your phone',
    mobile: 'Chrome on Android or Safari on iPhone.',
    desktop: 'Chrome on Android or Safari on iPhone.',
    object: OBJECTS.rocket,
  },
  {
    title: 'Tap “Add to Home screen”',
    mobile: 'It’s in the browser menu.',
    desktop: 'It’s in the browser menu. It takes seconds.',
    object: OBJECTS.thumbUp,
  },
  {
    title: 'Open it tomorrow morning',
    mobile: 'Your first reading will be waiting.',
    desktop: 'Your first reading will be waiting.',
    object: OBJECTS.bell,
  },
];

const Install = () => (
  <section id="install" className="scroll-mt-6 bg-pop-amber px-5 py-10 lg:px-10 lg:py-24">
    <div className={`${CONTAINER} flex flex-col items-start gap-4 lg:gap-12`}>
      <m.h2 {...IN_VIEW} variants={fadeUp} className={`${H2} text-pop-on`}>
        On your phone in three steps
      </m.h2>
      {/* A row with the number beside the copy on phones, a card with the
          number above it on desktop. The steps arrive in order, 1 then 2 then 3,
          which is the point of numbering them. */}
      <m.ol
        {...IN_VIEW}
        variants={stagger(0.18)}
        className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        {STEPS.map(({ title, mobile, desktop, object }, i) => (
          <m.li
            key={title}
            variants={fadeUp}
            whileHover={{ y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="group relative flex items-center gap-3 rounded-3xl bg-surface-raised p-4 lg:min-w-0 lg:flex-1 lg:flex-col lg:items-start lg:rounded-[36px] lg:p-7"
          >
            <m.span
              aria-hidden
              variants={pop}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-title-sm text-on-ink lg:size-14 lg:text-title-lg"
            >
              {i + 1}
            </m.span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-none lg:gap-3">
              <h3 className="text-body-md-strong text-content-primary lg:text-title-lg">{title}</h3>
              <p className="text-body-sm text-content-secondary lg:text-body-md">
                <Swap mobile={mobile} desktop={desktop} />
              </p>
            </div>
            <FloatingObject
              src={object}
              floatDelay={-i * 1.7}
              className="absolute -top-7 right-4 hidden size-[88px] lg:block"
            />
          </m.li>
        ))}
      </m.ol>
      <m.div {...IN_VIEW} variants={fadeUp} className="w-full lg:w-auto">
        <SiteButton to="/register" className="w-full lg:w-auto">
          Get the app
        </SiteButton>
      </m.div>
    </div>
  </section>
);

export default Install;
