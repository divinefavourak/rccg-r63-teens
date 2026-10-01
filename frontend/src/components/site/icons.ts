/**
 * Icon geometry for <Glyph>.
 *
 * Figma exports each icon as its bare vector, not as a padded square. Two insets
 * put it back where the designer had it:
 *
 * - `inset`  where the vector's bounding box sits inside the square icon frame.
 * - `bleed`  how far the stroke overhangs that box. It is negative because a
 *            2px stroke is drawn centred on the path, so it spills 1px outside.
 *
 * The number in a name is the icon frame's size in px. The same shape at another
 * size is a separate file because the stroke stays 2px while the path scales.
 *
 * lucide-react is installed but deliberately not used here: these are the file's
 * own icons, and near-matches from another set would drift from the design.
 */
import bell20 from '../../assets/site/icons/bell-20-ink.svg';
import bell24 from '../../assets/site/icons/bell-24-ink.svg';
import bookmark20 from '../../assets/site/icons/bookmark-20-ink.svg';
import check14OnInk from '../../assets/site/icons/check-14-on-ink.svg';
import check16OnInk from '../../assets/site/icons/check-16-on-ink.svg';
import chevronDown20OnInk from '../../assets/site/icons/chevron-down-20-on-ink.svg';
import chevronRight16 from '../../assets/site/icons/chevron-right-16-ink.svg';
import chevronRight20 from '../../assets/site/icons/chevron-right-20-ink.svg';
import chevronRight20OnInk from '../../assets/site/icons/chevron-right-20-on-ink.svg';
import mapPin16OnInk from '../../assets/site/icons/map-pin-16-on-ink.svg';
import more20 from '../../assets/site/icons/more-20-ink.svg';
import play14 from '../../assets/site/icons/play-14-ink.svg';
import play20OnInk from '../../assets/site/icons/play-20-on-ink.svg';
import search20 from '../../assets/site/icons/search-20-ink.svg';
import systemIcons from '../../assets/site/icons/system-icons.svg';
import tabBible from '../../assets/site/icons/tab-bible.svg';
import tabBibleActive from '../../assets/site/icons/tab-bible-active.svg';
import tabLibrary from '../../assets/site/icons/tab-library.svg';
import tabLibraryActive from '../../assets/site/icons/tab-library-active.svg';
import tabMe from '../../assets/site/icons/tab-me.svg';
import tabToday from '../../assets/site/icons/tab-today.svg';
import tabTodayActive from '../../assets/site/icons/tab-today-active.svg';
import tabTribe from '../../assets/site/icons/tab-tribe.svg';
import tabTribeActive from '../../assets/site/icons/tab-tribe-active.svg';
import textSize20 from '../../assets/site/icons/text-size-20-ink.svg';
import tickets20 from '../../assets/site/icons/tickets-20-ink.svg';

export type IconDef = { src: string; inset: string; bleed: string };

const CHECK_INSET = '25% 16.67% 29.17%';
const PLAY_INSET = '12.5% 16.67% 12.5% 25%';
const BELL_INSET = '8.33% 12.5% 8.31%';
const CHEVRON_X_INSET = '25% 37.5%';

export const ICONS = {
  bell20: { src: bell20, inset: BELL_INSET, bleed: '-6% -6.67%' },
  bell24: { src: bell24, inset: BELL_INSET, bleed: '-5% -5.56%' },
  bookmark20: { src: bookmark20, inset: '12.5% 20.83%', bleed: '-6.67% -8.57%' },
  check14OnInk: { src: check14OnInk, inset: CHECK_INSET, bleed: '-15.58% -10.71%' },
  check16OnInk: { src: check16OnInk, inset: CHECK_INSET, bleed: '-13.64% -9.37%' },
  chevronDown20OnInk: { src: chevronDown20OnInk, inset: '37.5% 25%', bleed: '-20% -10%' },
  chevronRight16: { src: chevronRight16, inset: CHEVRON_X_INSET, bleed: '-12.5% -25%' },
  chevronRight20: { src: chevronRight20, inset: CHEVRON_X_INSET, bleed: '-10% -20%' },
  chevronRight20OnInk: { src: chevronRight20OnInk, inset: CHEVRON_X_INSET, bleed: '-10% -20%' },
  mapPin16OnInk: { src: mapPin16OnInk, inset: '8.33% 16.67%', bleed: '-7.5% -9.37%' },
  more20: { src: more20, inset: '45.83% 16.67%', bleed: '-60% -7.5%' },
  play14: { src: play14, inset: PLAY_INSET, bleed: '-9.52% -12.24%' },
  play20OnInk: { src: play20OnInk, inset: PLAY_INSET, bleed: '-6.67% -8.57%' },
  search20: { src: search20, inset: '12.5%', bleed: '-6.67%' },
  textSize20: { src: textSize20, inset: '16.67%', bleed: '-7.5%' },
  tickets20: { src: tickets20, inset: '12.5%', bleed: '-6.67%' },

  tabToday: { src: tabToday, inset: '8.33%', bleed: '-5%' },
  tabTodayActive: { src: tabTodayActive, inset: '8.33%', bleed: '-5%' },
  tabBible: { src: tabBible, inset: '12.5% 8.33%', bleed: '-5.56% -5%' },
  tabBibleActive: { src: tabBibleActive, inset: '12.5% 8.33%', bleed: '-5.56% -5%' },
  tabLibrary: { src: tabLibrary, inset: '16.67%', bleed: '-6.25%' },
  tabLibraryActive: { src: tabLibraryActive, inset: '16.67%', bleed: '-6.25%' },
  tabTribe: { src: tabTribe, inset: '12.5% 8.33%', bleed: '-5.56% -5%' },
  tabTribeActive: { src: tabTribeActive, inset: '12.5% 8.33%', bleed: '-5.56% -5%' },
  tabMe: { src: tabMe, inset: '12.5% 20.83%', bleed: '-5.56% -7.14%' },
} as const satisfies Record<string, IconDef>;

/** The signal, wifi and battery cluster in the phone mock's status bar. */
export const SYSTEM_ICONS = systemIcons;
