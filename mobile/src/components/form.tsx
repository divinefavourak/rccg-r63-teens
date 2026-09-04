import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Icon } from './Icon';
import { Grabber } from './ui';
import { useTokens } from '../theme/ThemeProvider';

/**
 * Form primitives.
 *
 * 10-design-system.md: label-above, 48px minimum height, errors inline below
 * the field in specific language, and **mobile uses bottom sheets, not
 * dropdowns** — which is why `SelectField` opens a sheet rather than a picker
 * wheel or a menu.
 */

// ─── Field shell ───────────────────────────────────────────────────────────

export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const tokens = useTokens();

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-ui-sb text-[13px] text-ink-2">
        {label}
        {!required && <Text className="font-ui text-ink-3"> (optional)</Text>}
      </Text>

      <View
        className="min-h-[48px] flex-row items-center gap-2 rounded-md bg-surf-raised px-3.5"
        style={{ borderWidth: 1, borderColor: error ? tokens.error : tokens.border }}
      >
        {children}
      </View>

      {/* Error wins over hint: showing both competes for the same glance. */}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-1.5 font-ui-md text-[12px] leading-[17px]"
          style={{ color: tokens.error }}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text className="mt-1.5 font-ui text-[12px] leading-[17px] text-ink-3">{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── Text ──────────────────────────────────────────────────────────────────

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
  autoComplete,
  secureTextEntry,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoComplete?: 'email' | 'tel' | 'name' | 'username' | 'new-password' | 'off';
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  const tokens = useTokens();

  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.text3}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        className="flex-1 font-ui text-[15px] text-ink-1"
        style={{ paddingVertical: multiline ? 12 : 0, minHeight: multiline ? 96 : 46 }}
      />
    </Field>
  );
}

// ─── Select ────────────────────────────────────────────────────────────────

export interface Option {
  value: string;
  label: string;
}

/**
 * A select that opens a bottom sheet.
 *
 * The design system is explicit that mobile pickers are sheets. It also keeps
 * long option lists (seven provinces, dozens of parishes) readable at 44px
 * touch targets, which a native picker wheel does not.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  hint,
  required,
  placeholder = 'Choose…',
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const tokens = useTokens();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  const pick = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <>
      <Field label={label} error={error} hint={hint} required={required}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}. ${selected?.label ?? 'nothing selected'}`}
          className="h-[46px] flex-1 flex-row items-center justify-between"
        >
          <Text
            className={`font-ui text-[15px] ${selected ? 'text-ink-1' : 'text-ink-3'}`}
            numberOfLines={1}
          >
            {selected?.label ?? placeholder}
          </Text>
          <Icon name="chevronDown" size={18} color={tokens.text3} />
        </Pressable>
      </Field>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel={`Close ${label}`}
          style={{ flex: 1, backgroundColor: tokens.surfOverlay, justifyContent: 'flex-end' }}
        >
          <Animated.View
            entering={SlideInDown.duration(280)}
            onStartShouldSetResponder={() => true}
            className="rounded-t-2xl bg-surf-raised pb-8"
            style={{ maxHeight: '70%' }}
          >
            <Grabber />
            <Text className="px-5 pb-3 font-ui-b text-[17px] text-ink-1">{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => pick(o.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className="flex-row items-center justify-between border-b border-line px-5 py-3.5"
                    style={{ backgroundColor: active ? tokens.greenSoft : 'transparent' }}
                  >
                    <Text
                      className={active ? 'font-ui-sb text-[15px]' : 'font-ui text-[15px]'}
                      style={{ color: active ? tokens.green : tokens.text1 }}
                    >
                      {o.label}
                    </Text>
                    {active && <Icon name="check" size={18} color={tokens.green} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Date ──────────────────────────────────────────────────────────────────

/**
 * A date of birth field.
 *
 * The native picker rather than three text inputs: typing a date is the single
 * most error-prone thing a form can ask for, and the platform control already
 * knows about month lengths and locale ordering.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
}: {
  /** ISO `YYYY-MM-DD`, or empty. */
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const tokens = useTokens();
  const [open, setOpen] = useState(false);

  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const valid = parsed && !Number.isNaN(parsed.getTime());

  return (
    <>
      <Field label={label} error={error} hint={hint} required={required}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}. ${valid ? parsed.toDateString() : 'not set'}`}
          className="h-[46px] flex-1 flex-row items-center justify-between"
        >
          <Text className={`font-ui text-[15px] ${valid ? 'text-ink-1' : 'text-ink-3'}`}>
            {valid
              ? parsed.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : 'Choose a date'}
          </Text>
          <Icon name="calendar" size={18} color={tokens.text3} />
        </Pressable>
      </Field>

      {open && (
        <DateTimePicker
          value={valid ? parsed : new Date(2010, 0, 1)}
          mode="date"
          // Nobody in this product was born tomorrow.
          maximumDate={new Date()}
          minimumDate={new Date(1950, 0, 1)}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            // Android fires once and dismisses itself; iOS keeps the spinner up
            // until the sheet is closed.
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'dismissed' || !date) return;
            onChange(toISODate(date));
          }}
        />
      )}

      {open && Platform.OS === 'ios' && (
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          className="mb-4 h-11 items-center justify-center rounded-md bg-green/10"
        >
          <Text className="font-ui-sb text-[14px] text-green">Done</Text>
        </Pressable>
      )}
    </>
  );
}

/** Local-date ISO, avoiding the UTC shift `toISOString()` would introduce. */
export function toISODate(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// ─── Stepper ───────────────────────────────────────────────────────────────

/**
 * Progress across a multi-step form.
 *
 * Dots and connectors rather than a percentage bar: with three or four steps a
 * bar reads as noise, and the numbered dots tell a teen how much is left at a
 * glance. Mirrors the web app's `Register` page so the two feel like one
 * product.
 */
export function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  const tokens = useTokens();

  return (
    <View
      className="mb-6"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}
      accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
    >
      <View className="flex-row items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <View key={label} className="flex-1 flex-row items-center" style={{ flexGrow: i === steps.length - 1 ? 0 : 1 }}>
              <View
                className="h-6 w-6 items-center justify-center rounded-full"
                style={{
                  backgroundColor: done || active ? tokens.green : tokens.surfSunken,
                }}
              >
                {done ? (
                  <Icon name="check" size={13} color="#fff" />
                ) : (
                  <Text
                    className="font-ui-b text-[11px]"
                    style={{ color: active ? '#fff' : tokens.text3 }}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < steps.length - 1 && (
                <View
                  className="mx-1.5 h-px flex-1"
                  style={{ backgroundColor: done ? tokens.green : tokens.border }}
                />
              )}
            </View>
          );
        })}
      </View>

      <Text className="mt-2.5 font-ui-sb text-[13px] text-ink-2">{steps[current]}</Text>
    </View>
  );
}
