import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useNotificationPreferences,
  useProfile,
  useUpdateNotificationPreferences,
} from '../../src/api/queries';
import { Icon, type IconName } from '../../src/components/Icon';
import { timeLabel } from '../../src/data/events';
import { useAuth } from '../../src/state/auth';
import { READER_THEMES, TEXT_SIZES, useReader } from '../../src/state/reader';
import { Button } from '../../src/ui/Button';
import { Avatar } from '../../src/ui/cards';
import { ChipRow, OptionRow, Toggle } from '../../src/ui/inputs';
import { Press } from '../../src/ui/Press';
import { BackHeader, SectionTitle, Sheet, Skeleton } from '../../src/ui/screen';
import { useTheme, useTokens, type SchemePreference } from '../../src/theme/ThemeProvider';
import { ELEVATION } from '../../src/theme/tokens';

const INTENSITIES = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'standard', label: 'Standard' },
  { value: 'committed', label: 'Committed' },
] as const;

/** What each choice means, in the teen's terms. The server owns the schedule. */
const INTENSITY_WORDS: Record<string, string> = {
  gentle: 'Gentle: one reminder in the morning. It stops as soon as you finish the day.',
  standard:
    'Standard: one reminder in the morning and one in the evening. They stop as soon as you finish the day.',
  committed:
    'Committed: up to four reminders through the day. They stop as soon as you finish the day.',
};

const APPEARANCES: readonly { value: SchemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match phone' },
];

/** The server's own defaults, restored when quiet hours are switched back on. */
const QUIET_START = '21:30:00';
const QUIET_END = '06:00:00';

