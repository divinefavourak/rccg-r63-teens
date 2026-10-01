import { useCallback, useEffect } from 'react';
import { Platform, Pressable, type ViewProps } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

// ─── Press feedback ────────────────────────────────────────────────────────

/**
 * A pressable that scales slightly while held.
 *
 * One animated `Pressable` rather than a `Pressable` wrapping an
 * `Animated.View`: with two elements, layout classes land on the inner view
 * while the caller's sizing lands on the outer one, and things like
 * `className="flex-1"` on a fixed-height button silently do nothing.
 *
 * The scale itself lives in a shared value, so the press runs entirely on the
 * UI thread — no re-render per touch, and it stays responsive while JS is busy.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// On the web target Reanimated's component keeps only the animated style and
// drops the class-based one NativeWind passes alongside it, so everything built
// on `Press` rendered unstyled there. Web is a development preview only, so it
// gets the plain pressable and goes without the scale.
const IS_WEB = Platform.OS === 'web';

export function Press({
  children,
  onPress,
  onPressIn: onPressInProp,
  onPressOut: onPressOutProp,
  className,
  style,
  scaleTo = 0.97,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  /** For callers that restyle while held, on top of the built-in scale. */
  onPressIn?: () => void;
  onPressOut?: () => void;
  className?: string;
  style?: ViewProps['style'];
  scaleTo?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'switch' | 'tab' | 'radio';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean; busy?: boolean };
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const onPressIn = useCallback(() => {
    if (!reduceMotion) scale.value = withTiming(scaleTo, { duration: 100 });
    onPressInProp?.();
  }, [scale, scaleTo, reduceMotion, onPressInProp]);

  const onPressOut = useCallback(() => {
    if (!reduceMotion) scale.value = withTiming(1, { duration: 100 });
    onPressOutProp?.();
  }, [scale, reduceMotion, onPressOutProp]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const shared = {
    onPress,
    onPressIn,
    onPressOut,
    disabled,
    accessibilityRole,
    accessibilityLabel,
    accessibilityState: { disabled, ...accessibilityState },
    className,
  };

  if (IS_WEB) {
    return (
      <Pressable {...shared} style={style}>
        {children}
      </Pressable>
    );
  }

  return (
    <AnimatedPressable {...shared} style={[style, animStyle]}>
      {children}
    </AnimatedPressable>
  );
}

// ─── Indicators ────────────────────────────────────────────────────────────

/**
 * Rotating arc.
 *
 * Driven by a Reanimated shared value rather than `Animated.loop`, so it keeps
 * turning at a steady rate while the JS thread is busy doing the very work the
 * spinner is reporting on.
 */
export function Spinner({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  const reduceMotion = useReducedMotion();
  const angle = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    angle.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(angle);
  }, [angle, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
          // One transparent quadrant is what makes the rotation readable.
          borderTopColor: 'transparent',
        },
        style,
      ]}
    />
  );
}
