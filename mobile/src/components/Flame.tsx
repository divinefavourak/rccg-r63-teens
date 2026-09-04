import { memo, useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { Image } from 'expo-image';

/**
 * The streak flame.
 *
 * Sourced from the animated fire in the design assets. That file arrived as a
 * 150x150 VP8 `.webm` on a solid white background with no alpha channel — fine
 * on a white web page, but it would have rendered as a white box on the amber
 * streak card and on every dark-mode surface. It was keyed to transparency and
 * re-encoded as a 96x96 animated WebP (26 frames at 24fps, alpha, infinite
 * loop), which `expo-image` plays natively on both platforms with no video
 * pipeline — Android decodes it through Glide's animation plugin.
 *
 * WebM itself was not an option: VP8/VP9 alpha is effectively unsupported on
 * iOS, so the same file would have looked correct on Android and wrong on
 * iPhone.
 */
const FLAME = require('../../assets/flame.webp');

/**
 * The genuine "reduce motion" accessibility preference.
 *
 * Deliberately NOT Reanimated's `useReducedMotion()`. That reads Android's
 * `ANIMATOR_DURATION_SCALE`, which is 0 on most emulators and on any device in
 * battery saver — so it reports "reduced motion" for reasons that have nothing
 * to do with what the person chose, and silently killed this animation
 * everywhere. `AccessibilityInfo` reads the setting itself.
 */
function useReduceMotionPreference(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!cancelled) setEnabled(value);
      })
      .catch(() => {
        // Unavailable on this platform: assume motion is fine, which is the
        // behaviour the design asks for by default.
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return enabled;
}

interface FlameProps {
  /** Rendered size. The source is 96px square, so stay at or below that. */
  size?: number;
  /**
   * Force the loop to stop.
   *
   * Motion is paused with `expo-image`'s own `autoplay` rather than by swapping
   * in a still vector: the artwork stays byte-identical either way, so a paused
   * flame and a playing one can never drift apart visually.
   */
  paused?: boolean;
}

function FlameBase({ size = 18, paused }: FlameProps) {
  const reduceMotion = useReduceMotionPreference();

  // 09-design-principles.md asks that reduced motion be honoured globally, and
  // this is the one perpetually looping element in the product — so the
  // preference still stops it, just without replacing the artwork.
  const autoplay = !(paused ?? reduceMotion);

  // The artwork is a flame centred in a square frame, so a square box plus
  // `contentFit` keeps its proportions and gives callers predictable layout.
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={FLAME}
        autoplay={autoplay}
        // Animated WebP is decoded frame by frame; memory-only caching avoids
        // re-reading a bundled asset from disk on every mount.
        cachePolicy="memory"
        contentFit="contain"
        // Bundled and already decoded — a fade here would flash on every mount.
        transition={0}
        accessibilityLabel="Streak"
        style={{ width: size, height: size }}
      />
    </View>
  );
}

export const Flame = memo(FlameBase);
