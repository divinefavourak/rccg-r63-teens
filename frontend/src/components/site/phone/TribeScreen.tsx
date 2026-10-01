import { AVATARS } from '../../../assets/site';
import ResponsiveImage from '../../ResponsiveImage';
import { Glyph } from '../Glyph';
import { ICONS } from '../icons';
import { AppScreen, Chip, RoundButton } from './AppChrome';

const GOING = [
  { src: AVATARS.amaka, bg: 'bg-pop-lime' },
  { src: AVATARS.chidi, bg: 'bg-pop-violet' },
  { src: AVATARS.zainab, bg: 'bg-pop-sky' },
];

const UPCOMING = [
  { day: 'SAT', date: '19', title: 'Youth Praise Night', place: 'Ikeja Zone Headquarters', status: 'Free · You’re registered', badge: 'bg-pop-violet' },
  { day: 'SUN', date: '04', title: 'Back to School Prayer', place: 'Online · Zoom', status: 'Free', badge: 'bg-pop-sky' },
];

const DateBadge = ({ day, date, className }: { day: string; date: string; className: string }) => (
  <span
    className={`flex h-[60px] w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-pop-on ${className}`}
  >
    <span className="text-label-sm">{day}</span>
    <span className="text-title-md">{date}</span>
  </span>
);

const Header = () => (
  <div className="flex w-full shrink-0 items-center gap-3 px-5 pb-2 pt-1">
    <span className="min-w-0 flex-1 text-display text-content-primary">Tribe</span>
    <RoundButton icon={ICONS.tickets20} size={20} />
    <RoundButton icon={ICONS.bell20} size={20} />
  </div>
);

/** Events at the teen's own parish, with one featured. */
const TribeScreen = () => (
  <AppScreen tab="tribe" header={<Header />} gap="gap-4">
    <div className="flex shrink-0 items-start gap-2">
      <Chip label="Events" selected />
      <Chip label="Notices" />
      <Chip label="My Church" />
    </div>

    <div className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-[28px]">
      <div className="h-[196px] w-full">
        {/* Rendered at 249px wide at most, so the smallest derivative is plenty. */}
        <ResponsiveImage name="img3" alt="" sizes="280px" className="h-full w-full object-cover" />
      </div>
      <DateBadge day="SAT" date="12" className="absolute left-4 top-4 bg-surface-raised" />
      <span className="absolute right-4 top-4 flex h-9 items-center rounded-full bg-pop-amber px-3.5 text-label-md text-pop-on">
        ₦2,000
      </span>
      <div className="flex w-full flex-col gap-3 bg-ink p-4 text-on-ink">
        <span className="text-title-lg">Teens Hangout 2026</span>
        <span className="flex items-center gap-1.5">
          <Glyph icon={ICONS.mapPin16OnInk} size={16} />
          <span className="text-body-sm">RCCG Rehoboth Parish, Ikeja</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex shrink-0 items-center">
            {GOING.map(({ src, bg }, i) => (
              <span
                key={src}
                className={`relative size-7 shrink-0 overflow-hidden rounded-full border-2 border-ink ${bg} ${i < GOING.length - 1 ? '-mr-2' : ''}`}
              >
                <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1 text-label-md">184 going</span>
          <span className="flex h-11 shrink-0 items-center rounded-full bg-pop-green px-5 text-label-md text-pop-on">
            Register
          </span>
        </span>
      </div>
    </div>

    <span className="shrink-0 text-title-md text-content-primary">More coming up</span>

    {UPCOMING.map(({ day, date, title, place, status, badge }) => (
      <div
        key={title}
        className="flex w-full shrink-0 items-center gap-3 rounded-3xl bg-surface-raised p-3 shadow-[0_1px_4px_0_rgba(28,25,22,0.07)]"
      >
        <DateBadge day={day} date={date} className={badge} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-md-strong text-content-primary">{title}</span>
          <span className="text-body-sm text-content-secondary">{place}</span>
          <span className="text-label-sm text-content-brand">{status}</span>
        </span>
        <RoundButton icon={ICONS.chevronRight20} size={20} />
      </div>
    ))}
  </AppScreen>
);

export default TribeScreen;
