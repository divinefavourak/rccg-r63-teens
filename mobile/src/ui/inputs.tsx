import { memo, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import Animated, {
  useAnimatedStyle,
  Easing,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Icon, type IconName } from '../components/Icon';
import { Press } from './Press';
import { useTokens } from '../theme/ThemeProvider';
import { ELEVATION, POP } from '../theme/tokens';

/**
 * Applied to every `TextInput` in the kit.
 *
 * No vertical padding, because a fixed line height clips descenders in a
 * TextInput on Android and the field's row does the centring instead. And no
 * outline: on the web preview the browser draws its own focus ring inside the
 * field, on top of the ink border that already shows focus.
 */
export const INPUT_RESET = { paddingVertical: 0, outlineStyle: 'none' } as unknown as TextStyle;

// ─── Icon field ────────────────────────────────────────────────────────────

/**
 * Soft raised input with a leading icon (Figma "App/Icon Field"), used on
 * Log in. The label is the placeholder, so `label` is also what a screen
 * reader announces — an unlabelled field is a launch-gate failure.
 */
export function IconField({
  icon,
  label,
  value,
  onChange,
  secure = false,
  error,
  ...input
}: {
  icon: IconName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Hides the text and adds a Show / Hide control. */
  secure?: boolean;
  error?: string;
} & Pick<
  TextInputProps,
  'keyboardType' | 'autoCapitalize' | 'autoComplete' | 'returnKeyType' | 'onSubmitEditing' | 'autoFocus'
>) {
  const tokens = useTokens();
  const [hidden, setHidden] = useState(secure);

  return (
    <View className="w-full">
      <View
        className={`h-[60px] flex-row items-center gap-3 rounded-xl border bg-surf-raised px-5 ${
          error ? 'border-feedback-error' : 'border-line'
        }`}
        style={ELEVATION.card}
      >
        <Icon name={icon} size={24} color={tokens.text1} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={label}
          placeholderTextColor={tokens.text3}
          accessibilityLabel={label}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          className="min-w-0 flex-1 font-ui text-[16px] text-ink-1"
          style={INPUT_RESET}
          {...input}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={12}
          >
            <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">
              {hidden ? 'Show' : 'Hide'}
            </Text>
          </Pressable>
        )}
      </View>
      {error && (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-1.5 px-1 font-ui-md text-[12px] leading-4 text-feedback-error"
        >
          {error}
        </Text>
      )}
    </View>
  );
}

// ─── Text field ────────────────────────────────────────────────────────────

/**
 * Single-line text input (Figma "Text Field"): label above, sunken field, an
 * ink outline while focused, a specific error below.
 */
export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  large = false,
  ...input
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  /** The bigger, bolder value used for a phone number. */
  large?: boolean;
} & Pick<
  TextInputProps,
  | 'placeholder'
  | 'keyboardType'
  | 'autoCapitalize'
  | 'autoComplete'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'autoFocus'
  | 'maxLength'
  | 'textContentType'
