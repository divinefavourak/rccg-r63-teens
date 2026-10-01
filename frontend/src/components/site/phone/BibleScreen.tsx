import { OBJECTS } from '../../../assets/site';
import { Glyph, Object3D } from '../Glyph';
import { ICONS } from '../icons';
import { AppScreen, Eyebrow, RoundButton } from './AppChrome';

// John 3:14-17, World English Bible (public domain).
const VERSES = [
  { n: 14, text: 'As Moses lifted up the serpent in the wilderness, even so must the Son of Man be lifted up,' },
  { n: 15, text: 'that whoever believes in him should not perish, but have eternal life.' },
  {
    n: 16,
    text: 'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.',
  },
  {
    n: 17,
    text: 'For God didn’t send his Son into the world to judge the world, but that the world should be saved through him.',
  },
];

const ReaderBar = () => (
  <div className="flex min-h-[112px] w-full shrink-0 items-center gap-2 px-5 pb-2 pt-1">
    <span className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-ink pl-[18px] pr-3">
      <span className="text-body-md-strong text-on-ink">John 3</span>
      <Glyph icon={ICONS.chevronDown20OnInk} size={20} />
    </span>
    <span className="flex h-11 shrink-0 items-center rounded-full bg-surface-sunken px-4 text-label-md text-content-primary">
      WEB
    </span>
    <span className="flex-1" />
    <RoundButton icon={ICONS.textSize20} size={20} />
    <RoundButton icon={ICONS.search20} size={20} />
  </div>
);

/** The reader: a chapter card, then scripture set in Lora. */
const BibleScreen = () => (
  <AppScreen tab="bible" header={<ReaderBar />} gap="gap-4">
    <div className="relative flex w-full shrink-0 flex-col gap-1 rounded-[28px] bg-pop-lime p-5">
      <Eyebrow wide>THE GOSPEL OF JOHN</Eyebrow>
      <span className="text-display-lg text-pop-on">Chapter 3</span>
      <span className="text-label-md text-pop-on">36 verses · about 5 minutes</span>
      <Object3D src={OBJECTS.notebook} className="absolute left-[222px] top-[-22px] size-[104px]" />
    </div>

    {VERSES.map(({ n, text }) => (
      <p
        key={n}
        className="w-full shrink-0 whitespace-pre-wrap font-reader text-[18px] leading-[30px] text-content-primary"
      >
        <span className="font-sans text-[12px] font-medium text-content-muted">{n}</span>
        {`  ${text}`}
      </p>
    ))}
  </AppScreen>
);

export default BibleScreen;
