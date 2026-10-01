import { useEffect } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { LeafMark } from './BrandMarks';
import { Button } from './ui';
import { useTokens } from '../theme/ThemeProvider';
import { ApiError } from '../api/client';

/**
 * Loading, empty and error states.
 *
 * 09-design-principles.md makes skeleton-first loading the default and asks
 * that empty states be "illustration + one line + one action"
 * (06-user-flows.md flow 26). Spinners are for actions the teen just took, not
 * for a screen arriving.
 */

// ─── Skeleton ──────────────────────────────────────────────────────────────

/**
 * A shimmering placeholder block.
 *
 * The pulse is one shared value driving opacity on the UI thread, so a screen
 * full of skeletons costs nothing on the JS thread — which is busy doing the
 * fetch they are standing in for.
 */
export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="bg-surf-sunken"
      style={[{ width: width ?? '100%', height, borderRadius: radius }, style, animated]}
    />
  );
}

/** The Today hero card, as a skeleton. */
export function DevotionalCardSkeleton() {
  return (
    <View className="gap-3 rounded-xl border border-line bg-surf-raised p-5">
      <View className="flex-row justify-between">
        <Skeleton width={110} height={10} />
        <Skeleton width={70} height={10} />
      </View>
      <Skeleton width="80%" height={24} />
      <Skeleton height={14} />
      <Skeleton width="60%" height={14} />
      <Skeleton height={92} radius={14} style={{ marginTop: 6 }} />
      <Skeleton height={50} radius={14} />
    </View>
  );
}

/** A generic stack of list rows. */
export function ListSkeleton({ rows = 4, height = 72 }: { rows?: number; height?: number }) {
  return (
    <View className="gap-3 px-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={height} radius={16} />
      ))}
    </View>
  );
}

// ─── Error ─────────────────────────────────────────────────────────────────

/**
 * A failure the teen can act on.
 *
 * Distinguishes "no connection" from "we broke", because the two have different
 * remedies and 11-content-strategy.md asks for specific copy. Never blames the
 * user, never shows a stack trace.
 */
export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const offline = error instanceof ApiError && error.status === 0;

  const title = offline ? "You're offline" : 'That did not load';
  const body = offline
    ? // In development the message carries the URL that failed, which is what
      // makes an unreachable dev server diagnosable instead of looking like a
      // dropped connection. Teens only ever see the plain sentence.
      __DEV__ && error instanceof ApiError
      ? error.message
      : 'Check your connection — we will pick up where you left off.'
    : error instanceof ApiError
      ? error.message
      : 'Something went wrong. Please try again.';

  return (
    <View className={`items-center gap-3 px-8 ${compact ? 'py-8' : 'py-16'}`}>
      <View className="h-16 w-16 items-center justify-center rounded-lg bg-surf-sunken">
        <Text className="text-[26px]">{offline ? '📡' : '🌱'}</Text>
      </View>
      <Text className="text-center font-ui-b text-[16px] text-ink-1">{title}</Text>
      <Text className="text-center font-ui text-[13px] leading-5 text-ink-3">{body}</Text>
      {onRetry && <Button label="Try again" onPress={onRetry} variant="secondary" height={44} />}
    </View>
  );
}

// ─── Empty ─────────────────────────────────────────────────────────────────

/** Illustration + one line + one action. */
export function EmptyState({
  title,
  body,
  emoji,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  emoji?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const tokens = useTokens();
  return (
    <View className="items-center gap-3 px-8 py-14">
      <View className="h-[72px] w-[72px] items-center justify-center rounded-xl bg-green/10">
        {emoji ? (
          <Text className="text-[28px]">{emoji}</Text>
        ) : (
          <LeafMark size={34} color={tokens.green} />
        )}
      </View>
      <Text className="text-center font-ui-b text-[16px] text-ink-1">{title}</Text>
      {body && (
        <Text className="text-center font-ui text-[13px] leading-5 text-ink-3">{body}</Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="secondary" height={44} />
      )}
    </View>
  );
}
