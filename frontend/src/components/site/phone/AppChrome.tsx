import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Glyph } from '../Glyph';
import { ICONS, SYSTEM_ICONS, type IconDef } from '../icons';

/*
  The parts every app screen shares. Everything in this folder is drawn at the
  app's real 360x800 size; <PhoneFrame> does the scaling.

  The screens are trimmed to what a frame can actually show. A frame is at most
  720 of the screen's 800px tall, so anything the design places lower than that
  (the streak card on Today, the "Read" shelf in Library, and so on) is clipped
  in Figma as well and is left out here rather than rendered unseen.
*/

type Tab = 'today' | 'bible' | 'library' | 'tribe' | 'me';

const TABS: { id: Tab; label: string; icon: IconDef; activeIcon: IconDef }[] = [
  { id: 'today', label: 'Today', icon: ICONS.tabToday, activeIcon: ICONS.tabTodayActive },
  { id: 'bible', label: 'Bible', icon: ICONS.tabBible, activeIcon: ICONS.tabBibleActive },
  { id: 'library', label: 'Library', icon: ICONS.tabLibrary, activeIcon: ICONS.tabLibraryActive },
  { id: 'tribe', label: 'Tribe', icon: ICONS.tabTribe, activeIcon: ICONS.tabTribeActive },
  // No screen on the website shows "Me" selected, so it has no active drawing.
  { id: 'me', label: 'Me', icon: ICONS.tabMe, activeIcon: ICONS.tabMe },
];

const StatusBar = () => (
  <div className="flex h-11 w-full shrink-0 items-center justify-between pl-6 pr-5">
    <span className="text-label-md text-content-primary">9:41</span>
    <img src={SYSTEM_ICONS} alt="" className="block h-[14px] w-[66px] max-w-none" />
  </div>
);

const BottomNav = ({ active }: { active: Tab }) => (
  <div className="flex w-full shrink-0 px-4 pb-4 pt-2 drop-shadow-[0_-2px_6px_rgba(28,25,22,0.08)]">
    <div className="flex flex-1 items-center justify-between rounded-full bg-ink p-1.5 shadow-elevation-3">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <div
            key={tab.id}
            className={clsx(
              'flex h-14 w-[60px] flex-col items-center justify-center gap-0.5 rounded-full',
              isActive && 'bg-on-ink',
            )}
          >
            <Glyph
              icon={isActive ? tab.activeIcon : tab.icon}
              size={24}
              className={clsx(!isActive && 'opacity-[0.72]')}
            />
            <span
              className={clsx(
                'text-[12px] font-semibold leading-4',
                isActive ? 'text-ink' : 'text-on-ink opacity-[0.72]',
              )}
            >
              {tab.label}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

type ScreenProps = {
  tab: Tab;
  /** The bar under the status bar: greeting, title or reader controls. */
  header: ReactNode;
  /** Sits between the content and the tab bar, e.g. the mini player. */
  dock?: ReactNode;
  /** Vertical gap between content blocks. It differs per screen in the design. */
  gap: string;
  children: ReactNode;
};

/** Status bar, header, a clipped content column, and the tab bar. */
export const AppScreen = ({ tab, header, dock, gap, children }: ScreenProps) => (
  <div className="flex h-full w-full flex-col bg-surface-base font-sans antialiased">
    <StatusBar />
    {header}
    <div className={clsx('flex min-h-0 w-full flex-1 flex-col overflow-hidden px-5 pb-6 pt-2', gap)}>
      {children}
    </div>
    {dock}
    <BottomNav active={tab} />
  </div>
);

/** A 44px round button on the sunken surface. Bell, search, bookmark and so on. */
export const RoundButton = ({ icon, size }: { icon: IconDef; size: number }) => (
  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-sunken">
    <Glyph icon={icon} size={size} />
  </span>
);

/** Filter chip. The selected one is ink with a tick. */
export const Chip = ({ label, selected = false }: { label: string; selected?: boolean }) => (
  <span
    className={clsx(
      'flex h-10 shrink-0 items-center gap-1 rounded-full text-label-md',
      selected ? 'bg-ink pl-3 pr-4 text-on-ink' : 'bg-surface-sunken px-4 text-content-primary',
    )}
  >
    {selected && <Glyph icon={ICONS.check16OnInk} size={16} />}
    {label}
  </span>
);

/** The small caps line above a card's title. */
export const Eyebrow = ({ children, wide = false }: { children: ReactNode; wide?: boolean }) => (
  <span
    className={clsx(
      'block text-label-sm text-pop-on',
      wide ? 'tracking-[0.08em]' : 'tracking-[0.06em]',
    )}
  >
    {children}
  </span>
);
