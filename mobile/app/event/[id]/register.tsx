import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEvent, useProfile, useRegisterForEvent } from '../../../src/api/queries';
import type { EventRegistrationInput } from '../../../src/api/types';
import { EventPhoto } from '../../../src/components/EventPieces';
import { GUARDIAN_RELATIONSHIPS, PROVINCES } from '../../../src/data/choices';
import { dayLabel, priceLabel, startOf, whereLabel } from '../../../src/data/events';
import { useAuth } from '../../../src/state/auth';
import { Object3D } from '../../../src/ui/art';
import { Button } from '../../../src/ui/Button';
import { ChipRow, TextField, Toggle } from '../../../src/ui/inputs';
import { BackHeader, EmptyState, Skeleton } from '../../../src/ui/screen';

/** The fields the server insists on (`EventRegistrationCreateSerializer`). */
type Required =
  | 'attendee_name'
  | 'attendee_email'
  | 'attendee_phone'
  | 'attendee_age'
  | 'attendee_province'
  | 'attendee_parish'
  | 'guardian_name'
  | 'guardian_phone'
  | 'guardian_email'
  | 'guardian_relationship';

/** Always on the form, as designed. The rest appear only if we do not know them. */
const ALWAYS: Required[] = ['attendee_name', 'attendee_parish', 'guardian_phone'];

type Form = Record<Required, string>;

const EMPTY: Form = {
  attendee_name: '',
  attendee_email: '',
  attendee_phone: '',
  attendee_age: '',
  attendee_province: '',
  attendee_parish: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
  guardian_relationship: '',
};

/**
 * Registering for an event (Figma "Register").
 *
 * The endpoint wants ten things about the teen and a guardian. The profile
 * already knows most of them, so the screen shows three to check and adds a
 * field only for what is missing. One screen, not steps: for a teen whose
 * profile is complete this is a glance and a tap.
 */
