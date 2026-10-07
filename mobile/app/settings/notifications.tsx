import { useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../src/api/queries';
import type { NotificationPreferences } from '../../src/api/types';
import { PushPrompt } from '../../src/components/PushPrompt';
import { timeLabel } from '../../src/data/events';
import { Toggle } from '../../src/ui/inputs';
import { BackHeader, EmptyState, SectionTitle, Skeleton } from '../../src/ui/screen';
import { ELEVATION } from '../../src/theme/tokens';

/** The preferences that are a plain on or off. */
type Switch = {
  [K in keyof NotificationPreferences]: NotificationPreferences[K] extends boolean ? K : never;
}[keyof NotificationPreferences];

/**
 * What you hear about (reached from Reminders on Settings).
 *
 * The habit ladder from `docs/07-feature-specifications.md` #10: up to four
 * nudges a day, which the server steps down on its own and stops entirely once
 * the day's devotional is done. That completion-awareness is why this screen
 * offers rungs rather than a frequency slider — a teen who reads every morning
 * never hears the later ones anyway.
 *
 * 12-gamification.md forbids shaming, so nothing here frames a reminder as a
 * warning or a deficit. Quiet hours live on Settings, one screen up.
 */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const toggle = useCallback(
    (key: Switch) => (value: boolean) => update.mutate({ [key]: value }),
    [update],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  const p = prefs.data;

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="What you hear about" onBack={back} />

      {prefs.isPending ? (
        <View className="gap-4 px-5 pt-2">
          <Skeleton height={296} />
          <Skeleton width="60%" height={28} radius={8} />
          <Skeleton height={296} />
        </View>
      ) : !p ? (
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load your settings. Check your connection, then try again."
            actionLabel="Try again"
            onAction={() => prefs.refetch()}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: 16,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          }}
        >
          {/* The switches below are what the account allows; this is whether
              the phone itself will let any of it through. */}
          <PushPrompt />

          <Group>
            <ToggleRow
              label="Daily reminders"
              detail="A gentle nudge to read today’s devotional"
              on={p.habit_reminders_enabled}
              onChange={toggle('habit_reminders_enabled')}
            />
            <ToggleRow
              label="Events"
              detail="New events, and news about ones you joined"
              on={p.event_notifications_enabled}
              onChange={toggle('event_notifications_enabled')}
            />
            <ToggleRow
              label="Announcements"
              detail="News from your church"
              on={p.announcements_enabled}
              onChange={toggle('announcements_enabled')}
            />
            <ToggleRow
              label="Account"
              detail="Signing in and keeping your account safe"
              on={p.system_notifications_enabled}
              onChange={toggle('system_notifications_enabled')}
              last
            />
          </Group>

          {p.habit_reminders_enabled && (
            <>
              <SectionTitle>When to remind you</SectionTitle>
              <Text className="font-ui text-[14px] leading-5 text-ink-2">
                Pick as many or as few as you like. They stop as soon as you finish the day.
              </Text>
              <Group>
                <ToggleRow
                  label="Morning"
                  detail={clockLabel(p.morning_at)}
                  on={p.morning_rung_enabled}
                  onChange={toggle('morning_rung_enabled')}
                />
                <ToggleRow
                  label="Afternoon"
                  detail={clockLabel(p.afternoon_at)}
                  on={p.afternoon_rung_enabled}
                  onChange={toggle('afternoon_rung_enabled')}
                />
                <ToggleRow
                  label="Evening"
                  detail={clockLabel(p.evening_at)}
                  on={p.evening_rung_enabled}
                  onChange={toggle('evening_rung_enabled')}
                />
                <ToggleRow
                  label="Last call"
                  detail={clockLabel(p.final_at)}
                  on={p.final_rung_enabled}
                  onChange={toggle('final_rung_enabled')}
                  last
                />
              </Group>
            </>
          )}

          {update.isError && (
            <Text
              accessibilityLiveRegion="polite"
              className="font-ui-md text-[14px] leading-5 text-feedback-error"
            >
              That did not save. Check your connection and try again.
            </Text>
          )}

          <Text className="font-ui-md text-[12px] leading-4 text-ink-3">
            Everything we send is also kept under Notifications in the app, so nothing is lost if
            your phone is quiet.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

/** One raised card holding a run of rows. */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <View className="w-full rounded-2xl bg-surf-raised px-4 py-1" style={ELEVATION.card}>
      {children}
    </View>
  );
}

/** A setting's name and what it means, with its switch (Figma "toggle row"). */
function ToggleRow({
  label,
  detail,
  on,
  onChange,
  last = false,
}: {
  label: string;
  detail?: string;
  on: boolean;
  onChange: (on: boolean) => void;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-line'}`}>
      <View className="flex-1 gap-0.5">
        <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">{label}</Text>
        {!!detail && <Text className="font-ui text-[14px] leading-5 text-ink-3">{detail}</Text>}
      </View>
      <Toggle on={on} onChange={onChange} label={label} />
    </View>
  );
}

/** "07:00:00" -> "7:00 am". */
function clockLabel(value: string | null): string {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return value;
  const date = new Date();
  date.setHours(h, m || 0, 0, 0);
  return timeLabel(date);
}
