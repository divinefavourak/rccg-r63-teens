import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile, useUpdateProfile } from '../../src/api/queries';
import type { TeenProfile } from '../../src/api/types';
import { Icon } from '../../src/components/Icon';
import { GUARDIAN_RELATIONSHIPS } from '../../src/data/choices';
import { useAuth } from '../../src/state/auth';
import { useChangePhoto } from '../../src/state/photo';
import { Button } from '../../src/ui/Button';
import { Avatar } from '../../src/ui/cards';
import { ChipRow, TextField } from '../../src/ui/inputs';
import { Press } from '../../src/ui/Press';
import { BackHeader, EmptyState, SectionTitle, Skeleton } from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';
import { ELEVATION } from '../../src/theme/tokens';

/**
 * The subset of the profile the update serializer accepts.
 *
 * Listed explicitly rather than spreading the whole profile, so a field the
 * server would silently discard never enters the form in the first place.
 */
const WRITABLE = [
  'bio',
  'zone',
  'area',
  'parish',
  'department',
  'guardian_name',
  'guardian_phone',
  'guardian_email',
  'guardian_relationship',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relationship',
  'medical_conditions',
  'allergies',
  'medications',
  'dietary_restrictions',
  'blood_group',
] as const;

type Field = (typeof WRITABLE)[number];
type Form = Record<Field, string>;

/**
 * Your profile (reached from the profile row on Settings).
 *
 * The fields here are exactly the ones `TeenProfileUpdateSerializer` accepts —
 * no more. Name, date of birth, gender and province are deliberately *not*
 * writable on that serializer, and DRF drops unknown fields silently rather
 * than erroring, so offering them would have produced a Save button that
 * appeared to work while discarding half of what was typed. They are shown
 * read-only instead, with who to ask.
 *
 * Everything writable here is also what prefills an event registration, so
 * filling it in once saves a teen typing it at every camp sign-up.
 */
