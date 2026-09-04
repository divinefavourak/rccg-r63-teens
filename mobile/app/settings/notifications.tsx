import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { Card, Toggle } from '../../src/components/ui';
import { ErrorState, Skeleton } from '../../src/components/states';
import { useTokens } from '../../src/theme/ThemeProvider';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../src/api/queries';
import type { NotificationPreferences } from '../../src/api/types';

/**
 * Reminder settings.
 *
 * The habit ladder from `docs/07-feature-specifications.md` #10: up to four
 * nudges a day, which the server steps down on its own and stops entirely once
 * the day's devotional is done. That completion-awareness is why this screen
 * offers rungs rather than a frequency slider — a teen who reads every morning
 * never hears the later ones anyway.
 *
 * 12-gamification.md forbids shaming, so nothing here frames a reminder as a
 * warning or a deficit.
 */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();

  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const toggle = useCallback(
    (key: keyof NotificationPreferences) => (value: boolean) => {
      update.mutate({ [key]: value } as Partial<NotificationPreferences>);
    },
    [update],
  );

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
      <Text className="flex-1 font-ui-b text-[16px] text-ink-1">Notifications</Text>
    </View>
  );

  if (prefs.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        {header}
        <View className="gap-3 p-5">
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
        </View>
      </View>
    );
  }

  if (prefs.isError || !prefs.data) {
    return (
      <View className="flex-1 bg-surf-base">
        {header}
        <ErrorState error={prefs.error} onRetry={prefs.refetch} />
      </View>
    );
  }

  const p = prefs.data;

  return (
    <View className="flex-1 bg-surf-base">
      {header}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Group label="What you hear about" />
        <Row
          label="Daily reminders"
          sub="A gentle nudge to read today's devotional"
          value={p.habit_reminders_enabled}
          onChange={toggle('habit_reminders_enabled')}
        />
        <Row
          label="Events"
          sub="New events, and updates to ones you joined"
          value={p.event_notifications_enabled}
          onChange={toggle('event_notifications_enabled')}
        />
        <Row
          label="Announcements"
          sub="News from your tribe"
          value={p.announcements_enabled}
          onChange={toggle('announcements_enabled')}
        />
        <Row
          label="Account"
          sub="Sign-in and security messages"
          value={p.system_notifications_enabled}
          onChange={toggle('system_notifications_enabled')}
        />

        {p.habit_reminders_enabled && (
          <>
            <Group label="When to remind you" />

            <View className="px-5 pb-3">
              <Card className="flex-row items-start gap-3 p-4">
                <Icon name="check" size={18} color={tokens.green} />
                <Text className="flex-1 font-ui text-[13px] leading-[19px] text-ink-2">
                  Reminders stop as soon as you have read for the day. Pick as many or as few
                  as you like.
                </Text>
              </Card>
            </View>

            <Row
              label="Morning"
              sub={formatTime(p.morning_at)}
              value={p.morning_rung_enabled}
              onChange={toggle('morning_rung_enabled')}
            />
            <Row
              label="Afternoon"
              sub={formatTime(p.afternoon_at)}
              value={p.afternoon_rung_enabled}
              onChange={toggle('afternoon_rung_enabled')}
            />
            <Row
              label="Evening"
              sub={formatTime(p.evening_at)}
              value={p.evening_rung_enabled}
              onChange={toggle('evening_rung_enabled')}
            />
            <Row
              label="Last call"
              sub={formatTime(p.final_at)}
              value={p.final_rung_enabled}
              onChange={toggle('final_rung_enabled')}
            />
          </>
        )}

        {!!(p.quiet_hours_start && p.quiet_hours_end) && (
          <View className="px-5 pt-5">
            <Card className="flex-row items-center gap-3 p-4">
              <View className="h-9 w-9 items-center justify-center rounded-sm bg-surf-sunken">
                <Icon name="moon" size={18} color={tokens.text2} />
              </View>
              <View className="flex-1">
                <Text className="font-ui-sb text-[14px] text-ink-1">Quiet hours</Text>
                <Text className="mt-0.5 font-ui text-[12px] text-ink-3">
                  Nothing between {formatTime(p.quiet_hours_start)} and{' '}
                  {formatTime(p.quiet_hours_end)}
                </Text>
              </View>
            </Card>
          </View>
        )}

        {update.isError && (
          <Text
            accessibilityLiveRegion="polite"
            className="px-5 pt-4 font-ui-md text-[13px]"
            style={{ color: tokens.error }}
          >
            {update.error instanceof Error
              ? update.error.message
              : 'Could not save that. Try again.'}
          </Text>
        )}

        <Text className="px-5 pt-6 font-ui text-[12px] leading-[18px] text-ink-3">
          Push notifications also need permission from your phone. If you are not hearing
          anything, check Faith Tribe in your phone settings.
        </Text>
      </ScrollView>
    </View>
  );
}

function Group({ label }: { label: string }) {
  return (
    <Text className="px-5 pb-1.5 pt-5 font-ui-sb text-[12px] uppercase tracking-[1px] text-ink-3">
      {label}
    </Text>
  );
}

function Row({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3.5 border-b border-line px-5 py-3.5">
      <View className="min-w-0 flex-1">
        <Text className="font-ui-md text-[15px] text-ink-1">{label}</Text>
        {sub && <Text className="mt-px font-ui text-[12px] text-ink-3">{sub}</Text>}
      </View>
      <Toggle on={value} onChange={onChange} label={label} />
    </View>
  );
}

/** "07:00:00" -> "7:00 AM", in the device's own clock format. */
function formatTime(value: string | null): string {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return value;

  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
