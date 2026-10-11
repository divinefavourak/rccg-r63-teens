import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';

import { DURATION, POP } from '../theme/tokens';
import { useTokens } from '../theme/ThemeProvider';
import {
  BOTTOM_LETTERING,
  HEADS,
  LOGO_CENTRE,
  LOGO_DISC,
  TAGLINE,
  TOP_LETTERS,
  TREE,
  type TreeShape,
} from './artwork';

/**
 * The launch animation (Figma "Splash · Motion", App · Auth page).
 *
 * The phone itself can only show a still while the app starts: one image on
 * one flat colour (`app.json`). This picks up from exactly that still — a
 * small cream disc on green — and grows the Faith Tribe tree out of it, then
 * opens the disc into the first screen.
 *
 * Everything reads one clock, in seconds, and looks its own keyframes up
 * against it, which is how the Figma timeline is built too: the numbers below
 * are that timeline's, unchanged. The clock runs on the UI thread, because the
 * JS thread spends these same seconds loading fonts, the session and the cache.
 */

// ── Timing ──────────────────────────────────────────────────────────────────

/** Where the badge has settled. The clock waits here until the app is ready. */
const EXIT = 2.5;
/** The end of the hand-over. */
const END = EXIT + 0.95;

type Bezier = readonly [number, number, number, number];
/** A moment on the clock, the value there, and how to ease into it. */
type Key = readonly [at: number, value: number, ease?: Bezier];
type Track = readonly Key[];

interface Tracks {
  opacity?: Track;
  scale?: Track;
  scaleX?: Track;
  scaleY?: Track;
  /** Degrees, clockwise. Figma's are counter-clockwise, so these are negated. */
  rotate?: Track;
  x?: Track;
  y?: Track;
}

const OUT: Bezier = [0, 0, 0.58, 1];
const IN: Bezier = [0.42, 0, 1, 1];
const IN_OUT: Bezier = [0.42, 0, 0.58, 1];
/** Lands a little past its mark and comes back. */
const BACK: Bezier = [0.34, 1.56, 0.64, 1];
/** Fast away, long soft landing. */
const EXPO: Bezier = [0.16, 1, 0.3, 1];
const SETTLE: Bezier = [0.65, 0, 0.35, 1];
const OPEN: Bezier = [0.7, 0, 0.3, 1];

