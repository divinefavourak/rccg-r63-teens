import { memo } from 'react';
import { Ionicons } from '@expo/vector-icons';

/**
 * The generic icon set.
 *
 * The web design ships hand-written SVG paths (`src/icons.tsx` in the Figma
 * export), most of which are Feather glyphs redrawn. Reproducing them with
 * `react-native-svg` would mean parsing and rasterising ~25 path sets on every
 * mount; an icon font renders each glyph as a single cached text run instead,
 * which matters on the low-end Android hardware this product targets
 * (15-technical-architecture.md performance budgets).
 *
 * Ionicons rather than Feather because the design system requires *filled
 * variants for active nav states* (10-design-system.md) and Ionicons is the
 * only bundled family with matched outline/filled pairs — plus it carries the
 * ticket and QR glyphs the product needs. One font file covers the whole set.
 *
 * Brand marks that no icon font has (the leaf identity, the Bible book-cross,
 * the streak flame) live in `BrandMarks.tsx` as real SVG.
 */

// A name map rather than passing Ionicons strings around directly: it keeps the
// design's vocabulary at the call sites, and swapping icon families later is a
// change to this table instead of to every screen.
const OUTLINE = {
  bell: 'notifications-outline',
  search: 'search-outline',
  share: 'share-social-outline',
  chevronRight: 'chevron-forward',
  chevronLeft: 'chevron-back',
  chevronDown: 'chevron-down',
  check: 'checkmark',
  close: 'close',
  settings: 'settings-outline',
  bookmark: 'bookmark-outline',
  calendar: 'calendar-outline',
  mapPin: 'location-outline',
  ticket: 'ticket-outline',
  play: 'play',
  headphones: 'headset-outline',
  sun: 'sunny-outline',
  moon: 'moon-outline',
  arrowRight: 'arrow-forward',
  star: 'star-outline',
  book: 'book-outline',
  people: 'people-outline',
  person: 'person-outline',
  home: 'home-outline',
  video: 'videocam-outline',
  qr: 'qr-code-outline',
  chat: 'chatbubble-ellipses-outline',
  lock: 'lock-closed-outline',
  school: 'school-outline',
  text: 'text-outline',
  coffee: 'cafe-outline',
} as const;

// Only the icons that genuinely need a filled state are listed. Anything absent
// falls back to its outline glyph rather than silently rendering nothing.
const FILLED: Partial<Record<IconName, string>> = {
  bookmark: 'bookmark',
  book: 'book',
  people: 'people',
  person: 'person',
  home: 'home',
  star: 'star',
  sun: 'sunny',
  ticket: 'ticket',
  check: 'checkmark',
};

export type IconName = keyof typeof OUTLINE;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
}

function IconBase({ name, size = 24, color = '#1C1916', filled = false }: IconProps) {
  const glyph = (filled && FILLED[name]) || OUTLINE[name];
  return <Ionicons name={glyph as never} size={size} color={color} />;
}

/**
 * Memoised because icons appear inside virtualised list rows, where the props
 * are stable but the parent re-renders on every scroll frame.
 */
export const Icon = memo(IconBase);
