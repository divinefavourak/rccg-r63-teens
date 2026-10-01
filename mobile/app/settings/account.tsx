import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { Icon } from '../../src/components/Icon';
import { Button, Card } from '../../src/components/ui';
import { SelectField, TextField } from '../../src/components/form';
import { ErrorState, Skeleton } from '../../src/components/states';
import { useTokens } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/state/auth';
import { useProfile, useUpdateProfile, useUploadAvatar } from '../../src/api/queries';
import { GUARDIAN_RELATIONSHIPS } from '../../src/data/choices';
import type { TeenProfile } from '../../src/api/types';

/**
 * Account settings.
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
  const avatar = useUploadAvatar();

  const [form, setForm] = useState<Partial<TeenProfile>>({});
  const [loaded, setLoaded] = useState(false);

  // Seed once so a slow refetch never overwrites something being typed.
  useEffect(() => {
    if (loaded || !profile.data) return;
    const p = profile.data as Partial<TeenProfile> & Record<string, unknown>;
    setForm({
      bio: p.bio ?? '',
      zone: p.zone ?? '',
      area: p.area ?? '',
      parish: p.parish ?? '',
      ...(pickWritable(p) as Partial<TeenProfile>),
    });
    setLoaded(true);
  }, [profile.data, loaded]);

  const set = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Pick and upload a new profile picture.
   *
   * Cropped square at the point of choosing rather than after upload: the
   * avatar is only ever shown in a circle, and sending a 12MP original over
   * Nigerian mobile data to display it at 96px is indefensible.
   */
  const pickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access to choose a profile picture. You can change this in your phone settings.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    try {
      await avatar.mutateAsync({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName ?? undefined,
      });
    } catch {
      // Surfaced inline below.
    }
  }, [avatar]);

  const save = useCallback(async () => {
    try {
      await update.mutateAsync(form);
      router.back();
    } catch {
      // Surfaced inline below.
    }
  }, [update, form, router]);

  const header = (
    <View
      className="flex-row items-center gap-3 border-b border-line bg-surf-raised px-4 pb-3.5"
      style={{ paddingTop: insets.top + 10 }}
    >
      <Pressable
        onPress={router.back}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-md border border-line"
      >
        <Icon name="chevronLeft" size={20} color={tokens.text2} />
      </Pressable>
      <Text className="flex-1 font-ui-b text-[16px] text-ink-1">Account settings</Text>
    </View>
  );

  if (profile.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        {header}
        <View className="gap-4 p-5">
          <Skeleton width={96} height={96} radius={999} />
          <Skeleton height={48} />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </View>
      </View>
    );
  }

  if (profile.isError) {
    return (
      <View className="flex-1 bg-surf-base">
        {header}
        <ErrorState error={profile.error} onRetry={profile.refetch} />
      </View>
    );
  }

  const p = profile.data;
  const displayName = p?.full_name || user?.username || '?';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surf-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile picture */}
        <View className="mb-7 items-center">
          <Pressable
            onPress={pickAvatar}
            disabled={avatar.isPending}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            className="relative"
          >
            <View
              className="h-24 w-24 items-center justify-center overflow-hidden rounded-full"
              style={{ backgroundColor: '#2D6340', opacity: avatar.isPending ? 0.6 : 1 }}
            >
              {p?.avatar ? (
                <Image
                  source={p.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  // Keyed on the URL so a fresh upload actually redraws rather
                  // than serving the cached previous picture.
                  recyclingKey={p.avatar}
                  transition={200}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text className="font-ui-b text-[32px] text-white">{initials}</Text>
              )}
            </View>

            <View
              className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full bg-green"
              style={{ borderWidth: 3, borderColor: tokens.surfBase }}
            >
              <Icon name="settings" size={15} color="#fff" />
            </View>
          </Pressable>

          <Text className="mt-3 font-ui text-[13px] text-ink-3">
            {avatar.isPending ? 'Uploading…' : 'Tap to change your picture'}
          </Text>

          {avatar.isError && (
            <Text
              accessibilityLiveRegion="polite"
              className="mt-1.5 text-center font-ui-md text-[12px] leading-[17px]"
              style={{ color: tokens.error }}
            >
              {avatar.error instanceof Error ? avatar.error.message : 'Upload failed.'}
            </Text>
          )}
        </View>

        {/* What only a leader can change. Shown so the teen can check it is
            right and knows who to ask, not left invisible. */}
        <Card className="mb-6 p-4">
          <Text className="mb-3 font-ui-sb text-[12px] uppercase tracking-[1px] text-ink-3">
            Your details
          </Text>
          <ReadOnly label="Name" value={p?.full_name} />
          <ReadOnly label="Username" value={user?.username} />
          <ReadOnly label="Date of birth" value={formatDate(p?.date_of_birth)} />
          <ReadOnly label="Age group" value={humanise(p?.age_group)} />
          <ReadOnly label="Province" value={humanise(p?.province)} last />
          <Text className="mt-3 font-ui text-[12px] leading-[17px] text-ink-3">
            These are set by your teen leader. Ask them if anything is wrong.
          </Text>
        </Card>

        <Section label="About you" />
        <TextField
          label="Bio"
          value={(form.bio as string) ?? ''}
          onChange={(v) => set('bio', v)}
          multiline
          hint="A line or two, if you like."
        />

        <Section label="Your church" />
        <TextField
          label="Parish"
          value={(form.parish as string) ?? ''}
          onChange={(v) => set('parish', v)}
          autoCapitalize="words"
          placeholder="e.g. RCCG Victory House"
        />
        <TextField
          label="Zone"
          value={(form.zone as string) ?? ''}
          onChange={(v) => set('zone', v)}
          autoCapitalize="words"
        />
        <TextField
          label="Area"
          value={(form.area as string) ?? ''}
          onChange={(v) => set('area', v)}
          autoCapitalize="words"
        />

        <Section label="Parent or guardian" />
        <Text className="mb-4 font-ui text-[13px] leading-[19px] text-ink-3">
          Required for every teen event. Filling it in here means you will not be asked again
          when you register.
        </Text>
        <TextField
          label="Guardian name"
          value={(form as Record<string, string>).guardian_name ?? ''}
          onChange={(v) => set('guardian_name', v)}
          autoCapitalize="words"
        />
        <TextField
          label="Guardian phone"
          value={(form as Record<string, string>).guardian_phone ?? ''}
          onChange={(v) => set('guardian_phone', v)}
          keyboardType="phone-pad"
        />
        <TextField
          label="Guardian email"
          value={(form as Record<string, string>).guardian_email ?? ''}
          onChange={(v) => set('guardian_email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <SelectField
          label="Relationship"
          value={(form as Record<string, string>).guardian_relationship ?? ''}
          options={GUARDIAN_RELATIONSHIPS}
          onChange={(v) => set('guardian_relationship', v)}
        />

        <Section label="If something happens" />
        <TextField
          label="Emergency contact"
          value={(form as Record<string, string>).emergency_contact_name ?? ''}
          onChange={(v) => set('emergency_contact_name', v)}
          autoCapitalize="words"
        />
        <TextField
          label="Emergency phone"
          value={(form as Record<string, string>).emergency_contact_phone ?? ''}
          onChange={(v) => set('emergency_contact_phone', v)}
          keyboardType="phone-pad"
        />
        <TextField
          label="Allergies"
          value={(form as Record<string, string>).allergies ?? ''}
          onChange={(v) => set('allergies', v)}
          multiline
        />
        <TextField
          label="Anything else the team should know"
          value={(form as Record<string, string>).medical_conditions ?? ''}
          onChange={(v) => set('medical_conditions', v)}
          multiline
        />

        {update.isError && (
          <Text
            accessibilityLiveRegion="polite"
            className="mt-1 font-ui-md text-[13px] leading-[19px]"
            style={{ color: tokens.error }}
          >
            {update.error instanceof Error ? update.error.message : 'Could not save. Try again.'}
          </Text>
        )}
      </ScrollView>

      <View
        className="border-t border-line bg-surf-raised px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button label="Save changes" onPress={save} loading={update.isPending} height={52} />
      </View>
    </KeyboardAvoidingView>
  );
}

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

function pickWritable(source: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of WRITABLE) {
    const value = source[key];
    out[key] = typeof value === 'string' ? value : '';
  }
  return out;
}

function Section({ label }: { label: string }) {
  return (
    <Text className="mb-3 mt-3 font-ui-sb text-[12px] uppercase tracking-[1px] text-ink-3">
      {label}
    </Text>
  );
}

function ReadOnly({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between py-2 ${last ? '' : 'border-b border-line'}`}>
      <Text className="font-ui text-[13px] text-ink-3">{label}</Text>
      <Text className="font-ui-md text-[13px] text-ink-1">{value || '—'}</Text>
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
