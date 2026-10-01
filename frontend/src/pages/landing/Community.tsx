import { m } from 'framer-motion';
import { OBJECTS } from '../../assets/site';
import ResponsiveImage from '../../components/ResponsiveImage';
import FloatingObject from '../../components/site/FloatingObject';
import { Glyph } from '../../components/site/Glyph';
import { ICONS } from '../../components/site/icons';
import { IN_VIEW, fadeUp, slideIn, stagger, zoomIn } from '../../components/site/motion';
import { CONTAINER, H2, Swap } from './shared';

const POINTS = [
  {
    mobile: 'No endless scrolling',
    desktop: 'No endless scrolling and no videos that play by themselves',
    bg: 'bg-pop-amber',
  },
  { mobile: 'Reminders that are warm, never guilt', desktop: 'Reminders that are warm, never guilt', bg: 'bg-pop-violet' },
  { mobile: 'Works offline and on low data', desktop: 'Works offline and on low data', bg: 'bg-pop-sky' },
];

// Real photographs from NYLR 2025, already in the image pipeline.
const PHOTOS = {
  standing: { name: 'img3', alt: 'Teens in matching retreat shirts standing together at church' },
  worship: { name: 'img5', alt: 'Teens with their hands raised in worship' },
  stage: { name: 'img2', alt: 'A young man leading worship on stage at NYLR 2025' },
} as const;

const FRAME = 'group overflow-hidden';

type PhotoProps = { photo: (typeof PHOTOS)[keyof typeof PHOTOS]; sizes: string };

/**
 * A photo that eases larger when its frame is hovered. The zoom sits on a
 * wrapper, not on the image: ResponsiveImage already puts an opacity transition
 * on the <img> for its blur-up, and a second transition there would replace it.
 */
const Photo = ({ photo, sizes }: PhotoProps) => (
  <div className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-110">
    <ResponsiveImage {...photo} sizes={sizes} className="h-full w-full object-cover" />
  </div>
);

/*
  The collage is arranged differently in each frame, not just resized: three
  photos in two columns on desktop, two photos stacked on a phone. Each layout
  is its own block. Images are lazy, so the hidden block's are never fetched.
*/
const DesktopCollage = () => (
  <m.div {...IN_VIEW} variants={stagger(0.12)} className="hidden shrink-0 items-start gap-4 lg:flex">
    <div className="flex flex-col gap-4">
      <m.div variants={zoomIn} className={`${FRAME} h-[230px] w-[320px] rounded-[28px]`}>
        <Photo photo={PHOTOS.standing} sizes="320px" />
      </m.div>
      <m.div variants={zoomIn} className={`${FRAME} h-[200px] w-[320px] rounded-[28px]`}>
        <Photo photo={PHOTOS.worship} sizes="320px" />
      </m.div>
    </div>
    <div className="flex flex-col gap-4">
      <m.div variants={zoomIn} className={`${FRAME} h-[300px] w-[240px] rounded-[28px]`}>
        <Photo photo={PHOTOS.stage} sizes="240px" />
      </m.div>
      <m.div
        variants={zoomIn}
        className="group relative flex w-[240px] flex-col gap-2 rounded-[28px] bg-pop-pink p-5 text-pop-on"
      >
        <p className="text-label-sm tracking-[0.1em]">NYLR 2025</p>
        <p className="text-title-lg">
          Real teens.
          <br />
          Real church.
        </p>
        <FloatingObject src={OBJECTS.crown} className="absolute -top-[26px] right-0 size-16" />
      </m.div>
    </div>
  </m.div>
);

const MobileCollage = () => (
  <m.div {...IN_VIEW} variants={stagger(0.12)} className="flex flex-col gap-4 lg:hidden">
    <m.div variants={zoomIn} className={`${FRAME} h-[210px] w-full rounded-[28px]`}>
      <Photo photo={PHOTOS.standing} sizes="(max-width: 680px) calc(100vw - 40px), 640px" />
    </m.div>
    <div className="flex gap-3">
      <m.div variants={zoomIn} className={`${FRAME} h-[150px] min-w-0 flex-1 rounded-3xl`}>
        <Photo photo={PHOTOS.worship} sizes="(max-width: 680px) 50vw, 320px" />
      </m.div>
      <m.div
        variants={zoomIn}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-3xl bg-pop-pink p-4 text-pop-on"
      >
        <p className="text-label-sm tracking-[0.08em]">NYLR 2025</p>
        <p className="text-title-md">Real teens. Real church.</p>
      </m.div>
    </div>
  </m.div>
);

const Community = () => (
  <section className="overflow-x-clip px-5 py-10 lg:px-10 lg:py-24">
    <div className={`${CONTAINER} flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-10 xl:gap-16`}>
      <DesktopCollage />
      <MobileCollage />
      <m.div
        {...IN_VIEW}
        variants={stagger(0.1)}
        className="flex flex-col gap-4 lg:min-w-0 lg:flex-1 lg:gap-5"
      >
        <m.h2 variants={fadeUp} className={`${H2} text-content-primary`}>
          Made for teens across Region 63
        </m.h2>
        <m.p variants={fadeUp} className="text-body-md text-content-secondary lg:text-body-lg">
          <Swap
            mobile="Kind, easy to come back to, and nothing like a social feed."
            desktop="Built with the teens, teachers and parish leaders of RCCG Region 63. Kind, easy to come back to, and nothing like a social feed."
          />
        </m.p>
        <m.ul variants={stagger(0.12)} className="flex flex-col gap-4 lg:gap-5">
          {POINTS.map(({ mobile, desktop, bg }) => (
            <m.li
              key={desktop}
              variants={slideIn}
              whileHover={{ x: 8 }}
              className={`flex items-center gap-2.5 rounded-full py-3 pl-3 pr-4 text-pop-on lg:gap-3 lg:py-3.5 lg:pl-3.5 lg:pr-5 ${bg}`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink lg:size-8">
                <Glyph icon={ICONS.check14OnInk} size={14} className="lg:hidden" />
                <Glyph icon={ICONS.check16OnInk} size={16} className="hidden lg:block" />
              </span>
              <span className="min-w-0 flex-1 text-label-md lg:text-body-md-strong">
                <Swap mobile={mobile} desktop={desktop} />
              </span>
            </m.li>
          ))}
        </m.ul>
      </m.div>
    </div>
  </section>
);

export default Community;
