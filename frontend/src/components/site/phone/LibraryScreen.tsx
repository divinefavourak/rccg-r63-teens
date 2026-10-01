import { ILLUSTRATIONS, OBJECTS, type Illustration } from '../../../assets/site';
import { Art, Glyph, Object3D } from '../Glyph';
import { ICONS } from '../icons';
import { AppScreen, Chip, Eyebrow, RoundButton } from './AppChrome';

const LISTEN: { title: string; meta: string; art: Illustration; cover: string }[] = [
  { title: 'Faith when exams are close', meta: 'Real Talk · 18 min', art: ILLUSTRATIONS.dancing, cover: 'bg-pop-amber' },
  { title: 'Morning prayers', meta: 'Daily · 6 min', art: ILLUSTRATIONS.meditating, cover: 'bg-pop-sky' },
  { title: 'Worship mix', meta: 'Playlist · 12 songs', art: ILLUSTRATIONS.groovy, cover: 'bg-pop-pink' },
];

const PlayButton = ({ className }: { className?: string }) => (
  <span className={`grid size-11 shrink-0 place-items-center rounded-full bg-ink ${className ?? ''}`}>
    <Glyph icon={ICONS.play20OnInk} size={20} />
  </span>
);

const Header = () => (
  <div className="flex w-full shrink-0 items-center gap-3 px-5 pb-2 pt-1">
    <span className="min-w-0 flex-1 text-display text-content-primary">Library</span>
    <RoundButton icon={ICONS.search20} size={20} />
    <RoundButton icon={ICONS.bookmark20} size={20} />
  </div>
);

const MiniPlayer = () => (
  <div className="w-full shrink-0 px-4">
    <div className="flex w-full items-center gap-3 rounded-full bg-pop-amber p-2">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-raised">
        <Art art={ILLUSTRATIONS.dancing} className="size-10" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-pop-on">
        <span className="text-label-md">Faith when exams are close</span>
        <span className="text-label-sm">Real Talk · 12:04 left</span>
      </span>
      <PlayButton />
    </div>
  </div>
);

/** Articles, video and audio, with something already playing. */
const LibraryScreen = () => (
  <AppScreen tab="library" header={<Header />} dock={<MiniPlayer />} gap="gap-5">
    <div className="relative flex w-full shrink-0 flex-col items-start gap-2 rounded-[28px] bg-pop-violet p-5">
      <Eyebrow wide>NEW SERIES · 6 PARTS</Eyebrow>
      <span className="text-display-lg text-pop-on">
        Who am I,
        <br />
        really?
      </span>
      <span className="text-label-md text-pop-on">Identity · Video</span>
      <span className="flex h-11 items-center gap-2 rounded-full bg-ink pl-2 pr-5">
        <span className="grid size-7 place-items-center rounded-full bg-on-ink">
          <Glyph icon={ICONS.play14} size={14} />
        </span>
        <span className="text-label-md text-on-ink">Watch part 1</span>
      </span>
      <Art art={ILLUSTRATIONS.selfie} className="!absolute left-[160px] top-[30px] size-[200px]" />
      <Object3D src={OBJECTS.star} className="absolute left-[256px] top-[-24px] size-[76px]" />
    </div>

    <div className="flex shrink-0 items-start gap-2">
      <Chip label="All" selected />
      <Chip label="Read" />
      <Chip label="Watch" />
      <Chip label="Listen" />
    </div>

    <div className="flex w-full shrink-0 items-center">
      <span className="flex-1 text-title-md text-content-primary">Listen</span>
      <span className="text-label-md text-content-secondary">See all</span>
    </div>

    <div className="flex w-full shrink-0 items-start gap-3">
      {LISTEN.map(({ title, meta, art, cover }) => (
        <div key={title} className="flex w-[148px] shrink-0 flex-col gap-2">
          <span className={`relative grid size-[148px] place-items-center overflow-hidden rounded-3xl ${cover}`}>
            <Art art={art} className="size-[132px]" />
            <PlayButton className="absolute left-24 top-24" />
          </span>
          <span className="text-body-md-strong text-content-primary">{title}</span>
          <span className="text-label-sm text-content-muted">{meta}</span>
        </div>
      ))}
    </div>
  </AppScreen>
);

export default LibraryScreen;
