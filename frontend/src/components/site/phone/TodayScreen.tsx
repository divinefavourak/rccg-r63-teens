import clsx from 'clsx';
import { AVATARS, ILLUSTRATIONS, OBJECTS } from '../../../assets/site';
import { Art, Glyph, Object3D } from '../Glyph';
import { ICONS } from '../icons';
import { AppScreen, Eyebrow, RoundButton } from './AppChrome';

type DayState = 'done' | 'today' | 'next';

const WEEK: { day: string; date: number; state: DayState }[] = [
  { day: 'Sun', date: 27, state: 'done' },
  { day: 'Mon', date: 28, state: 'done' },
  { day: 'Tue', date: 29, state: 'done' },
  { day: 'Wed', date: 30, state: 'done' },
  { day: 'Thu', date: 1, state: 'today' },
  { day: 'Fri', date: 2, state: 'next' },
  { day: 'Sat', date: 3, state: 'next' },
];

const DAY_STYLES: Record<DayState, string> = {
  done: 'border-[1.5px] border-ink text-content-primary',
  today: 'bg-ink text-on-ink',
  next: 'border-[1.5px] border-line-strong text-content-muted',
};

const Header = () => (
  <div className="flex w-full shrink-0 items-center gap-3 px-5 py-2">
    <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-pop-amber">
      <img src={AVATARS.tolu} alt="" className="absolute inset-0 h-full w-full object-cover" />
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-title-md text-content-primary">Hello, Tolu</span>
      <span className="text-body-sm text-content-secondary">Thu 1 October</span>
    </span>
    <span className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-ink pl-2 pr-3.5">
      <Object3D src={OBJECTS.fire} eager className="size-[26px]" />
      <span className="text-label-md text-on-ink">12</span>
    </span>
    <RoundButton icon={ICONS.bell24} size={24} />
  </div>
);

/** The app's home screen: today's reading, the week, and the day's cards. */
const TodayScreen = () => (
  <AppScreen tab="today" header={<Header />} gap="gap-5">
    <div className="relative flex w-full shrink-0 flex-col items-start gap-2 rounded-[28px] bg-pop-green p-5">
      <Eyebrow wide>TODAY’S READING · 4 MIN</Eyebrow>
      <span className="text-display-lg text-pop-on">
        Standing
        <br />
        Firm
      </span>
      <span className="text-label-md text-pop-on">Ephesians 6:10–18</span>
      <span className="flex h-11 items-center gap-2 rounded-full bg-ink pl-5 pr-2">
        <span className="text-label-md text-on-ink">Read now</span>
        <span className="grid size-7 place-items-center rounded-full bg-on-ink">
          <Glyph icon={ICONS.chevronRight16} size={16} />
        </span>
      </span>
      <Art art={ILLUSTRATIONS.readingSide} className="!absolute left-[150px] top-[52px] size-[190px]" />
      <Object3D src={OBJECTS.notebook} eager className="absolute left-[244px] top-[-26px] size-[92px]" />
    </div>

    <div className="flex w-full shrink-0 items-start justify-between">
      {WEEK.map(({ day, date, state }) => (
        <span
          key={day}
          className={clsx(
            'flex h-[76px] w-10 flex-col items-center justify-center gap-0.5 rounded-full',
            DAY_STYLES[state],
          )}
        >
          {state === 'done' && <Object3D src={OBJECTS.star} eager className="size-[18px]" />}
          {state === 'today' && <span className="size-1.5 rounded-full bg-pop-green" />}
          {state === 'next' && <span className="size-1.5" />}
          <span className="text-label-sm">{day}</span>
          <span className="text-label-md">{date}</span>
        </span>
      ))}
    </div>

    <span className="shrink-0 text-title-md text-content-primary">Your day</span>

    <div className="flex w-full shrink-0 items-start gap-3">
      <div className="relative flex h-[224px] min-w-0 flex-1 flex-col gap-2 rounded-3xl bg-pop-violet p-4">
        <Eyebrow>VERSE OF THE DAY</Eyebrow>
        <span className="text-title-sm text-pop-on">
          “Be strong in the Lord, and in the strength of his might.”
        </span>
        <span className="flex-1" />
        <span className="text-[12px] font-semibold leading-4 text-pop-on">Ephesians 6:10</span>
        <Object3D src={OBJECTS.bell} eager className="absolute left-[86px] top-[150px] size-[72px]" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="relative flex h-[140px] w-full flex-col gap-1.5 rounded-3xl bg-pop-sky p-4">
          <Eyebrow>CHALLENGE</Eyebrow>
          <span className="text-body-md-strong text-pop-on">Send a friend today’s verse</span>
          <Object3D
            src={OBJECTS.chatBubble}
            eager
            className="absolute left-[96px] top-[84px] size-16"
          />
        </div>
        <div className="flex h-[72px] w-full items-center gap-2 rounded-3xl bg-pop-pink py-3 pl-4 pr-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <Eyebrow>CONTINUE</Eyebrow>
            <span className="text-body-md-strong text-pop-on">John 3</span>
          </span>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink">
            <Glyph icon={ICONS.chevronRight20OnInk} size={20} />
          </span>
        </div>
      </div>
    </div>
  </AppScreen>
);

export default TodayScreen;
