import { memo, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '../components/Icon';
import { Press } from './Press';
import { useTokens } from '../theme/ThemeProvider';
import { ELEVATION, POP } from '../theme/tokens';

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
          // A fixed line height clips descenders in a TextInput on Android, so
          // the field is centred by the row instead.
          style={{ paddingVertical: 0 }}
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
        <View className="h-7 w-7 items-center justify-center rounded-full bg-pop-green">
          <Icon name="check" size={16} color={POP.on} />
        </View>
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
          <View
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-ink' : 'bg-line'}`}
          />
        ))}
      </View>
      <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">
        {step}/{total}
      </Text>
    </View>
  );
}
