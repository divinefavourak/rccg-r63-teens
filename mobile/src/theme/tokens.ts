/**
 * Imperative mirror of the CSS variables in `global.css`.
 *
 * NativeWind covers everything expressible as a class name. It cannot reach the
 * places that need a literal colour string: `react-native-svg` fills and
 * strokes, `expo-linear-gradient` stops, the native status bar, and the
 * `<Tabs>` navigator's own chrome. Those read from here.
 *
 * These two files are the same data in two shapes and must be edited together.
 */

export type Scheme = 'light' | 'dark';

export interface Tokens {
  surfBase: string;
  surfRaised: string;
  surfSunken: string;
  surfOverlay: string;

  text1: string;
  text2: string;
  text3: string;
  textInv: string;

  /** Primary buttons, the nav pill, the selected option. Swaps with `onInk` in dark. */
  ink: string;
  onInk: string;

  green: string;
  greenHover: string;
  greenPressed: string;
  greenSoft: string;
  greenTonal: string;

  amber: string;
  amberBright: string;
  amberSoft: string;
  amberTonal: string;

  border: string;
  borderStrong: string;

  navBg: string;
  navBorder: string;

  error: string;
  caution: string;
  info: string;
  success: string;
}

export const LIGHT: Tokens = {
  surfBase: '#F9F6F1',
  surfRaised: '#FDFAF5',
  surfSunken: '#F2EAE0',
  surfOverlay: 'rgba(28, 25, 22, 0.48)',

  text1: '#1C1916',
  text2: '#4B4540',
  text3: '#6F6862',
  textInv: '#FDFAF5',

  ink: '#1C1916',
  onInk: '#FDFAF5',

  green: '#047857',
  greenHover: '#065F46',
  greenPressed: '#064E3B',
  greenSoft: 'rgba(4, 120, 87, 0.10)',
  greenTonal: '#D1FAE5',

  amber: '#B45309',
  amberBright: '#F59E0B',
  amberSoft: 'rgba(245, 158, 11, 0.14)',
  amberTonal: '#FEF3C7',

  border: '#EAE3DA',
  borderStrong: '#C9BEB5',

  navBg: '#1C1916',
  navBorder: '#1C1916',

  error: '#C0392B',
  caution: '#B45309',
  info: '#1D6FA4',
  success: '#047857',
};

export const DARK: Tokens = {
  surfBase: '#1C1916',
  surfRaised: '#252119',
  surfSunken: '#141210',
  surfOverlay: 'rgba(0, 0, 0, 0.64)',

  text1: '#F5F1EB',
  text2: '#B8AFA7',
  text3: '#9A928B',
  textInv: '#1C1916',

  ink: '#FDFAF5',
  onInk: '#1C1916',

  green: '#34D399',
  greenHover: '#6EE7B7',
  greenPressed: '#10B981',
  greenSoft: 'rgba(52, 211, 153, 0.15)',
  greenTonal: '#062E22',

  amber: '#FBBF24',
  amberBright: '#F59E0B',
  amberSoft: 'rgba(245, 158, 11, 0.15)',
  amberTonal: '#2C1E06',

  border: '#2E2822',
  borderStrong: '#48403A',

  navBg: '#FDFAF5',
  navBorder: '#FDFAF5',

  error: '#F87171',
  caution: '#FBBF24',
  info: '#60A5FA',
  success: '#34D399',
};

/**
 * Colour-block cards. The same in both modes, and text on them is always
 * `on` — which is why they live outside the per-scheme tokens.
 */
export const POP = {
  green: '#10B981',
  amber: '#FFC857',
  violet: '#B9A5FF',
  pink: '#FF7BAC',
  sky: '#8EC5FF',
  lime: '#7BE3B0',
  on: '#1C1916',
} as const;

export type PopColour = Exclude<keyof typeof POP, 'on'>;

export const TOKENS: Record<Scheme, Tokens> = { light: LIGHT, dark: DARK };

/**
 * Bible Reader themes.
 *
 * The reader carries a third mode (sepia) that the rest of the app does not,
 * and it is deliberately independent of the global light/dark setting — a teen
 * reading at night may want sepia while the app stays light. Keeping it as a
 * plain lookup rather than a fourth root class avoids teaching NativeWind a
 * variant that exactly one screen uses.
 */
export type ReaderTheme = 'light' | 'sepia' | 'dark';

export interface ReaderTokens {
  bg: string;
  raised: string;
  text1: string;
  text2: string;
  text3: string;
  border: string;
  accent: string;
  highlight: string;
}

export const READER_TOKENS: Record<ReaderTheme, ReaderTokens> = {
  light: {
    bg: '#F9F6F1',
    raised: '#FDFAF5',
    text1: '#1C1916',
    text2: '#4B4540',
    text3: '#6F6862',
    border: '#EAE3DA',
    accent: '#047857',
    highlight: 'rgba(255, 220, 100, 0.30)',
  },
  sepia: {
    bg: '#F4EDD8',
    raised: '#F8F2E0',
    text1: '#2C2416',
    text2: '#5C4E38',
    text3: '#9A8870',
    border: '#DDD0B8',
    accent: '#047857',
    highlight: 'rgba(214, 168, 60, 0.32)',
  },
  dark: {
    bg: '#1C1916',
    raised: '#252119',
    text1: '#F5F1EB',
    text2: '#B8AFA7',
    text3: '#9A928B',
    border: '#2E2822',
    accent: '#34D399',
    highlight: 'rgba(180, 140, 20, 0.30)',
  },
};

/**
 * Elevation (10-design-system.md).
 *
 * Web `box-shadow` has no direct RN equivalent: iOS reads shadowColor/Offset/
 * Opacity/Radius, Android reads a single `elevation` number. These presets keep
 * the two platforms visually matched instead of leaving Android flat.
 */
export const ELEVATION = {
  /** Cards. */
  card: {
    shadowColor: '#1C1916',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  /** Bottom nav, app bars. */
  nav: {
    shadowColor: '#1C1916',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  /** Sheets, modals. */
  sheet: {
    shadowColor: '#1C1916',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 16,
  },
} as const;

/**
 * Motion durations (09-design-principles.md): 150-250ms for standard
 * transitions, 300-400ms reserved for celebration moments.
 */
export const DURATION = {
  fast: 150,
  base: 200,
  slow: 250,
  celebrate: 400,
} as const;

/**
 * Bottom-nav geometry (Figma "Bottom Nav", 360 x 92).
 *
 * Lives here rather than in `BottomNav.tsx` because every scrollable screen
 * needs it too: the nav floats over the content, so it reserves no layout
 * space and each screen must pad its own scroll content clear of it.
 */
export const NAV = {
  /** Top padding + pill + bottom padding. */
  height: 92,
  /** The pill itself: a 56px tab plus 6px of padding either side. */
  barHeight: 68,
  tabHeight: 56,
  paddingTop: 8,
  paddingBottom: 16,
  paddingX: 16,
} as const;
