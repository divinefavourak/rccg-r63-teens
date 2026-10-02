import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useChurchNodes } from '../../src/api/queries';
import type { ChurchLevel } from '../../src/api/types';
import { ageGroupFor } from '../../src/data/choices';
import { Icon } from '../../src/components/Icon';
import { toE164, useAuth } from '../../src/state/auth';
import {
  ageFrom,
  birthDate,
  CHURCH_STEPS,
  toDetails,
  useSignUp,
  type SignUpForm,
} from '../../src/state/signup';
import { FormError, QuestionScreen } from '../../src/ui/AuthShell';
import type { ObjectName } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import {
  Crumbs,
  INPUT_RESET,
  OptionRow,
  SearchField,
  TextField,
} from '../../src/ui/inputs';
import { PhoneField } from '../../src/ui/PhoneField';
import { Spinner } from '../../src/ui/Press';
import { useTokens } from '../../src/theme/ThemeProvider';
import { POP, type PopColour } from '../../src/theme/tokens';

const TOTAL = 8;

interface StepCopy {
  title: string;
  helper?: string;
  badge: ObjectName;
  colour: PopColour;
}

/** Steps 1–8, in the order the teen meets them. */
const STEPS: StepCopy[] = [
  { title: 'What should we call you?', badge: 'thumb-up', colour: 'lime' },
  {
    title: 'What’s your gender?',
    helper: 'It helps your leaders plan groups and camps. You can skip it.',
    badge: 'crown',
    colour: 'pink',
  },
  {
    title: 'How can we reach you?',
    helper: 'We will send one code to both, to check it is really you.',
    badge: 'chat-bubble',
    colour: 'sky',
  },
  {
    title: 'When were you born?',
    helper: 'Your age puts you in the right group. We never show it to anyone.',
    badge: 'calendar',
    colour: 'amber',
  },
  { title: 'Which region is your church in?', badge: 'map-pin', colour: 'violet' },
  { title: 'Which province?', badge: 'map-pin', colour: 'sky' },
  { title: 'Which zone?', badge: 'target', colour: 'pink' },
  { title: 'Last one. Which parish?', badge: 'star', colour: 'green' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * Sign-up, one question at a time.
 *
 * One screen, not eight. The back button, the progress bar and the action stay
 * exactly where they are; only the question in the middle changes, easing in
 * from the side the teen is moving towards. It reads as one form that keeps
 * asking, rather than a stack of pages.
 *
 * The code is requested once, when the last question is answered — not at the
 * contact step — so it cannot expire while the teen is still choosing a parish.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const { form, step, direction, goTo, set, chooseChurch } = useSignUp();
  const { startSignUp, pending, error, clearError } = useAuth();

  const churchLevel: ChurchLevel | null = step >= 5 ? CHURCH_STEPS[step - 5] : null;

  // The church list for this step. Fetched here rather than inside the picker
  // because the action below depends on it: a level with nothing in it must
  // not leave the teen facing a disabled button.
  const [search, setSearch] = useState('');
  useEffect(() => setSearch(''), [step]);
  const levelIndex = churchLevel ? CHURCH_STEPS.indexOf(churchLevel) : -1;
  const parentNode = levelIndex > 0 ? form.church[CHURCH_STEPS[levelIndex - 1]] : undefined;
  const nodes = useChurchNodes(
    parentNode?.id ?? null,
    churchLevel ?? 'region',
    search.trim(),
    !!churchLevel && (levelIndex === 0 || !!parentNode),
  );
  // Nothing has been set up at this level yet (not "the search found nothing").
  // The account is then attached to the deepest place that was chosen.
  const levelEmpty = !!churchLevel && search.trim() === '' && nodes.data?.length === 0;

  // A stale error from the previous attempt should not follow the teen around.
  useEffect(() => clearError, [clearError]);

  const dob = birthDate(form);
  const age = dob ? ageFrom(dob) : null;
  const ageGroup = age === null ? null : ageGroupFor(age);

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return form.firstName.trim().length > 0 && form.lastName.trim().length > 0;
      case 3:
        return EMAIL.test(form.email.trim()) && toE164(form.phone, form.country.dial) !== '';
      case 4:
        return ageGroup !== null && ageGroup.eligible;
      default:
        // Gender can be skipped; the church steps have "I am not sure", and a
        // level with nothing to choose from lets the teen finish.
        return churchLevel ? levelEmpty || !!form.church[churchLevel] : true;
    }
  }, [step, form, ageGroup, churchLevel, levelEmpty]);

  /** Send the code and move to the code screen. */
  const submit = useCallback(async () => {
    const details = toDetails(form);
    try {
      await startSignUp(details.email, details.phone);
      router.push('/verify');
    } catch {
      // `useAuth` holds the message; the step stays put.
    }
  }, [form, startSignUp, router]);

  const next = useCallback(() => {
    if (error) clearError();
    if (step < TOTAL && !levelEmpty) goTo(step + 1);
    else submit();
  }, [error, clearError, step, levelEmpty, goTo, submit]);

  /** "I am not sure": keep what was chosen above this level and finish. */
  const unsure = useCallback(() => {
    if (churchLevel) chooseChurch(churchLevel, null);
    submit();
  }, [churchLevel, chooseChurch, submit]);

  const back = useCallback(() => {
    if (error) clearError();
    if (step > 1) goTo(step - 1);
    else if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  }, [error, clearError, step, goTo, router]);

  // Android's system back should step through the questions like the on-screen
  // arrow does, not drop the whole form on the first press.
  useEffect(() => {
    if (step === 1) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goTo(step - 1);
      return true;
    });
    return () => sub.remove();
  }, [step, goTo]);

  const copy = STEPS[step - 1];

  return (
    <QuestionScreen
      step={step}
      total={TOTAL}
      direction={direction}
      onBack={back}
      eyebrow={`Step ${step} of ${TOTAL}`}
      title={copy.title}
      helper={copy.helper}
      badge={copy.badge}
      badgeColour={copy.colour}
      footer={
        <>
          <FormError>{error}</FormError>
          <Button
            label={step === TOTAL || levelEmpty ? 'Create my account' : 'Continue'}
            onPress={next}
            disabled={!canContinue}
            loading={pending}
            className="w-full"
          />
        </>
      }
    >
      {step === 1 && (
        <>
          <TextField
            label="First name"
            value={form.firstName}
            onChange={(v) => set('firstName', v)}
            autoCapitalize="words"
            autoComplete="given-name"
            autoFocus
          />
          <TextField
            label="Last name"
            value={form.lastName}
            onChange={(v) => set('lastName', v)}
            autoCapitalize="words"
            autoComplete="family-name"
            returnKeyType="next"
            onSubmitEditing={canContinue ? next : undefined}
          />
        </>
      )}

      {step === 2 &&
        GENDER_OPTIONS.map((option) => (
          <OptionRow
            key={option.value}
            title={option.label}
            selected={form.gender === option.value}
            // Tapping the chosen one again clears it: the question is optional.
            onPress={() => set('gender', form.gender === option.value ? '' : option.value)}
          />
        ))}

      {step === 3 && (
        <>
          <TextField
            label="Email address"
            value={form.email}
            onChange={(v) => set('email', v)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
          />
          <PhoneField
            country={form.country}
            onCountry={(c) => set('country', c)}
            value={form.phone}
            onChange={(v) => set('phone', v)}
          />
        </>
      )}

      {step === 4 && (
        <>
          <View className="flex-row gap-2">
            <DateTile
              label="Day"
              value={form.day}
              onChange={(v) => set('day', v)}
              maxLength={2}
              placeholder="14"
              className="w-[76px]"
            />
            <DateTile
              label="Month"
              value={form.month}
              onChange={(v) => set('month', v)}
              maxLength={2}
              placeholder="3"
              className="flex-1"
              caption={monthName(form.month)}
            />
            <DateTile
              label="Year"
              value={form.year}
              onChange={(v) => set('year', v)}
              maxLength={4}
              placeholder="2011"
              className="w-24"
            />
          </View>
          {age !== null && ageGroup && <AgeCard age={age} group={ageGroup} />}
        </>
      )}

      {churchLevel && (
        <ChurchPicker
          level={churchLevel}
          form={form}
          nodes={nodes}
          empty={levelEmpty}
          search={search}
          onSearch={setSearch}
          onUnsure={unsure}
          busy={pending}
        />
      )}
    </QuestionScreen>
  );
}