/** A CSS-style cubic-bezier, solved for `p` along the time axis. */
function bezier(p: number, e: Bezier): number {
  'worklet';
  const [x1, y1, x2, y2] = e;
  const ax = 1 - 3 * x2 + 3 * x1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  let t = p;
  for (let i = 0; i < 6; i++) {
    const slope = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(slope) < 1e-6) break;
    t -= (((ax * t + bx) * t + cx) * t - p) / slope;
  }
  t = Math.min(1, Math.max(0, t));
  return (((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t + 3 * y1) * t;
}

/**
 * A track's value at `t`. Before its first key a track holds that key's
 * value, and after its last it holds the last — the same rule Figma applies.
 */
function sample(track: Track, t: number): number {
  'worklet';
  if (t <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    const [at, value, ease] = track[i];
    if (t <= at) {
      const [from, start] = track[i - 1];
      const p = (t - from) / (at - from);
      return start + (value - start) * (ease ? bezier(p, ease) : p);
    }
  }
  return track[track.length - 1][1];
}

/** Arrive from small, a touch past full size and back, fading in as it starts. */
function pop(at: number, length: number, from = 0.001): Tracks {
  return {
    scale: [
      [at, from],
      [at + length, 1, BACK],
    ],
    opacity: [
      [at, 0],
      [at + Math.min(0.12, length), 1, OUT],
    ],
  };
}

// ── Geometry ────────────────────────────────────────────────────────────────

/** The disc and the badge on it, in design pixels. Everything hangs off this. */
const BADGE = 300;
/** Logo units to design pixels at the badge's finished size. */
const K = BADGE / LOGO_DISC;
/**
 * The tree grows this much larger than its place in the logo, then settles
 * back. It is drawn at the large size and scaled *down* to finish, so it is
 * never a small drawing stretched up.
 */
const GROW = 1.7;
const TREE_K = K * GROW;
const TREE_BOX = BADGE * GROW;
const inTree = (unit: number) => (unit - LOGO_CENTRE) * TREE_K + TREE_BOX / 2;

const DISC = '#F9F6F1';
const NAVY = '#2A2859';
const TEAL = '#45B4C0';
const RED = '#E0444A';

/** The side arcs of the ring: start and end angle, and which side they sit on. */
const RING = 208 * K;
const ringPoint = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(BADGE / 2 + RING * Math.cos(a)).toFixed(2)} ${(BADGE / 2 + RING * Math.sin(a)).toFixed(2)}`;
};
const ARCS = [
  { left: 54, d: `M${ringPoint(161)}A${RING} ${RING} 0 0 1 ${ringPoint(201.7)}` },
  { left: 235, d: `M${ringPoint(19)}A${RING} ${RING} 0 0 0 ${ringPoint(-21.7)}` },
] as const;
const ARC_TOP = 113;
const ARC_WIDTH = 11;
const ARC_HEIGHT = 70;

/** The two seals at the foot of the tree, by their centre in the 1024px icon. */
const SEAL = 54 * K;
const sealAt = (iconX: number) => ({
  position: 'absolute' as const,
  left: BADGE / 2 + K * (iconX - 512) - SEAL / 2,
  top: BADGE / 2 + K * (599 - 512) - SEAL / 2,
  width: SEAL,
  height: SEAL,
});
const RCCG_SEAL = require('../../assets/rccg-logo.png');
const JUNIOR_SEAL = require('../../assets/splash-seal-junior.png');

/** Confetti: colour, size, direction in degrees and how far it flies. */
const DOTS: readonly (readonly [string, number, number, number])[] = [
  ['#FFFFFF', 10, 8, 196],
  [POP.amber, 14, 24, 220],
  [POP.lime, 8, 72, 186],
  [POP.on, 9, 90, 208],
  ['#FFFFFF', 12, 110, 226],
  [POP.pink, 10, 155, 192],
  [POP.amber, 8, 194, 214],
  [POP.lime, 13, 206, 200],
  ['#FFFFFF', 9, 249, 222],
  [POP.sky, 11, 258, 190],
  [POP.amber, 10, 303, 210],
  ['#FFFFFF', 8, 323, 202],
];

// ── Tracks ──────────────────────────────────────────────────────────────────

const BLOB_TOP: Tracks = {
  scale: [
    [0.1, 0.3],
    [0.85, 1, EXPO],
  ],
  opacity: [
    [0.1, 0],
    [0.4, 1, OUT],
  ],
  y: [
    [0.85, 0],
    [EXIT, 16, IN_OUT],
  ],
};
const BLOB_BOTTOM: Tracks = {
  scale: [
    [0.22, 0.3],
    [0.97, 1, EXPO],
  ],
  opacity: [
    [0.22, 0],
    [0.52, 1, OUT],
  ],
  y: [
    [0.97, 0],
    [EXIT, -16, IN_OUT],
  ],
};

const TREE_SETTLE: Tracks = {
  scale: [
    [1.25, 1],
    [1.72, 1 / GROW, SETTLE],
  ],
};
const TRUNK: Tracks = {
  scaleX: [
    [0.35, 0.25],
    [0.92, 1, EXPO],
  ],
  scaleY: [
    [0.35, 0.001],
    [0.92, 1, EXPO],
  ],
  opacity: [
    [0.35, 0],
    [0.42, 1],
  ],
};
const FLAME: Tracks = {
  ...pop(0.68, 0.45),
  rotate: [
    [0.68, 12],
    [0.92, -6, IN_OUT],
    [1.2, 0, IN_OUT],
  ],
};
const LEAF: Tracks = {
  ...pop(0.88, 0.36),
  rotate: [
    [0.88, -30],
    [1.24, 0, EXPO],
  ],
};
/** A figure swings out from the trunk as it grows. */
const figure = (at: number, from: number): Tracks => ({
  ...pop(at, 0.42),
  rotate: [
    [at, from],
    [at + 0.42, 0, EXPO],
  ],
});
const FIGURES: readonly (readonly [TreeShape, Tracks])[] = [
  [TREE.bottomLeft, figure(0.8, -34)],
  [TREE.bottomRight, figure(0.88, 34)],
  [TREE.topLeft, figure(0.96, -28)],
  [TREE.topRight, figure(1.04, 28)],
];
const HEAD_TIMES = [1.0, 1.06, 1.12, 1.18, 1.26, 1.32];
const HEAD_TRACKS: readonly Tracks[] = HEAD_TIMES.map((at): Tracks => ({
  ...pop(at, 0.3),
  y: [
    [at, -7],
    [at + 0.3, 0, EXPO],
  ],
}));

const ARC_DRAW: Track = [
  [1.42, 0],
  [1.9, ARC_HEIGHT, EXPO],
];
const LETTER_TRACKS: readonly Tracks[] = TOP_LETTERS.map((_, i) => pop(1.42 + 0.035 * i, 0.3, 0.4));
const LOWER_LETTERING: Tracks = {
  opacity: [
    [1.62, 0],
    [2.05, 1, OUT],
  ],
  rotate: [
    [1.62, 10],
    [2.1, 0, EXPO],
  ],
};
const SEAL_TRACKS = [pop(1.62, 0.3), pop(1.7, 0.3)] as const;

const DOT_TRACKS: readonly Tracks[] = DOTS.map(([, , deg, far], i): Tracks => {
  const at = 1.45 + (i % 4) * 0.025;
  const a = (deg * Math.PI) / 180;
  return {
    x: [
      [at, 0],
      [at + 0.7, Math.cos(a) * far, EXPO],
    ],
    y: [
      [at, 0],
      [at + 0.7, Math.sin(a) * far, EXPO],
    ],
    // Until it flies a dot sits behind the disc, so it needs no fade in.
    opacity: [
      [at + 0.3, 1],
      [at + 0.72, 0, IN],
    ],
    scale: [
      [at + 0.2, 1],
      [at + 0.72, 0.3, IN],
    ],
  };
});

const WORD_TRACKS: readonly Tracks[] = TAGLINE.map((_, i): Tracks => {
  const at = 1.85 + 0.14 * i;
  return {
    opacity: [
      [at, 0],
      [at + 0.28, 1, OUT],
    ],
    y: [
      [at, 12],
      [at + 0.32, 0, EXPO],
    ],
  };
});
const TAGLINE_GAP = 6;
const TAGLINE_WIDTH = TAGLINE.reduce((sum, word) => sum + word.w, 0) + TAGLINE_GAP * (TAGLINE.length - 1);

const TAGLINE_LEAVE: Tracks = {
  opacity: [
    [EXIT, 1],
    [EXIT + 0.15, 0, IN],
  ],
};
const BADGE_LEAVE: Tracks = {
  opacity: [
    [EXIT, 1],
    [EXIT + 0.22, 0, IN],
  ],
  scale: [
    [EXIT, 1],
    [EXIT + 0.22, 1.14, IN],
  ],
};
const LAYER_FADE: Track = [
  [EXIT + 0.45, 1],
  [EXIT + 0.7, 0, IN_OUT],
];
/**
 * The first screen rises into place under the fading splash. It sits at rest
 * until the splash covers it completely, so an exit that never runs the clock
 * (reduced motion) leaves the app exactly where it belongs.
 */
const APP_RISE: Track = [
  [EXIT + 0.39, 0],
  [EXIT + 0.4, 26],
  [EXIT + 0.85, 0, EXPO],
];

/** The style that lifts the first screen in. For the view the splash sits over. */
export function useSplashEntrance(clock: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    transform: [{ translateY: sample(APP_RISE, clock.value) }],
  }));
}

// ── Pieces ──────────────────────────────────────────────────────────────────

interface MovingProps {
  clock: SharedValue<number>;
  tracks: Tracks;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** A view that follows its tracks. Anything without a track stays as drawn. */
const Moving = memo(function Moving({ clock, tracks, style, children }: MovingProps) {
  const animated = useAnimatedStyle(() => {
    const t = clock.value;
    const scale = tracks.scale ? sample(tracks.scale, t) : 1;
    return {
      opacity: tracks.opacity ? sample(tracks.opacity, t) : 1,
      // Always the same five entries, in the same order: a transform list that
      // changed shape between frames would be rebuilt on every one of them.
      transform: [
        { translateX: tracks.x ? sample(tracks.x, t) : 0 },
        { translateY: tracks.y ? sample(tracks.y, t) : 0 },
        { rotate: `${tracks.rotate ? sample(tracks.rotate, t) : 0}deg` },
        { scaleX: tracks.scaleX ? sample(tracks.scaleX, t) : scale },
        { scaleY: tracks.scaleY ? sample(tracks.scaleY, t) : scale },
      ],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
});

interface LimbProps {
  clock: SharedValue<number>;
  shape: TreeShape;
  tracks: Tracks;
  fill: string;
  children?: React.ReactNode;
}

/** One traced shape of the tree, turning and growing about where it joins. */
function Limb({ clock, shape, tracks, fill, children }: LimbProps) {
  const [x, y, w, h] = shape.box;
  const [px, py] = shape.pivot;
  return (
    <Moving
      clock={clock}
      tracks={tracks}
      style={{
        position: 'absolute',
        left: inTree(x),
        top: inTree(y),
        width: w * TREE_K,
        height: h * TREE_K,
        transformOrigin: `${(px - x) * TREE_K}px ${(py - y) * TREE_K}px`,
      }}
    >
      <Svg width="100%" height="100%" viewBox={`${x} ${y} ${w} ${h}`}>
        {children}
        <Path d={shape.d} fill={fill} fillRule="evenodd" />
      </Svg>
    </Moving>
  );
}

/** One side of the ring, drawn upward by uncovering it from the bottom. */
function Arc({ clock, left, d }: { clock: SharedValue<number>; left: number; d: string }) {
  const reveal = useAnimatedStyle(() => ({ height: sample(ARC_DRAW, clock.value) }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          bottom: BADGE - ARC_TOP - ARC_HEIGHT,
          width: ARC_WIDTH,
          overflow: 'hidden',
        },
        reveal,
      ]}
    >
      <Svg
        width={ARC_WIDTH}
        height={ARC_HEIGHT}
        viewBox={`${left} ${ARC_TOP} ${ARC_WIDTH} ${ARC_HEIGHT}`}
        style={{ position: 'absolute', left: 0, bottom: 0 }}
      >
        <Path d={d} fill="none" stroke={NAVY} strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

const LETTER_BOX = 40;

// ── The splash ──────────────────────────────────────────────────────────────

interface SplashAnimationProps {
  /** Seconds along the timeline. Owned by the caller so the app can rise with it. */
  clock: SharedValue<number>;
  /** The first screen is drawn underneath and can be shown. */
  ready: boolean;
  /** The splash has gone; stop rendering it. */
  onDone: () => void;
}

export function SplashAnimation({ clock, ready, onDone }: SplashAnimationProps) {
  const tokens = useTokens();
  const { width, height } = useWindowDimensions();
  // Drawn for a 360-wide phone, and allowed to grow a little on larger ones.
  const fit = Math.min(1.35, Math.max(0.85, width / 360));
  // How far the disc has to open to cover the corners of the screen.
  const cover = (Math.hypot(width, height) / BADGE / fit) * 1.15;
  // The still the phone shows first has a 90pt disc whatever the screen size.
  const swell: Track = [
    [0.1, 0.3 / fit],
    [0.62, 1, BACK],
  ];
  const open: Track = [
    [EXIT + 0.05, 1],
    [EXIT + 0.5, cover, OPEN],
  ];

  /** null until the accessibility setting has been read. */
  const [calm, setCalm] = useState<boolean | null>(null);
  const [settled, setSettled] = useState(false);
  const leaving = useRef(false);
  /** Only the reduced-motion exit uses this: the splash simply fades. */
  const fade = useSharedValue(1);

  // The genuine "reduce motion" setting, not Reanimated's — see `Flame.tsx`
  // for why the two differ. `ReduceMotion.Never` below is the other half of
  // that: without it a phone in battery saver would skip the animation.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!cancelled) setCalm(reduce);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (calm === null) return;
    if (calm) {
      // No growing: the finished badge, held long enough to be recognised.
      clock.value = EXIT;
      const hold = setTimeout(() => setSettled(true), 600);
      return () => clearTimeout(hold);
    }
    clock.value = withTiming(
      EXIT,
      { duration: EXIT * 1000, easing: Easing.linear, reduceMotion: ReduceMotion.Never },
      (finished) => {
        if (finished) scheduleOnRN(setSettled, true);
      },
    );
  }, [calm, clock]);

  useEffect(() => {
    if (!settled || !ready || leaving.current) return;
    leaving.current = true;
    if (calm) {
      fade.value = withTiming(
        0,
        { duration: DURATION.slow, reduceMotion: ReduceMotion.Never },
        () => scheduleOnRN(onDone),
      );
      return;
    }
    clock.value = withTiming(
      END,
      { duration: (END - EXIT) * 1000, easing: Easing.linear, reduceMotion: ReduceMotion.Never },
      () => scheduleOnRN(onDone),
    );
  }, [settled, ready, calm, clock, fade, onDone]);

  // A tap runs the rest of the growth through quickly. It cannot leave before
  // the app is ready, because there would be nothing underneath to show.
  const hurry = useCallback(() => {
    if (calm !== false || settled) return;
    clock.value = withTiming(
      EXIT,
      { duration: DURATION.slow, easing: Easing.linear, reduceMotion: ReduceMotion.Never },
      (finished) => {
        if (finished) scheduleOnRN(setSettled, true);
      },
    );
  }, [calm, settled, clock]);

  // The native still is let go only once this, its exact copy, is on screen.
  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const layerStyle = useAnimatedStyle(() => ({
    opacity: sample(LAYER_FADE, clock.value) * fade.value,
  }));

  const surface = tokens.surfBase;
  const discStyle = useAnimatedStyle(() => {
    const t = clock.value;
    return {
      // The disc opens into the first screen's own background, so in dark mode
      // it darkens as it goes instead of flashing cream across the screen.
      backgroundColor: interpolateColor(t, [EXIT + 0.1, EXIT + 0.45], [DISC, surface]),
      transform: [{ scale: sample(t <= EXIT ? swell : open, t) }],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.layer, layerStyle]} onLayout={onLayout}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={hurry}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Faith Tribe"
      >
        <Moving
          clock={clock}
          tracks={BLOB_TOP}
          style={[styles.blob, { width: 420 * fit, height: 420 * fit, left: -160 * fit, top: -120 * fit }]}
        />
        <Moving
          clock={clock}
          tracks={BLOB_BOTTOM}
          style={[styles.blob, { width: 300 * fit, height: 300 * fit, right: -140 * fit, bottom: -60 * fit }]}
        />

        <View
          style={{
            position: 'absolute',
            left: width / 2 - BADGE / 2,
            top: height / 2 - BADGE / 2,
            width: BADGE,
            height: BADGE,
            transform: [{ scale: fit }],
          }}
        >
          {DOTS.map(([colour, size], i) => (
            <Moving
              key={i}
              clock={clock}
              tracks={DOT_TRACKS[i]}
              style={{
                position: 'absolute',
                left: (BADGE - size) / 2,
                top: (BADGE - size) / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colour,
              }}
            />
          ))}

          <Animated.View style={[styles.disc, discStyle]} />

          <Moving clock={clock} tracks={BADGE_LEAVE} style={StyleSheet.absoluteFill}>
            {ARCS.map((arc) => (
              <Arc key={arc.left} clock={clock} left={arc.left} d={arc.d} />
            ))}

            {TOP_LETTERS.map((letter, i) => (
              <Moving
                key={i}
                clock={clock}
                tracks={LETTER_TRACKS[i]}
                style={{
                  position: 'absolute',
                  left: letter.cx - LETTER_BOX / 2,
                  top: letter.cy - LETTER_BOX / 2,
                  width: LETTER_BOX,
                  height: LETTER_BOX,
                }}
              >
                <Svg
                  width={LETTER_BOX}
                  height={LETTER_BOX}
                  viewBox={`${letter.cx - LETTER_BOX / 2} ${letter.cy - LETTER_BOX / 2} ${LETTER_BOX} ${LETTER_BOX}`}
                >
                  <Path d={letter.d} fill={NAVY} />
                </Svg>
              </Moving>
            ))}

            <Moving clock={clock} tracks={LOWER_LETTERING} style={StyleSheet.absoluteFill}>
              <Svg width={BADGE} height={BADGE} viewBox={`0 0 ${BADGE} ${BADGE}`}>
                <Path d={BOTTOM_LETTERING} fill={NAVY} />
              </Svg>
            </Moving>

            <Moving
              clock={clock}
              tracks={TREE_SETTLE}
              style={{
                position: 'absolute',
                left: (BADGE - TREE_BOX) / 2,
                top: (BADGE - TREE_BOX) / 2,
                width: TREE_BOX,
                height: TREE_BOX,
              }}
            >
              <Limb clock={clock} shape={TREE.trunk} tracks={TRUNK} fill="url(#splash-trunk)">
                <Defs>
                  <LinearGradient id="splash-trunk" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#EE5A3C" />
                    <Stop offset="0.5" stopColor="#F0853B" />
                    <Stop offset="1" stopColor="#F6AB2E" />
                  </LinearGradient>
                </Defs>
              </Limb>
              <Limb clock={clock} shape={TREE.leaf} tracks={LEAF} fill="#F5B846" />
              <Limb clock={clock} shape={TREE.flame} tracks={FLAME} fill="url(#splash-flame)">
                <Defs>
                  <LinearGradient id="splash-flame" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#FBBC38" />
                    <Stop offset="1" stopColor="#F3A32B" />
                  </LinearGradient>
                </Defs>
              </Limb>
              {FIGURES.map(([shape, tracks], i) => (
                <Limb key={i} clock={clock} shape={shape} tracks={tracks} fill={TEAL} />
              ))}
              {HEADS.map(([cx, cy, r, red], i) => (
                <Moving
                  key={i}
                  clock={clock}
                  tracks={HEAD_TRACKS[i]}
                  style={{
                    position: 'absolute',
                    left: inTree(cx - r),
                    top: inTree(cy - r),
                    width: 2 * r * TREE_K,
                    height: 2 * r * TREE_K,
                    borderRadius: r * TREE_K,
                    backgroundColor: red ? RED : TEAL,
                  }}
                />
              ))}
            </Moving>

            <Moving clock={clock} tracks={SEAL_TRACKS[0]} style={sealAt(436)}>
              <Image source={RCCG_SEAL} contentFit="contain" transition={0} style={styles.seal} />
            </Moving>
            <Moving clock={clock} tracks={SEAL_TRACKS[1]} style={sealAt(589)}>
              <Image source={JUNIOR_SEAL} contentFit="contain" transition={0} style={styles.seal} />
            </Moving>
          </Moving>

          <Moving
            clock={clock}
            tracks={TAGLINE_LEAVE}
            style={[styles.tagline, { left: (BADGE - TAGLINE_WIDTH) / 2 }]}
          >
            {TAGLINE.map((word, i) => (
              <Moving key={i} clock={clock} tracks={WORD_TRACKS[i]}>
                <Svg width={word.w} height={word.h} viewBox={`0 0 ${word.w} ${word.h}`}>
                  <Path d={word.d} fill={POP.on} />
                </Svg>
              </Moving>
            ))}
          </Moving>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    backgroundColor: POP.green,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: POP.lime,
  },
  disc: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    boxShadow: '0px 14px 36px rgba(0, 0, 0, 0.14)',
  },
  seal: {
    width: SEAL,
    height: SEAL,
  },
  tagline: {
    position: 'absolute',
    // 204 design pixels below the middle of the badge.
    top: BADGE / 2 + 204,
    flexDirection: 'row',
    gap: TAGLINE_GAP,
  },
});
