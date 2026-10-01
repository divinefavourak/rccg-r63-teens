import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { Object3D, type ObjectName } from './art';
import { POP_BG } from './cards';
import { StepperBar } from './inputs';
import { Press } from './Press';
import { useTokens } from '../theme/ThemeProvider';
import type { PopColour } from '../theme/tokens';

/** The question's entrance, by direction of travel. */
const SLIDE = {
  [1]: FadeInRight.duration(220),
  [-1]: FadeInLeft.duration(220),
} as const;

/** Space between the status bar and the back button / progress bar. */
const TOP_GAP = 16;

/**
 * The frame every question shares: a bar at the top, the question with its 3D
 * badge, the answer, and one pinned action.
 *
 * The bar and the action never move. When `step` changes, only the middle is
 * replaced: the question fades in with a short shift from the side the teen is
 * heading towards, the badge scales in, and the answers rise a beat later.
 * Deliberately gentle — short eased moves, no spring or overshoot (a bouncier
 * version was tried and felt like too much). Reanimated honours the system
 * "reduce motion" setting, so they simply appear for anyone who has it on.
 *
 * The action sits outside the scroll view and above the keyboard, so it is
 * always reachable with a thumb however long the list of options is.
 */
export function QuestionScreen({
  step,
  total,
  direction = 1,
  onBack,
  eyebrow,
  title,
  helper,
  badge,
  badgeColour,
  children,
  footer,
}: {
  /** Omit both for a screen outside the numbered steps (Verify). */
  step?: number;
  total?: number;
  /** 1 when moving forward, -1 when going back: which side the question enters from. */
  direction?: 1 | -1;
  onBack: () => void;
  eyebrow?: string;
  title: string;
  helper?: string;
  badge: ObjectName;
  badgeColour: PopColour;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surf-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // Figma draws the bar under a 44px status bar. A real inset is often
      // smaller (24–30px on Android), which left the bar hugging the top edge,
      // so it gets its own space on top of whatever the device reports.
      style={{ paddingTop: insets.top + TOP_GAP }}
    >
      {step && total ? (
        <StepperBar step={step} total={total} onBack={onBack} />
      ) : (
        <View className="h-14 flex-row items-center pl-4 pr-5">
          <Press
            onPress={onBack}
            accessibilityLabel="Back"
            className="h-11 w-11 items-center justify-center rounded-full bg-surf-sunken"
          >
            <Icon name="chevronLeft" size={24} color={tokens.text1} />
          </Press>
        </View>
      )}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Keyed by step, so each question is a fresh view that plays its
            entrance. No exit animation on purpose: the old question would
            still be in the layout while the new one arrived, and the two
            would stack for a moment. */}
        <Animated.View key={step ?? 'only'} entering={SLIDE[direction]}>
          <View className="flex-row items-center gap-3 px-5 pt-3">
            <View className="flex-1 gap-2">
              {eyebrow && (
                <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[1.44px] text-ink-3">
                  {eyebrow}
                </Text>
              )}
              <Text
                accessibilityRole="header"
                className="font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
              >
                {title}
              </Text>
            </View>
            <Animated.View entering={ZoomIn.duration(200).delay(60)}>
              <View
                className={`h-24 w-24 items-center justify-center rounded-full ${POP_BG[badgeColour]}`}
              >
                <Object3D name={badge} size={84} />
              </View>
            </Animated.View>
          </View>

          {helper && (
            <Text className="px-5 pt-2 font-ui text-[16px] leading-6 text-ink-2">{helper}</Text>
          )}

          <Animated.View entering={FadeInDown.duration(220).delay(70)}>
            <View className="gap-3 px-5 pt-5">{children}</View>
          </Animated.View>
        </Animated.View>
      </ScrollView>

      <View className="px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

/** A line of problem copy above the action, announced to screen readers. */
export function FormError({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      className="mb-3 text-center font-ui-md text-[14px] leading-5 text-feedback-error"
    >
      {children}
    </Text>
  );
}