>) {
  const tokens = useTokens();
  const [focused, setFocused] = useState(false);

  return (
    <View className="w-full gap-2">
      <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">{label}</Text>
      <View
        className={`h-14 flex-row items-center rounded-lg border-2 bg-surf-sunken px-4 ${
          error ? 'border-feedback-error' : focused ? 'border-ink' : 'border-transparent'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={tokens.text3}
          accessibilityLabel={label}
          autoCorrect={false}
          className={`min-w-0 flex-1 text-ink-1 ${
            large ? 'font-ui-b text-[20px] tracking-[-0.2px]' : 'font-ui text-[16px]'
          }`}
          style={INPUT_RESET}
          {...input}
        />
      </View>
      {(error || hint) && (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          className={`font-ui-md text-[12px] leading-4 ${
            error ? 'text-feedback-error' : 'text-ink-3'
          }`}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

// ─── One-time code ─────────────────────────────────────────────────────────

/**
 * Six code cells (Figma "OTP Cell") drawn over one hidden input.
 *
 * One real `TextInput` rather than six: the OS can then autofill the code from
 * the SMS or the keyboard suggestion in a single paste, and backspace works
 * across cells without any focus juggling. The cells are a picture of its value.
 */
export function OtpCells({
  value,
  onChange,
  length = 6,
  error = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessible={false}
      className="w-full flex-row justify-between"
    >
      {Array.from({ length }, (_, i) => {
        const active = focused && i === Math.min(value.length, length - 1);
        return (
          <View
            key={i}
            className={`h-14 w-12 items-center justify-center rounded-lg border-2 bg-surf-sunken ${
              error ? 'border-feedback-error' : active ? 'border-ink' : 'border-transparent'
            }`}
          >
            <Text className="font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-ink-1">
              {value[i] ?? ''}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={`${length}-digit code`}
        // Present and focusable, but invisible: the cells above are what shows.
        style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }}
      />
    </Pressable>
  );
}

// ─── Search and breadcrumbs ────────────────────────────────────────────────

/** The pill search box above a long list of options. */
export function SearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const tokens = useTokens();
  return (
    <View className="h-[52px] w-full flex-row items-center gap-2 rounded-full bg-surf-sunken px-4">
      <Icon name="search" size={20} color={tokens.text3} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={tokens.text3}
        accessibilityLabel={label}
        autoCorrect={false}
        returnKeyType="search"
        className="min-w-0 flex-1 font-ui text-[16px] text-ink-1"
        style={INPUT_RESET}
      />
    </View>
  );
}

/** The choices made so far, as small green pills ("Region 63", "Province 69"). */
export function Crumbs({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5" accessibilityLabel={items.join(', ')}>
      {items.map((item) => (
        <View key={item} className="rounded-full bg-green-tonal px-3 py-1">
          <Text className="font-ui-sb text-[12px] leading-4 text-green">{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Option row ────────────────────────────────────────────────────────────

/**
 * One choice per row in the sign-up steps (Figma "App/Option Row").
 *
 * Selection is shown three ways at once — the fill, the tick and the
 * `selected` state for screen readers — so it never rests on colour alone.
 */
export const OptionRow = memo(function OptionRow({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="radio"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      accessibilityState={{ selected, checked: selected }}
      className={`h-[60px] w-full flex-row items-center gap-3 rounded-xl pl-5 pr-4 ${
        selected ? 'bg-ink' : 'bg-surf-sunken'
      }`}
    >
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className={`font-ui-sb text-[16px] leading-6 ${selected ? 'text-on-ink' : 'text-ink-1'}`}
        >
          {title}
        </Text>
        {detail && (
          <Text
            numberOfLines={1}
            className={`font-ui-md text-[12px] leading-4 ${selected ? 'text-on-ink' : 'text-ink-3'}`}
          >
            {detail}
          </Text>
        )}
      </View>
      {selected ? (
        // The tick scales in, without overshoot. Styled inline: on the web preview an
        // animated view drops class-based styles.
        <Animated.View
          entering={ZoomIn.duration(160)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: POP.green,
          }}
        >
          <Icon name="check" size={16} color={POP.on} />
        </Animated.View>
      ) : (
        <View className="h-7 w-7 rounded-full border-2 border-line-strong" />
      )}
    </Press>
  );
});

// ─── Stepper ───────────────────────────────────────────────────────────────

/**
 * Back button, segmented progress and "5/8" for the one-question-per-screen
 * sign-up. `step` is 1-based, matching what the teen reads.
 */
export function StepperBar({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack: () => void;
}) {
  const tokens = useTokens();
  return (
    <View className="h-14 flex-row items-center gap-3 pl-4 pr-5">
      <Press
        onPress={onBack}
        accessibilityLabel="Back"
        className="h-11 w-11 items-center justify-center rounded-full bg-surf-sunken"
      >
        <Icon name="chevronLeft" size={24} color={tokens.text1} />
      </Press>
      <View
        className="flex-1 flex-row items-center gap-1"
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${total}`}
        accessibilityValue={{ min: 0, max: total, now: step }}
      >
        {Array.from({ length: total }, (_, i) => (
          <ProgressSegment key={i} filled={i < step} colour={tokens.ink} />
        ))}
      </View>
      <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">
        {step}/{total}
      </Text>
    </View>
  );
}

/**
 * One segment of the progress bar. It fills from the left when its step is
 * reached and drains the same way on Back, so progress is
 * something you watch happen rather than a bar that redraws.
 */
function ProgressSegment({ filled, colour }: { filled: boolean; colour: string }) {
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [filled, fill]);

  const style = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
      <Animated.View style={[{ height: '100%', borderRadius: 999, backgroundColor: colour }, style]} />
    </View>
  );
}