export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { user } = useAuth();

  const profile = useProfile();
  const update = useUpdateProfile();
  const photo = useChangePhoto();

  const [form, setForm] = useState<Form | null>(null);

  // Seed once so a slow refetch never overwrites something being typed.
  useEffect(() => {
    if (form || !profile.data) return;
    setForm(pickWritable(profile.data as unknown as Record<string, unknown>));
  }, [profile.data, form]);

  const set = useCallback((key: Field, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const save = async () => {
    if (!form) return;
    try {
      await update.mutateAsync(form as Partial<TeenProfile>);
      back();
    } catch {
      // Shown above the button; the form stays as typed.
    }
  };

  if (profile.isError && !profile.data) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Your profile" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load your profile. Check your connection, then try again."
            actionLabel="Try again"
            onAction={() => profile.refetch()}
          />
        </View>
      </View>
    );
  }

  const p = profile.data;
  if (!p || !form) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Your profile" onBack={back} />
        <View className="items-center gap-4 px-5 pt-4">
          <Skeleton width={96} height={96} radius={48} />
          <Skeleton height={196} />
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
        </View>
      </View>
    );
  }

  const name =
    p.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'You';

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Your profile" onBack={back} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        >
          {/* ── Photo ─────────────────────────────────────────────── */}
          <View className="items-center gap-2">
            <Press
              onPress={photo.change}
              disabled={photo.pending}
              accessibilityLabel="Change your photo"
              style={{ opacity: photo.pending ? 0.6 : 1 }}
            >
              <Avatar name={name} photo={p.avatar ?? user?.profile_picture} size={96} />
              <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-[3px] border-surf-base bg-ink">
                <Icon name="camera" size={16} color={tokens.onInk} />
              </View>
            </Press>
            <Text className="font-ui-md text-[14px] leading-5 text-ink-2">
              {photo.pending ? 'Uploading…' : 'Tap to change your photo'}
            </Text>
            {!!photo.error && (
              <Text
                accessibilityLiveRegion="polite"
                className="text-center font-ui-md text-[12px] leading-4 text-feedback-error"
              >
                {photo.error}
              </Text>
            )}
          </View>

          {/* What only a leader can change. Shown so the teen can check it is
              right and knows who to ask, not left invisible. */}
          <View className="w-full rounded-2xl bg-surf-raised px-4 pb-4 pt-2" style={ELEVATION.card}>
            <ReadOnly label="Name" value={p.full_name} />
            <ReadOnly label="Username" value={user?.username} />
            <ReadOnly label="Date of birth" value={formatDate(p.date_of_birth)} />
            <ReadOnly label="Age group" value={humanise(p.age_group)} />
            <ReadOnly label="Province" value={humanise(p.province)} />
            <Text className="pt-3 font-ui text-[14px] leading-5 text-ink-3">
              Your teen leader sets these. Ask them if anything is wrong.
            </Text>
          </View>

          <SectionTitle>About you</SectionTitle>
          <TextField
            label="Bio"
            value={form.bio}
            onChange={(v) => set('bio', v)}
            multiline
            hint="A line or two, if you like."
          />

          <SectionTitle>Your church</SectionTitle>
          <TextField
            label="Parish"
            value={form.parish}
            onChange={(v) => set('parish', v)}
            autoCapitalize="words"
            placeholder="RCCG Victory House"
          />
          <TextField
            label="Zone"
            value={form.zone}
            onChange={(v) => set('zone', v)}
            autoCapitalize="words"
          />
          <TextField
            label="Area"
            value={form.area}
            onChange={(v) => set('area', v)}
            autoCapitalize="words"
          />

          <SectionTitle>Parent or guardian</SectionTitle>
          <Text className="font-ui text-[14px] leading-5 text-ink-2">
            Every event asks for this. Fill it in here and you will not be asked again when you
            register.
          </Text>
          <TextField
            label="Their name"
            value={form.guardian_name}
            onChange={(v) => set('guardian_name', v)}
            autoCapitalize="words"
          />
          <TextField
            label="Their phone"
            value={form.guardian_phone}
            onChange={(v) => set('guardian_phone', v)}
            keyboardType="phone-pad"
          />
          <TextField
            label="Their email"
            value={form.guardian_email}
            onChange={(v) => set('guardian_email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View className="gap-2">
            <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">Who are they to you?</Text>
            <ChipRow
              wrap
              options={GUARDIAN_RELATIONSHIPS}
              value={form.guardian_relationship}
              onChange={(v) => set('guardian_relationship', v)}
            />
          </View>

          <SectionTitle>If something happens</SectionTitle>
          <TextField
            label="Emergency contact"
            value={form.emergency_contact_name}
            onChange={(v) => set('emergency_contact_name', v)}
            autoCapitalize="words"
          />
          <TextField
            label="Emergency phone"
            value={form.emergency_contact_phone}
            onChange={(v) => set('emergency_contact_phone', v)}
            keyboardType="phone-pad"
          />
          <TextField
            label="Allergies"
            value={form.allergies}
            onChange={(v) => set('allergies', v)}
            multiline
          />
          <TextField
            label="Anything else the team should know"
            value={form.medical_conditions}
            onChange={(v) => set('medical_conditions', v)}
            multiline
          />
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
          <Button label="Save changes" onPress={save} loading={update.isPending} className="w-full" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function pickWritable(source: Record<string, unknown>): Form {
  const out = {} as Form;
  for (const key of WRITABLE) {
    const value = source[key];
    out[key] = typeof value === 'string' ? value : '';
  }
  return out;
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value || 'not set'}`}
      className="flex-row items-center gap-3 border-b border-line py-3"
    >
      <Text className="font-ui text-[14px] leading-5 text-ink-3">{label}</Text>
      <Text numberOfLines={1} className="flex-1 text-right font-ui-sb text-[14px] leading-5 text-ink-1">
        {value || 'Not set'}
      </Text>
    </View>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function humanise(value: string | null | undefined): string {
  if (!value) return '';
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