/**
 * Settings (Figma "Settings").
 *
 * Reminders are saved to the account, so they follow the teen to a new phone.
 * Appearance and the reader's text are saved on this phone only: they are
 * about the screen in hand, and a guest can use them too.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isGuest, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const reader = useReader();

  const profile = useProfile(!isGuest);
  const prefs = useNotificationPreferences(!isGuest);
  const update = useUpdateNotificationPreferences();

  const [sheet, setSheet] = useState<'size' | 'theme' | null>(null);
  const [leaving, setLeaving] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/me'));

  const logOut = useCallback(async () => {
    setLeaving(true);
    await signOut();
    // Signed out, the same five tabs remain; Today is where a guest starts.
    router.replace('/');
  }, [signOut, router]);

  const name =
    profile.data?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    'Your profile';

  const p = prefs.data;
  // The server treats equal start and end as "no quiet hours".
  const quietOn = !!p && !!p.quiet_hours_start && p.quiet_hours_start !== p.quiet_hours_end;
  const sizeLabel = TEXT_SIZES.find((s) => s.value === reader.fontSize)?.label ?? 'Medium';
  const themeLabel = READER_THEMES.find((t) => t.value === reader.theme)?.short ?? 'Auto';

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Settings" onBack={back} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
      >
        {!isGuest && (
          <>
            {/* ── Profile ───────────────────────────────────────────── */}
            <Press
              onPress={() => router.push('/settings/account')}
              scaleTo={0.985}
              accessibilityLabel={`${name}. Edit profile and photo`}
              className="w-full flex-row items-center gap-3 rounded-2xl bg-pop-violet p-3"
            >
              <Avatar
                name={name}
                photo={profile.data?.avatar ?? user?.profile_picture}
                size={56}
                ring={3}
              />
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-pop-on">
                  {name}
                </Text>
                <Text className="font-ui text-[14px] leading-5 text-pop-on">
                  Edit profile and photo
                </Text>
              </View>
              {/* Always dark with a light arrow: it sits on violet in both themes. */}
              <View className="h-11 w-11 items-center justify-center rounded-full bg-pop-on">
                <Icon name="chevronRight" size={20} color="#FDFAF5" />
              </View>
            </Press>

            {/* ── Reminders ─────────────────────────────────────────── */}
            <SectionTitle>Reminders</SectionTitle>
            {prefs.isPending ? (
              <Skeleton height={220} />
            ) : !p ? (
              <View className="w-full gap-3 rounded-2xl bg-surf-raised p-4" style={ELEVATION.card}>
                <Text className="font-ui text-[14px] leading-5 text-ink-2">
                  We couldn’t load your reminder settings. Check your connection, then try again.
                </Text>
                <Button
                  label="Try again"
                  variant="secondary"
                  onPress={() => prefs.refetch()}
                  className="h-12 self-start"
                />
              </View>
            ) : (
              <View
                className="w-full gap-3 rounded-2xl bg-surf-raised px-4 pb-2 pt-4"
                style={ELEVATION.card}
              >
                <ChipRow
                  wrap
                  options={INTENSITIES}
                  value={p.intensity as (typeof INTENSITIES)[number]['value']}
                  onChange={(intensity) => update.mutate({ intensity })}
                />
                <Text className="font-ui text-[14px] leading-5 text-ink-2">
                  {INTENSITY_WORDS[p.intensity] ?? INTENSITY_WORDS.standard}
                </Text>
                <View className="flex-row items-center gap-3 py-3">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">Quiet hours</Text>
                    <Text className="font-ui text-[14px] leading-5 text-ink-3">
                      {quietOn
                        ? `${clockLabel(p.quiet_hours_start)} to ${clockLabel(p.quiet_hours_end)}`
                        : 'Off. Reminders can arrive at any time.'}
                    </Text>
                  </View>
                  <Toggle
                    on={quietOn}
                    label="Quiet hours"
                    onChange={(on) =>
                      update.mutate(
                        on
                          ? { quiet_hours_start: QUIET_START, quiet_hours_end: QUIET_END }
                          : { quiet_hours_start: '00:00:00', quiet_hours_end: '00:00:00' },
                      )
                    }
                  />
                </View>
                {update.isError && (
                  <Text
                    accessibilityLiveRegion="polite"
                    className="pb-2 font-ui-md text-[14px] leading-5 text-feedback-error"
                  >
                    That did not save. Check your connection and try again.
                  </Text>
                )}
                <ListRow
                  icon="bell"
                  label="What you hear about"
                  onPress={() => router.push('/settings/notifications')}
                />
              </View>
            )}
          </>
        )}

        {/* ── Appearance ────────────────────────────────────────────── */}
        <SectionTitle>Appearance</SectionTitle>
        <View className="w-full gap-1 rounded-2xl bg-surf-raised px-4 pb-1 pt-4" style={ELEVATION.card}>
          <ChipRow wrap options={APPEARANCES} value={preference} onChange={setPreference} />
          <ListRow
            icon="text"
            label="Reading text size"
            meta={sizeLabel}
            onPress={() => setSheet('size')}
          />
          <ListRow
            icon="book"
            label="Bible reader theme"
            meta={themeLabel}
            onPress={() => setSheet('theme')}
          />
        </View>

        {!isGuest && (
          <>
            <SectionTitle>Help</SectionTitle>
            <View className="w-full rounded-2xl bg-surf-raised px-4 py-1" style={ELEVATION.card}>
              <ListRow
                icon="chat"
                label="Give feedback"
                onPress={() => router.push('/settings/feedback')}
              />
            </View>

            <Button
              label="Log out"
              variant="secondary"
              onPress={logOut}
              loading={leaving}
              className="w-full"
            />
          </>
        )}

        <Text className="text-center font-ui-md text-[12px] leading-4 text-ink-3">
          Faith Tribe · RCCG Region 63 · v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>

      <Sheet visible={sheet === 'size'} onClose={() => setSheet(null)}>
        <View className="w-full gap-3 pt-2">
          <Text
            accessibilityRole="header"
            className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
          >
            Reading text size
          </Text>
          {TEXT_SIZES.map((size) => (
            <OptionRow
              key={size.value}
              title={size.label}
              selected={reader.fontSize === size.value}
              onPress={() => {
                reader.setFontSize(size.value);
                setSheet(null);
              }}
            />
          ))}
        </View>
      </Sheet>

      <Sheet visible={sheet === 'theme'} onClose={() => setSheet(null)}>
        <View className="w-full gap-3 pt-2">
          <Text
            accessibilityRole="header"
            className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
          >
            Bible reader theme
          </Text>
          {READER_THEMES.map((theme) => (
            <OptionRow
              key={theme.value}
              title={theme.label}
              selected={reader.theme === theme.value}
              onPress={() => {
                reader.setTheme(theme.value);
                setSheet(null);
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

/** Icon, title, an optional current value, and a chevron (Figma "List Row"). */
function ListRow({
  icon,
  label,
  meta,
  onPress,
}: {
  icon: IconName;
  label: string;
  meta?: string;
  onPress: () => void;
}) {
  const tokens = useTokens();
  return (
    <Press
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={meta ? `${label}: ${meta}` : label}
      className="h-14 w-full flex-row items-center gap-3"
    >
      <Icon name={icon} size={24} color={tokens.text1} />
      <Text numberOfLines={1} className="flex-1 font-ui text-[16px] leading-6 text-ink-1">
        {label}
      </Text>
      {meta && <Text className="font-ui text-[14px] leading-5 text-ink-3">{meta}</Text>}
      <Icon name="chevronRight" size={20} color={tokens.text1} />
    </Press>
  );
}

/** "21:30:00" -> "9:30 pm". */
function clockLabel(value: string | null): string {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return value;
  const date = new Date();
  date.setHours(h, m || 0, 0, 0);
  return timeLabel(date);
}
