import { useEffect } from 'react';
import { Modal, Pressable, Text, View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../components/Icon';
import { Drawing, DrawingIn, type DrawingName } from './art';
import { Button } from './Button';
import { PopCard } from './cards';
import { Press } from './Press';
import { useTheme, useTokens } from '../theme/ThemeProvider';
import { ELEVATION, POP } from '../theme/tokens';

/**
 * Space added under the device's status-bar inset on every screen header.
 * Figma draws against a 44px status bar; a real inset is often 24–30px, which
 * leaves a header hugging the top edge without this.
 */
export const HEADER_GAP = 12;

// ─── Top app bar ───────────────────────────────────────────────────────────

/** Back, a title and one optional action (Figma "Top App Bar", Back variant). */
export function TopAppBar({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: { icon: IconName; label: string; onPress: () => void; filled?: boolean };
}) {
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-surf-base" style={{ paddingTop: insets.top + HEADER_GAP }}>
      <View className="h-14 flex-row items-center gap-1 pl-1 pr-4">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-11 w-11 items-center justify-center"
        >
          <Icon name="chevronLeft" size={24} color={tokens.text1} />
        </Pressable>
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          className="flex-1 font-ui-b text-[17px] leading-6 text-ink-1"
        >
          {title}
        </Text>
        {action && (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            className="h-11 w-11 items-center justify-center"
          >
            <Icon name={action.icon} size={24} color={tokens.text1} filled={action.filled} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Tab and sub-screen headers ────────────────────────────────────────────

/**
 * The round 44px button used in every header: search, bell, back, share.
 * `dot` adds the small unread mark.
 */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'sunken',
  filled = false,
  dot = false,
}: {
  icon: IconName;
  /** What a screen reader says; the button has no visible text. */
  label: string;
  onPress: () => void;
  tone?: 'sunken' | 'raised' | 'ink';
  filled?: boolean;
  dot?: boolean;
}) {
  const tokens = useTokens();
  const surface =
    tone === 'ink' ? 'bg-ink' : tone === 'raised' ? 'bg-surf-raised' : 'bg-surf-sunken';
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center rounded-full ${surface}`}
    >
      <Icon
        name={icon}
        size={20}
        color={tone === 'ink' ? tokens.onInk : tokens.text1}
        filled={filled}
      />
      {dot && (
        <View
          className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-surf-sunken"
          style={{ backgroundColor: POP.pink }}
        />
      )}
    </Press>
  );
}

/** The big title at the top of a tab, with its round buttons on the right. */
export function TabHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center gap-3 px-5 pb-2"
      style={{ paddingTop: insets.top + HEADER_GAP }}
    >
      <Text
        numberOfLines={1}
        accessibilityRole="header"
        className="flex-1 font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Round back button, a title and one optional round action, for pushed screens. */
export function BackHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: { icon: IconName; label: string; onPress: () => void; filled?: boolean };
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center gap-3 pb-1 pl-4 pr-5"
      style={{ paddingTop: insets.top + HEADER_GAP }}
    >
      <IconButton icon="chevronLeft" label="Back" onPress={onBack} />
      <Text
        numberOfLines={1}
        accessibilityRole="header"
        className="flex-1 font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
      >
        {title}
      </Text>
      {action && (
        <IconButton
          icon={action.icon}
          label={action.label}
          onPress={action.onPress}
          filled={action.filled}
        />
      )}
    </View>
  );
}

/** The heading over a group of cards, with an optional "See all". */
export function SectionTitle({
  children,
  actionLabel,
  onAction,
}: {
  children: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="w-full flex-row items-center">
      <Text
        accessibilityRole="header"
        className="flex-1 font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
      >
        {children}
      </Text>
      {actionLabel && (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={12}>
          <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

/**
 * Small drawing, one line, one action (Figma "Empty State"). Used for errors
 * too: the copy says what happened and what to do, never a status code.
 */
export function EmptyState({
  drawing,
  message,
  actionLabel,
  onAction,
}: {
  drawing: DrawingName;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { scheme } = useTheme();
  return (
    <View className="w-full items-center gap-4 px-6 py-8">
      {scheme === 'dark' ? (
        // The drawings are black line art, which disappears on a dark
        // surface. In dark mode they stand on a colour plate, as they do
        // everywhere else in the app.
        <View className="h-[196px] w-[196px] items-center justify-center rounded-full bg-pop-lime">
          <DrawingIn name={drawing} box={150} />
        </View>
      ) : (
        <Drawing name={drawing} width={158} />
      )}
      <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">{message}</Text>
      {actionLabel && (
        <Button label={actionLabel} variant="secondary" onPress={onAction} className="h-12" />
      )}
    </View>
  );
}

/** Inline banner at the top of a screen that is showing saved content. */
export function OfflineBar({
  message = 'You’re offline. Showing what you saved.',
}: {
  message?: string;
}) {
  const tokens = useTokens();
  return (
    <View
      accessibilityRole="alert"
      className="w-full flex-row items-center gap-2 bg-amber-tonal px-4 py-2"
    >
      <Icon name="cloudOffline" size={16} color={tokens.caution} />
      <Text className="flex-1 font-ui text-[14px] leading-5 text-ink-1">{message}</Text>
    </View>
  );
}

/**
 * A placeholder block that gently pulses while content loads. The shape
 * matches what will replace it, so nothing jumps when the data arrives.
 */
export function Skeleton({
  width = '100%',
  height,
  radius = 24,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.5, { duration: 800 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessible={false}
      className="bg-surf-sunken"
      style={[{ width, height, borderRadius: radius }, style]}
    />
  );
}

// ─── Guest ─────────────────────────────────────────────────────────────────

/**
 * Shown to signed-out readers (Figma "App/Guest Banner"). It sits beside the
 * content and never blocks it.
 */
export function GuestBanner({
  title,
  body,
  onSignUp,
}: {
  title: string;
  body: string;
  onSignUp: () => void;
}) {
  return (
    <PopCard colour="amber" className="w-full flex-row items-center gap-3 py-3 pl-4 pr-3">
      <View className="flex-1 gap-0.5">
        <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">{title}</Text>
        <Text className="font-ui text-[14px] leading-5 text-pop-on">{body}</Text>
      </View>
      <Press
        onPress={onSignUp}
        accessibilityLabel="Sign up"
        // Always dark: it sits on amber in both themes, so it must not follow
        // `ink` to cream in dark mode.
        className="h-11 items-center justify-center rounded-full bg-pop-on px-5"
      >
        <Text className="font-ui-sb text-[14px] leading-5" style={{ color: '#FDFAF5' }}>
          Sign up
        </Text>
      </Press>
    </PopCard>
  );
}

// ─── Verse ─────────────────────────────────────────────────────────────────

/**
 * The day's memory verse, full width, in the reader's serif (Figma
 * "Card/Verse of the Day").
 */
export function VerseCard({
  verse,
  reference,
  attribution,
}: {
  verse: string;
  reference?: string | null;
  /** The copyright line licensed translations require (08-bible-experience.md §11). */
  attribution?: string | null;
}) {
  return (
    <View className="w-full gap-3 overflow-hidden rounded-2xl bg-pop-violet px-5 pb-5 pt-5">
      <View pointerEvents="none" style={{ position: 'absolute', right: -16, top: -28, opacity: 0.14 }}>
        <Icon name="book" size={120} color={POP.on} />
      </View>
      <Text className="font-ui-md text-[12px] uppercase leading-4 text-pop-on">Verse of the day</Text>
      <Text className="font-read-md text-[22px] leading-8 text-pop-on">{verse}</Text>
      {!!reference && (
        <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">{reference}</Text>
      )}
      {!!attribution && (
        <Text className="font-ui text-[11px] leading-4 text-pop-on opacity-70">{attribution}</Text>
      )}
    </View>
  );
}

// ─── Sheet ─────────────────────────────────────────────────────────────────

/**
 * A bottom sheet over a scrim. Tapping the scrim or the system back gesture
 * closes it — a sheet is an offer, never a trap.
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(28, 25, 22, 0.48)' }}
        />
        <View
          accessibilityViewIsModal
          className="items-center gap-3 rounded-t-[36px] bg-surf-raised px-6 pt-2"
          style={[{ paddingBottom: Math.max(insets.bottom, 24) }, ELEVATION.sheet]}
        >
          <View className="h-1 w-10 rounded-full bg-line-strong" />
          {children}
        </View>
      </View>
    </Modal>
  );
}
