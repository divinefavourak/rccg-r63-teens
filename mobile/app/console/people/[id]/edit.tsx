import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  personName,
  usePersonAccount,
  usePersonMembership,
  useUpdateAccount,
  type AccountPatch,
} from '../../../../src/api/people';
import type { PersonAccount } from '../../../../src/api/types';
import { useTeacherTools } from '../../../../src/state/teacher';
import { Button } from '../../../../src/ui/Button';
import { ChipRow, TextField, Toggle } from '../../../../src/ui/inputs';
import { BackHeader, EmptyState, KeyboardView, SectionTitle, Skeleton } from '../../../../src/ui/screen';
import { ELEVATION } from '../../../../src/theme/tokens';

/** The server's rule (users.User.username): 3+ of letters, digits and @ . + - _. */
const USERNAME = /^[\w.@+-]{3,150}$/;

const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'not_specified', label: 'Prefer not to say' },
] as const;

type Form = {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  is_active: boolean;
};

/**
 * Correct someone's details (users.manage). The same fields as the web
 * Console's Edit details, and like it, only what changed is sent, so a field
 * nobody touched is never written back over a newer value.
 *
 * Roles are not here: they are given and taken away on the person's page, with
 * the rules that go with them. Switching an account off keeps everything they
 * did; they simply cannot sign in until it is switched on again.
 */
export default function EditPersonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tools = useTeacherTools();

  const membership = usePersonMembership(id);
  const userId = membership.data?.user;
  const account = usePersonAccount(userId, tools.editPeople);
  const update = useUpdateAccount(userId ?? '');

  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    if (form || !account.data) return;
    setForm(toForm(account.data));
  }, [account.data, form]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/console/people'));
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  if (!tools.editPeople || (account.isError && !account.data)) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Edit details" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message={
              tools.editPeople
                ? 'We couldn’t load their details. Check your connection, then try again.'
                : 'Changing someone’s details needs a coordinator.'
            }
            actionLabel={tools.editPeople ? 'Try again' : undefined}
            onAction={tools.editPeople ? () => account.refetch() : undefined}
          />
        </View>
      </View>
    );
  }

  const a = account.data;
  if (!a || !form) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Edit details" onBack={back} />
        <View className="gap-4 px-5 pt-4">
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
        </View>
      </View>
    );
  }

  const original = toForm(a);
  const patch: AccountPatch = {};
  (Object.keys(form) as (keyof Form)[]).forEach((key) => {
    if (form[key] !== original[key]) (patch as Record<string, unknown>)[key] = form[key];
  });
  const changed = Object.keys(patch).length > 0;
  const usernameOk = USERNAME.test(form.username.trim());
  const ready = form.first_name.trim() !== '' && form.email.trim() !== '' && usernameOk;

  const save = async () => {
    try {
      await update.mutateAsync(patch);
      back();
    } catch {
      // Shown above the button; the form stays as typed.
    }
  };

  const name = personName(membership.data);

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Edit details" onBack={back} />

      <KeyboardView>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        >
          <Text className="font-ui text-[16px] leading-6 text-ink-2">
            {name}’s name and how to reach them. Their roles are changed on their page.
          </Text>

          <TextField
            label="First name"
            value={form.first_name}
            onChange={(v) => set('first_name', v)}
            autoCapitalize="words"
          />
          <TextField
            label="Last name"
            value={form.last_name}
            onChange={(v) => set('last_name', v)}
            autoCapitalize="words"
          />
          <TextField
            label="Email"
            value={form.email}
            onChange={(v) => set('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="Phone"
            value={form.phone}
            onChange={(v) => set('phone', v)}
            keyboardType="phone-pad"
            placeholder="+234 800 000 0000"
          />
          <View className="gap-1">
            <TextField
              label="Username"
              value={form.username}
              onChange={(v) => set('username', v.replace(/\s/g, ''))}
              autoCapitalize="none"
            />
            <Text
              className={`font-ui text-[12px] leading-4 ${
                usernameOk ? 'text-ink-3' : 'text-feedback-error'
              }`}
            >
              {usernameOk
                ? 'They can sign in with it. Letters, numbers and . _ - @ + only.'
                : 'At least 3 characters: letters, numbers and . _ - @ + only.'}
            </Text>
          </View>
          <View className="gap-2">
            <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">Gender</Text>
            <ChipRow wrap options={GENDERS} value={form.gender as (typeof GENDERS)[number]['value']} onChange={(v) => set('gender', v)} />
          </View>

          <SectionTitle>Account</SectionTitle>
          <View
            className="w-full flex-row items-center gap-3 rounded-2xl bg-surf-raised px-4 py-3"
            style={ELEVATION.card}
          >
            <View className="min-w-0 flex-1">
              <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">
                {form.is_active ? 'Switched on' : 'Switched off'}
              </Text>
              <Text className="font-ui text-[14px] leading-5 text-ink-2">
                {form.is_active
                  ? 'They can sign in.'
                  : 'They cannot sign in. Everything they did is kept.'}
              </Text>
            </View>
            <Toggle on={form.is_active} onChange={(on) => set('is_active', on)} label="Account switched on" />
          </View>
        </ScrollView>

        <View className="gap-2 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {update.isError && (
            <Text
              accessibilityLiveRegion="polite"
              className="text-center font-ui-md text-[14px] leading-5 text-feedback-error"
            >
              {update.error instanceof Error
                ? update.error.message
                : 'That did not save. Check your connection and try again.'}
            </Text>
          )}
          <Button
            label={changed ? 'Save changes' : 'Nothing changed'}
            onPress={save}
            loading={update.isPending}
            disabled={!changed || !ready}
            className="w-full"
          />
        </View>
      </KeyboardView>
    </View>
  );
}

function toForm(a: PersonAccount): Form {
  return {
    username: a.username ?? '',
    first_name: a.first_name ?? '',
    last_name: a.last_name ?? '',
    email: a.email ?? '',
    phone: a.phone ?? '',
    gender: a.gender ?? '',
    is_active: a.is_active,
  };
}
