import { memo, useCallback, useEffect } from 'react';
import { Pressable, Text, View, type ViewProps } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

import { Icon } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { DURATION, ELEVATION } from '../theme/tokens';

/**
 * Shared primitives.
 *
 * The web design repeats the same card / pill / progress-bar recipes inline in
 * every screen with literal `style={{}}` objects. Collapsing them here is not
 * only tidier — NativeWind compiles a `className` to a style object once at
 * build time, whereas an inline object literal allocates a new one on every
 * render and defeats `React.memo` on anything it is passed to.
 */

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

export function Press({
  children,
  onPress,
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
  className?: string;
  style?: ViewProps['style'];
  scaleTo?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'switch' | 'tab';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const onPressIn = useCallback(() => {
    if (!reduceMotion) scale.value = withTiming(scaleTo, { duration: 100 });
  }, [scale, scaleTo, reduceMotion]);

  const onPressOut = useCallback(() => {
    if (!reduceMotion) scale.value = withTiming(1, { duration: 100 });
  }, [scale, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      className={className}
      style={[style, animStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─── Surfaces ──────────────────────────────────────────────────────────────

/** elevation.1 — the standard content card. */
export function Card({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: ViewProps['style'];
}) {
  return (
    <View
      className={`rounded-lg border border-line bg-surf-raised ${className}`}
      style={[ELEVATION.card, style]}
    >
      {children}
    </View>
  );
}

// ─── Buttons ───────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

/**
 * 10-design-system.md: `lg 48px` for primary mobile actions, one primary button
 * per screen, loading state replaces the label with a spinner at locked width.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'trailing',
  loading = false,
  disabled = false,
  className = '',
  height = 52,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  /** Trailing by default — most buttons here end with a forward arrow. */
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  height?: number;
}) {
  const surface =
    variant === 'primary'
      ? 'bg-green'
      : variant === 'secondary'
        ? 'bg-transparent border-[1.5px] border-line'
        : 'bg-transparent';

  const labelColor =
    variant === 'primary' ? 'text-white' : variant === 'secondary' ? 'text-ink-2' : 'text-green';

  return (
    <Press
      onPress={loading || disabled ? undefined : onPress}
      disabled={loading || disabled}
      accessibilityLabel={label}
      className={`flex-row items-center justify-center gap-2 rounded-md ${surface} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
      style={{ height }}
    >
      {/* The spinner always leads and replaces the icon, so the label never
          shifts sideways when a button enters its loading state. */}
      {loading ? <Spinner /> : iconPosition === 'leading' ? icon : null}
      <Text className={`font-ui-b text-[15px] ${labelColor}`}>{loading ? 'Please wait…' : label}</Text>
      {!loading && iconPosition === 'trailing' ? icon : null}
    </Press>
  );
}

/** A square icon-only control. 40px keeps it inside a 44px touch target. */
export function IconButton({
  name,
  onPress,
  label,
  filled = false,
  active = false,
  size = 40,
  iconSize = 19,
}: {
  name: React.ComponentProps<typeof Icon>['name'];
  onPress?: () => void;
  label: string;
  filled?: boolean;
  active?: boolean;
  size?: number;
  iconSize?: number;
}) {
  const tokens = useTokens();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      className={`items-center justify-center rounded border border-line ${
        active ? 'bg-green/10' : 'bg-surf-raised'
      }`}
      style={{ width: size, height: size }}
    >
      <Icon name={name} size={iconSize} color={active ? tokens.green : tokens.text2} filled={filled} />
    </Press>
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

/**
 * Progress bar. `track`/`fill` are passed as literal colours rather than
 * classes because several callers draw it on a coloured banner where the
 * semantic tokens do not apply.
 */
export const ProgressBar = memo(function ProgressBar({
  value,
  height = 6,
  track,
  fill,
}: {
  /** 0–1. */
  value: number;
  height?: number;
  track?: string;
  fill?: string;
}) {
  const tokens = useTokens();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{
        height,
        borderRadius: 999,
        backgroundColor: track ?? tokens.surfSunken,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${pct * 100}%`,
          borderRadius: 999,
          backgroundColor: fill ?? tokens.green,
        }}
      />
    </View>
  );
});

/** Rounded label. `tone` maps to the two accent roles the design permits. */
export function Pill({
  children,
  tone = 'green',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'green' | 'amber' | 'neutral';
  className?: string;
}) {
  const bg = tone === 'green' ? 'bg-green/10' : tone === 'amber' ? 'bg-amber/10' : 'bg-surf-sunken';
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${bg} ${className}`}>
      {children}
    </View>
  );
}

// ─── Controls ──────────────────────────────────────────────────────────────

/** iOS-style switch. Knob travel runs on the UI thread. */
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const tokens = useTokens();
  const reduceMotion = useReducedMotion();

  const knob = useAnimatedStyle(() => {
    const target = on ? 21 : 3;
    return {
      transform: [
        {
          translateX: reduceMotion
            ? target
            : withTiming(target, { duration: DURATION.base, easing: Easing.out(Easing.quad) }),
        },
      ],
    };
  }, [on, reduceMotion]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onChange(!on)}
      // The visual switch is 44x26 but the hit area is padded out to the 44px
      // minimum in both axes.
      hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        backgroundColor: on ? tokens.green : tokens.borderStrong,
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 3,
            left: 0,
            width: 20,
            height: 20,
            borderRadius: 999,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 2,
          },
          knob,
        ]}
      />
    </Pressable>
  );
}

/** Square check control used by the daily challenge. */
export function CheckBox({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      onPress={onToggle}
      hitSlop={8}
      className={`h-7 w-7 items-center justify-center rounded-sm border-2 ${
        done ? 'border-green bg-green' : 'border-line-strong bg-transparent'
      }`}
    >
      {done && <Icon name="check" size={15} color="#fff" />}
    </Pressable>
  );
}

// ─── Structure ─────────────────────────────────────────────────────────────

/** Section head with an optional trailing text action. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  className = '',
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <View className={`flex-row items-center justify-between ${className}`}>
      <Text className="font-ui-b text-[17px] text-ink-1">{title}</Text>
      {actionLabel && (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text className="font-ui-sb text-[13px] text-green">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The uppercase micro-label that opens most cards. */
export function Eyebrow({ children, tone = 'muted' }: { children: string; tone?: 'green' | 'amber' | 'muted' }) {
  const color = tone === 'green' ? 'text-green' : tone === 'amber' ? 'text-amber' : 'text-ink-3';
  return (
    <Text className={`font-ui-b text-[10px] uppercase tracking-[1px] ${color}`}>{children}</Text>
  );
}

/** Grabber handle for bottom sheets. */
export function Grabber() {
  return <View className="mx-auto my-3 h-1 w-10 rounded-full bg-line-strong" />;
}