export default function EventRegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();

  const event = useEvent(id);
  const profile = useProfile(!isGuest);
  const register = useRegisterForEvent(id);

  const [form, setForm] = useState<Form>(EMPTY);
  /**
   * Which fields to show. Decided once, when the profile arrives — deciding it
   * from the live values would make a field vanish as soon as it was typed in.
   */
  const [fields, setFields] = useState<Required[] | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    // A disabled query stays "pending" for ever, hence the guest check.
    if (fields || (profile.isPending && !isGuest)) return;
    const p = profile.data;
    const known: Form = {
      attendee_name:
        p?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '',
      attendee_email: p?.user_email || user?.email || '',
      attendee_phone: user?.phone || '',
      attendee_age: p?.age ? String(p.age) : '',
      attendee_province: p?.province || user?.province || '',
      attendee_parish: p?.parish || user?.parish || '',
      guardian_name: p?.guardian_name || '',
      guardian_phone: p?.guardian_phone || '',
      guardian_email: p?.guardian_email || '',
      guardian_relationship: p?.guardian_relationship || '',
    };
    setForm(known);
    setFields(
      (Object.keys(known) as Required[]).filter((key) => ALWAYS.includes(key) || !known[key]),
    );
  }, [fields, profile.isPending, profile.data, user, isGuest]);

  const set = useCallback((key: Required, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const needsConsent = !!event.data?.requires_guardian_consent;
  const age = Number(form.attendee_age);
  const complete = useMemo(
    () =>
      (Object.keys(form) as Required[]).every((key) => form[key].trim().length > 0) &&
      Number.isInteger(age) &&
      age > 0 &&
      (!needsConsent || consent),
    [form, age, needsConsent, consent],
  );

  const submit = useCallback(async () => {
    if (!complete) return;
    const input: EventRegistrationInput = {
      ...form,
      attendee_age: age,
      attendee_date_of_birth: profile.data?.date_of_birth ?? undefined,
      attendee_gender: profile.data?.gender ?? undefined,
      attendee_zone: profile.data?.zone ?? undefined,
      attendee_area: profile.data?.area ?? undefined,
      guardian_consent: consent,
    };
    try {
      const registration = await register.mutateAsync(input);
      // Replace, so Back from the ticket returns to the event, not this form.
      router.replace({ pathname: '/ticket/[id]', params: { id: registration.id } });
    } catch {
      // Shown above the button; the form stays as typed.
    }
  }, [complete, form, age, profile.data, consent, register, router]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/tribe'));
  const shows = (key: Required) => !!fields?.includes(key);

  if (event.isPending || !fields) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Register" onBack={back} />
        <View className="gap-4 px-5 pt-4">
          <Skeleton width="60%" height={40} radius={8} />
          <Skeleton height={72} radius={20} />
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
        </View>
      </View>
    );
  }

  if (!event.data) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Register" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load this event. Check your connection, then try again."
            actionLabel="Try again"
            onAction={() => event.refetch()}
          />
        </View>
      </View>
    );
  }

  const price = priceLabel(event.data);
  const paid = !event.data.is_free;
  const summary = [dayLabel(startOf(event.data)), whereLabel(event.data)].filter(Boolean).join(' · ');
  const extra = fields.filter((key) => !ALWAYS.includes(key));

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Register" onBack={back} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        >
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-2">
              <Text
                accessibilityRole="header"
                className="font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
              >
                Almost there
              </Text>
              <Text className="font-ui text-[16px] leading-6 text-ink-2">
                Check your details and you’re in.
              </Text>
            </View>
            <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-pop-lime">
              <Object3D name="thumb-up" size={76} />
            </View>
          </View>

          <View className="w-full flex-row items-center gap-3 rounded-xl bg-surf-sunken py-2 pl-2 pr-3">
            <EventPhoto event={event.data} style={{ width: 56, height: 56, borderRadius: 14 }} />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-ink-1">
                {event.data.title}
              </Text>
              <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-ink-2">
                {summary}
              </Text>
            </View>
          </View>

          <TextField
            label="Full name"
            value={form.attendee_name}
            onChange={(v) => set('attendee_name', v)}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextField
            label="Your parish"
            value={form.attendee_parish}
            onChange={(v) => set('attendee_parish', v)}
            autoCapitalize="words"
          />
          <TextField
            label="Parent or guardian’s phone"
            value={form.guardian_phone}
            onChange={(v) => set('guardian_phone', v)}
            keyboardType="phone-pad"
            placeholder="0803 555 0142"
            hint="We only use this number to reach a parent or guardian about this event."
          />

          {extra.length > 0 && (
            <Text
              accessibilityRole="header"
              className="pt-2 font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
            >
              A few more details
            </Text>
          )}

          {shows('attendee_email') && (
            <TextField
              label="Your email address"
              value={form.attendee_email}
              onChange={(v) => set('attendee_email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
          {shows('attendee_phone') && (
            <TextField
              label="Your phone number"
              value={form.attendee_phone}
              onChange={(v) => set('attendee_phone', v)}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          )}
          {shows('attendee_age') && (
            <TextField
              label="Your age"
              value={form.attendee_age}
              onChange={(v) => set('attendee_age', v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
            />
          )}
          {shows('attendee_province') && (
            <View className="gap-2">
              <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">Your province</Text>
              <ChipRow
                wrap
                options={PROVINCES}
                value={form.attendee_province}
                onChange={(v) => set('attendee_province', v)}
              />
            </View>
          )}
          {shows('guardian_name') && (
            <TextField
              label="Parent or guardian’s name"
              value={form.guardian_name}
              onChange={(v) => set('guardian_name', v)}
              autoCapitalize="words"
            />
          )}
          {shows('guardian_email') && (
            <TextField
              label="Parent or guardian’s email"
              value={form.guardian_email}
              onChange={(v) => set('guardian_email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}
          {shows('guardian_relationship') && (
            <View className="gap-2">
              <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">Who are they to you?</Text>
              <ChipRow
                wrap
                options={GUARDIAN_RELATIONSHIPS}
                value={form.guardian_relationship}
                onChange={(v) => set('guardian_relationship', v)}
              />
            </View>
          )}

          {needsConsent && (
            <View className="flex-row items-center gap-3 rounded-xl bg-surf-sunken p-4">
              <Text className="flex-1 font-ui-sb text-[16px] leading-6 text-ink-1">
                My parent or guardian knows about this event and says I can go.
              </Text>
              <Toggle on={consent} onChange={setConsent} label="My parent or guardian agrees" />
            </View>
          )}

          {paid && (
            <Text className="font-ui text-[14px] leading-5 text-ink-2">
              This event costs {price}. Registering holds your place, and your teen leader will
              confirm it once the payment is in.
            </Text>
          )}
        </ScrollView>

        <View className="gap-2 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {register.isError && (
            <Text
              accessibilityLiveRegion="polite"
              className="text-center font-ui-md text-[14px] leading-5 text-feedback-error"
            >
              {register.error instanceof Error
                ? register.error.message
                : 'That did not go through. Please try again.'}
            </Text>
          )}
          <Button
            label={paid ? `Register · ${price}` : 'Register'}
            onPress={submit}
            disabled={!complete}
            loading={register.isPending}
            className="w-full"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