// ─── Date of birth ─────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthName(value: string): string | undefined {
  return MONTHS[Number(value) - 1];
}

/**
 * One of the three date tiles. Typed, not picked from a wheel: a teen knows
 * their birthday as numbers, and three short fields are quicker than scrolling
 * a year wheel back fifteen years.
 */
function DateTile({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  caption,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder: string;
  /** Shown under the number — the month's name once it is valid. */
  caption?: string;
  className: string;
}) {
  const tokens = useTokens();
  const [focused, setFocused] = useState(false);
  return (
    <View
      className={`gap-1 rounded-xl border-2 bg-surf-sunken px-4 py-3 ${
        focused ? 'border-ink' : 'border-transparent'
      } ${className}`}
    >
      <Text className="font-ui-md text-[12px] uppercase leading-4 text-ink-3">{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={tokens.borderStrong}
        accessibilityLabel={`${label} of birth`}
        keyboardType="number-pad"
        maxLength={maxLength}
        className="min-w-0 font-ui-b text-[20px] tracking-[-0.2px] text-ink-1"
        style={[INPUT_RESET, { height: 28 }]}
      />
      {caption && <Text className="font-ui-md text-[12px] leading-4 text-ink-2">{caption}</Text>}
    </View>
  );
}

function AgeCard({ age, group }: { age: number; group: { label: string; eligible: boolean } }) {
  if (!group.eligible) {
    return (
      <View className="rounded-xl bg-amber-tonal px-4 py-3" accessibilityLiveRegion="polite">
        <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">You are {age}</Text>
        <Text className="font-ui text-[14px] leading-5 text-ink-2">
          Faith Tribe accounts start at 6. Ask a parent or your teacher to help you join in.
        </Text>
      </View>
    );
  }
  return (
    <View
      className="flex-row items-center gap-3 rounded-xl bg-green-tonal py-3 pl-3 pr-4"
      accessibilityLiveRegion="polite"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-pop-green">
        <Icon name="check" size={20} color={POP.on} />
      </View>
      <View className="flex-1">
        <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">You are {age}</Text>
        <Text className="font-ui text-[14px] leading-5 text-ink-2">
          That puts you in {group.label}
        </Text>
      </View>
    </View>
  );
}

// ─── Church ────────────────────────────────────────────────────────────────

const LEVEL_WORD: Record<ChurchLevel, string> = {
  region: 'region',
  province: 'province',
  zone: 'zone',
  area: 'area',
  parish: 'parish',
};

function ChurchPicker({
  level,
  form,
  nodes,
  empty,
  search,
  onSearch,
  onUnsure,
  busy,
}: {
  level: ChurchLevel;
  form: SignUpForm;
  nodes: ReturnType<typeof useChurchNodes>;
  /** This level has nothing in it at all, as opposed to a search with no hits. */
  empty: boolean;
  search: string;
  onSearch: (value: string) => void;
  onUnsure: () => void;
  busy: boolean;
}) {
  const { chooseChurch } = useSignUp();

  const index = CHURCH_STEPS.indexOf(level);
  const chosen = form.church[level];
  const crumbs = CHURCH_STEPS.slice(0, index)
    .map((step) => form.church[step]?.name)
    .filter((name): name is string => !!name);
  const word = LEVEL_WORD[level];

  return (
    <>
      <Crumbs items={crumbs} />
      {level === 'parish' && !empty && (
        <SearchField label="Search parishes" value={search} onChange={onSearch} />
      )}

      {nodes.isPending && (
        <View className="h-[60px] items-center justify-center">
          <Spinner size={22} color={POP.green} />
        </View>
      )}

      {nodes.isError && (
        <View className="gap-2 rounded-xl bg-surf-sunken p-4">
          <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">
            We could not load the list
          </Text>
          <Text className="font-ui text-[14px] leading-5 text-ink-2">
            Check your connection and try again, or carry on without choosing.
          </Text>
          <Button label="Try again" variant="secondary" onPress={() => nodes.refetch()} />
        </View>
      )}

      {empty && (
        <View className="gap-1 rounded-xl bg-surf-sunken p-4">
          <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">
            No {word} to choose yet
          </Text>
          <Text className="font-ui text-[14px] leading-5 text-ink-2">
            {crumbs.length > 0
              ? `Your leaders have not added any under ${crumbs[crumbs.length - 1]}. We will put you there for now, and you can pick your ${word} later.`
              : `Your leaders have not added any. You can pick your ${word} later.`}
          </Text>
        </View>
      )}

      {!empty && nodes.data?.length === 0 && (
        <Text className="py-2 font-ui text-[14px] leading-5 text-ink-2">
          No {word} matches “{search.trim()}”.
        </Text>
      )}

      <View accessibilityRole="radiogroup" className="gap-3">
        {nodes.data?.map((node) => (
          <OptionRow
            key={node.id}
            title={node.name}
            selected={chosen?.id === node.id}
            onPress={() => chooseChurch(level, node)}
          />
        ))}
      </View>

      {!empty && (
        <Button
          label={level === 'parish' ? 'I can’t find my parish' : `I am not sure of my ${word}`}
          variant="tertiary"
          onPress={onUnsure}
          disabled={busy}
          className="w-full"
        />
      )}
    </>
  );
}
