import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { LogoLockup } from '../src/components/Logo';
import { Button } from '../src/components/ui';
import { DateField, SelectField, StepProgress, TextField } from '../src/components/form';
import { useTokens } from '../src/theme/ThemeProvider';
import { useAuth, type SignUpInput } from '../src/state/auth';
import { ageGroupFor, GENDERS, PROVINCES } from '../src/data/choices';

const STEPS = ['About you', 'Your church', 'Sign-in details'];

/**
 * Create an account.
 *
 * Three steps, because asking for ten fields on one screen is how sign-ups get
 * abandoned — the same reasoning and the same step names as the web app's
 * `Register` page, so a teen who has seen one recognises the other.
 *
 * Only six fields are actually required by `/auth/register/`; the church and
 * personal details are optional here and seed the profile, which in turn
 * prefills every event registration later.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { signUp, pending, error, clearError } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<SignUpInput>>({});

  const set = useCallback(
    <K extends keyof SignUpInput>(key: K, value: SignUpInput[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (error) clearError();
    },
    [error, clearError],
  );

  const ageGroup = useMemo(() => {
    if (!form.date_of_birth) return null;
    const dob = new Date(`${form.date_of_birth}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const md = today.getMonth() - dob.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < dob.getDate())) age -= 1;

    return ageGroupFor(age);
  }, [form.date_of_birth]);

  /** What is still missing on this step — drives the button, not a toast. */
  const blocked = useMemo(() => {
    if (step === 0) return !form.first_name?.trim() || !form.last_name?.trim();
    if (step === 1) return false; // Church details are all optional.
    return (
      !form.username?.trim() ||
      !form.email?.trim() ||
      !form.password ||
      form.password.length < 8 ||
      form.password !== form.password_confirm
    );
  }, [step, form]);

  const passwordError =
    form.password && form.password.length < 8
      ? 'Use at least 8 characters.'
      : form.password_confirm && form.password !== form.password_confirm
        ? 'Both passwords need to match.'
        : undefined;

  const submit = useCallback(async () => {
    if (blocked) return;
    try {
      await signUp(form as SignUpInput);
      // Straight into the app, already signed in.
      router.replace('/');
    } catch {
      // `useAuth` put a readable message in `error`; the form stays put.
    }
  }, [blocked, signUp, form, router]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surf-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="flex-row items-center gap-3 border-b border-line bg-surf-raised px-4 pb-3.5"
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable
          onPress={router.back}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-md border border-line"
        >
          <Icon name="close" size={18} color={tokens.text2} />
        </Pressable>
        <Text className="flex-1 font-ui-b text-[16px] text-ink-1">Create your account</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 items-center">
          <LogoLockup size={56} />
        </View>

        <StepProgress steps={STEPS} current={step} />

        {step === 0 && (
          <>
            <TextField
              label="First name"
              required
              value={form.first_name ?? ''}
              onChange={(v) => set('first_name', v)}
              autoCapitalize="words"
              autoComplete="name"
            />
            <TextField
              label="Last name"
              required
              value={form.last_name ?? ''}
              onChange={(v) => set('last_name', v)}
              autoCapitalize="words"
            />
            <SelectField
              label="Gender"
              value={form.gender ?? ''}
              options={GENDERS}
              onChange={(v) => set('gender', v)}
            />
            <DateField
              label="Date of birth"
              value={form.date_of_birth ?? ''}
              onChange={(iso) => set('date_of_birth', iso)}
              hint={ageGroup?.label}
              error={ageGroup && !ageGroup.eligible ? ageGroup.label : undefined}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Text className="mb-4 font-ui text-[13px] leading-[19px] text-ink-3">
              This helps your teen leader find you, and saves you typing it again when you
              register for events. You can fill it in later.
            </Text>
            <SelectField
              label="Province"
              value={form.province ?? ''}
              options={PROVINCES}
              onChange={(v) => set('province', v)}
            />
            <TextField
              label="Parish"
              value={form.parish ?? ''}
              onChange={(v) => set('parish', v)}
              autoCapitalize="words"
              placeholder="e.g. RCCG Victory House"
            />
            <TextField
              label="Zone"
              value={form.zone ?? ''}
              onChange={(v) => set('zone', v)}
              autoCapitalize="words"
            />
            <TextField
              label="Area"
              value={form.area ?? ''}
              onChange={(v) => set('area', v)}
              autoCapitalize="words"
            />
          </>
        )}

        {step === 2 && (
          <>
            <TextField
              label="Username"
              required
              value={form.username ?? ''}
              onChange={(v) => set('username', v)}
              autoCapitalize="none"
              autoComplete="username"
              hint="This is what you will sign in with."
            />
            <TextField
              label="Email"
              required
              value={form.email ?? ''}
              onChange={(v) => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextField
              label="Phone"
              value={form.phone ?? ''}
              onChange={(v) => set('phone', v)}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <TextField
              label="Password"
              required
              value={form.password ?? ''}
              onChange={(v) => set('password', v)}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              hint="At least 8 characters."
            />
            <TextField
              label="Confirm password"
              required
              value={form.password_confirm ?? ''}
              onChange={(v) => set('password_confirm', v)}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              error={passwordError}
            />
          </>
        )}

        {error && (
          <Text
            accessibilityLiveRegion="polite"
            className="mt-1 font-ui-md text-[13px] leading-[19px]"
            style={{ color: tokens.error }}
          >
            {error}
          </Text>
        )}

        <Pressable
          onPress={() => router.replace('/sign-in')}
          accessibilityRole="button"
          className="mt-6 items-center"
        >
          <Text className="font-ui text-[13px] text-ink-3">
            Already have an account? <Text className="font-ui-sb text-green">Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>

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
          label={step < STEPS.length - 1 ? 'Continue' : 'Create account'}
          onPress={() => (step < STEPS.length - 1 ? setStep((s) => s + 1) : submit())}
          disabled={blocked}
          loading={pending}
          height={52}
          className="flex-[2]"
          icon={
            step < STEPS.length - 1 ? <Icon name="arrowRight" size={18} color="#fff" /> : undefined
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}
