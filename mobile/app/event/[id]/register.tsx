import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../../src/components/Icon';
import { Button, Card } from '../../../src/components/ui';
import { DateField, SelectField, StepProgress, TextField } from '../../../src/components/form';
import { ErrorState, Skeleton } from '../../../src/components/states';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { useAuth } from '../../../src/state/auth';
import { useEvent, useProfile, useRegisterForEvent } from '../../../src/api/queries';
import { PROVINCES, GENDERS, GUARDIAN_RELATIONSHIPS } from '../../../src/data/choices';
import { formatNaira } from '../../../src/components/EventCard';
import type { EventRegistrationInput } from '../../../src/api/types';

const STEPS = ['About you', 'Your church', 'Guardian'];

/**
 * Event registration.
 *
 * `POST /events/events/{id}/register/` requires eleven attendee and guardian
 * fields. Asking for eleven on one screen is how sign-ups get abandoned, so
 * this is three steps — the same shape as the web app's `Register` page.
 *
 * Almost everything is prefilled from `/profiles/me/`: the teen confirms rather
 * than types. Guardian details in particular are already on the profile, and
 * re-asking a 14-year-old for their parent's email is the fastest way to lose
 * them.
 */
export default function EventRegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { user, isGuest } = useAuth();

  const event = useEvent(id);
  const profile = useProfile(!isGuest);
  const register = useRegisterForEvent(id);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<EventRegistrationInput>>({});
  const [prefilled, setPrefilled] = useState(false);

  // Prefill once, when the profile lands. Guarded so it never overwrites
  // something the teen has already corrected.
  useEffect(() => {
    if (prefilled || !profile.data) return;
    const p = profile.data;

    setForm((prev) => ({
      attendee_name: p.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' '),
      attendee_email: p.user_email || user?.email || '',
      attendee_phone: '',
      attendee_age: p.age ?? undefined,
      attendee_date_of_birth: p.date_of_birth ?? undefined,
      attendee_gender: p.gender ?? undefined,
      attendee_province: p.province ?? '',
      attendee_zone: p.zone ?? undefined,
      attendee_area: p.area ?? undefined,
      attendee_parish: p.parish ?? '',
      ...prev,
    }));
    setPrefilled(true);
  }, [profile.data, user, prefilled]);

  const set = useCallback(<K extends keyof EventRegistrationInput>(
    key: K,
    value: EventRegistrationInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * What is still missing on this step.
   *
   * Drives the disabled state of Next rather than a toast on submit: the teen
   * should be able to see what is wrong before committing.
   */
  const missing = useMemo(() => {
    if (step === 0) {
      const gaps: string[] = [];
      if (!form.attendee_name?.trim()) gaps.push('attendee_name');
      if (!form.attendee_email?.trim()) gaps.push('attendee_email');
      if (!form.attendee_phone?.trim()) gaps.push('attendee_phone');
      if (!form.attendee_age) gaps.push('attendee_age');
      return gaps;
    }
    if (step === 1) {
      const gaps: string[] = [];
      if (!form.attendee_province) gaps.push('attendee_province');
      if (!form.attendee_parish?.trim()) gaps.push('attendee_parish');
      return gaps;
    }
    const gaps: string[] = [];
    if (!form.guardian_name?.trim()) gaps.push('guardian_name');
    if (!form.guardian_phone?.trim()) gaps.push('guardian_phone');
    if (!form.guardian_email?.trim()) gaps.push('guardian_email');
    if (!form.guardian_relationship) gaps.push('guardian_relationship');
    return gaps;
  }, [step, form]);

  const submit = useCallback(async () => {
    if (missing.length > 0) return;
    try {
      await register.mutateAsync(form as EventRegistrationInput);
      router.replace({ pathname: '/event/[id]', params: { id } });
    } catch {
      // The error is surfaced inline below; the form stays put so nothing is
      // retyped.
    }
  }, [missing, register, form, router, id]);

  if (event.isPending || (profile.isPending && !isGuest)) {
    return (
      <View className="flex-1 gap-4 bg-surf-base p-6" style={{ paddingTop: insets.top + 24 }}>
        <Skeleton width="60%" height={26} />
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </View>
    );
  }

  if (event.isError || !event.data) {
    return (
      <View className="flex-1 justify-center bg-surf-base">
        <ErrorState error={event.error} onRetry={event.refetch} />
      </View>
    );
  }

  const price = event.data.is_free
    ? null
    : formatNaira(event.data.current_price ?? event.data.price);

  return (
    <View className="flex-1 bg-surf-base">
      <View
        className="flex-row items-center gap-2 border-b border-line bg-surf-raised px-4 pb-3.5"
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable
          onPress={router.back}
          accessibilityRole="button"
          accessibilityLabel="Cancel registration"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-md border border-line"
        >
          <Icon name="close" size={18} color={tokens.text2} />
        </Pressable>
        <View className="flex-1">
          <Text numberOfLines={1} className="font-ui-b text-[15px] text-ink-1">
            {event.data.title}
          </Text>
          <Text className="font-ui text-[12px] text-ink-3">
            {price ? `Registration — ${price}` : 'Free registration'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepProgress steps={STEPS} current={step} />

          {step === 0 && (
            <>
              <TextField
                label="Full name"
                required
                value={form.attendee_name ?? ''}
                onChange={(v) => set('attendee_name', v)}
                autoCapitalize="words"
                autoComplete="name"
              />
              <TextField
                label="Email"
                required
                value={form.attendee_email ?? ''}
                onChange={(v) => set('attendee_email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <TextField
                label="Phone"
                required
                value={form.attendee_phone ?? ''}
                onChange={(v) => set('attendee_phone', v)}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="080…"
              />
              <DateField
                label="Date of birth"
                required
                value={form.attendee_date_of_birth ?? ''}
                onChange={(iso) => {
                  set('attendee_date_of_birth', iso);
                  // Age is a required field of its own, and the server checks it
                  // against the event's min/max — so it is derived here rather
                  // than asked for twice.
                  const years = ageFrom(iso);
                  if (years !== undefined) set('attendee_age', years);
                }}
                hint={
                  form.attendee_age !== undefined
                    ? `Age ${form.attendee_age}`
                    : 'Used to check the age range for this event'
                }
              />
              <SelectField
                label="Gender"
                value={form.attendee_gender ?? ''}
                options={GENDERS}
                onChange={(v) => set('attendee_gender', v)}
              />
            </>
          )}

          {step === 1 && (
            <>
              <SelectField
                label="Province"
                required
                value={form.attendee_province ?? ''}
                options={PROVINCES}
                onChange={(v) => set('attendee_province', v)}
              />
              <TextField
                label="Parish"
                required
                value={form.attendee_parish ?? ''}
                onChange={(v) => set('attendee_parish', v)}
                autoCapitalize="words"
                placeholder="e.g. RCCG Victory House"
              />
              <TextField
                label="Zone"
                value={form.attendee_zone ?? ''}
                onChange={(v) => set('attendee_zone', v)}
                autoCapitalize="words"
              />
              <TextField
                label="Area"
                value={form.attendee_area ?? ''}
                onChange={(v) => set('attendee_area', v)}
                autoCapitalize="words"
              />
            </>
          )}

          {step === 2 && (
            <>
              <Card className="mb-5 flex-row items-start gap-3 p-4">
                <Icon name="lock" size={18} color={tokens.green} />
                <Text className="flex-1 font-ui text-[13px] leading-[19px] text-ink-2">
                  A parent or guardian is required for every teen event. We only use these
                  details for safeguarding and emergencies.
                </Text>
              </Card>

              <TextField
                label="Guardian name"
                required
                value={form.guardian_name ?? ''}
                onChange={(v) => set('guardian_name', v)}
                autoCapitalize="words"
              />
              <TextField
                label="Guardian phone"
                required
                value={form.guardian_phone ?? ''}
                onChange={(v) => set('guardian_phone', v)}
                keyboardType="phone-pad"
              />
              <TextField
                label="Guardian email"
                required
                value={form.guardian_email ?? ''}
                onChange={(v) => set('guardian_email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <SelectField
                label="Relationship"
                required
                value={form.guardian_relationship ?? ''}
                options={GUARDIAN_RELATIONSHIPS}
                onChange={(v) => set('guardian_relationship', v)}
              />
              <TextField
                label="Allergies or medical notes"
                value={form.medical_conditions ?? ''}
                onChange={(v) => set('medical_conditions', v)}
                multiline
                hint="Anything the team should know if you need help"
              />
            </>
          )}

          {register.isError && (
            <Text
              accessibilityLiveRegion="polite"
              className="mt-1 font-ui-md text-[13px] leading-[19px]"
              style={{ color: tokens.error }}
            >
              {register.error instanceof Error
                ? register.error.message
                : 'Could not register. Please try again.'}
            </Text>
          )}

          {price && step === STEPS.length - 1 && (
            <Card className="mt-4 flex-row items-center gap-3 p-4">
              <Icon name="ticket" size={18} color={tokens.amber} />
              <Text className="flex-1 font-ui text-[13px] leading-[19px] text-ink-2">
                This event costs {price}. Your place is held once you register; payment is
                confirmed by your teen leader.
              </Text>
            </Card>
          )}
        </ScrollView>

        {/* Docked controls — one-thumb reachability (05-navigation.md). */}
        <View
          className="flex-row gap-3 border-t border-line bg-surf-raised px-5 pt-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {step > 0 && (
            <Button
              label="Back"
              variant="secondary"
              onPress={() => setStep((s) => s - 1)}
              height={52}
              className="flex-1"
            />
          )}
          <Button
            label={step < STEPS.length - 1 ? 'Continue' : 'Register'}
            onPress={() => (step < STEPS.length - 1 ? setStep((s) => s + 1) : submit())}
            disabled={missing.length > 0}
            loading={register.isPending}
            height={52}
            className="flex-[2]"
            icon={
              step < STEPS.length - 1 ? (
                <Icon name="arrowRight" size={18} color="#fff" />
              ) : undefined
            }
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Whole years between an ISO date and today. */
function ageFrom(iso: string): number | undefined {
  const dob = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return undefined;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age -= 1;

  return age >= 0 && age < 120 ? age : undefined;
}
