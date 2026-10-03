import { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProgress, useProgressCalendar } from '../src/api/queries';
import { useAuth } from '../src/state/auth';
import { Drawing, Object3D } from '../src/ui/art';
import { StatTile } from '../src/ui/cards';
import { BackHeader, EmptyState, Skeleton } from '../src/ui/screen';
import { ELEVATION } from '../src/theme/tokens';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Progress (Figma "Progress"): the streak, this month, and the totals.
 *
 * Private to the teen — there are no leaderboards and nobody else sees this
 * (07-feature-specifications.md §8). Nothing counts down, and no day is ever
 * marked as missed (12-gamification.md).
 */
export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();

  const today = useMemo(() => new Date(), []);
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const progress = useProgress(!isGuest);
  const calendar = useProgressCalendar(month, !isGuest);

  const weeks = useMemo(() => monthGrid(today), [today]);
  const active = useMemo(
    () => new Set((calendar.data?.active_days ?? []).map((iso) => Number(iso.slice(8, 10)))),
    [calendar.data],
  );

  if (isGuest) return <Redirect href="/me" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/me'));
  const data = progress.data;

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Progress" onBack={back} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 16,
          paddingHorizontal: 20,
          // Room for the trophy that breaks out of the streak card.
          paddingTop: 28,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={progress.isRefetching}
            onRefresh={() => {
              progress.refetch();
              calendar.refetch();
            }}
          />
        }
      >
        {progress.isPending ? (
          <>
            <Skeleton height={194} radius={28} />
            <Skeleton height={320} />
            <Skeleton height={84} />
          </>
        ) : !data ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="sitting"
              message="We couldn’t load your progress. Check your connection, then try again."
              actionLabel="Try again"
              onAction={() => progress.refetch()}
            />
          </View>
        ) : (
          <>
            {/* ── Streak ────────────────────────────────────────────── */}
            <View
              accessible
              accessibilityLabel={`Current streak: ${data.current_streak} ${
                data.current_streak === 1 ? 'day' : 'days'
              } in a row. ${encouragement(data.current_streak, data.longest_streak)}`}
              className="w-full gap-0.5 rounded-3xl bg-pop-amber p-5"
            >
              <View pointerEvents="none" style={{ position: 'absolute', right: -6, bottom: 12 }}>
                <Drawing name="jumping" width={160} />
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', right: -6, top: -24 }}>
                <Object3D name="trophy" size={76} />
              </View>
              <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-pop-on">
                Current streak
              </Text>
              <Text className="font-ui-xb text-[56px] leading-[64px] tracking-[-1.68px] text-pop-on">
                {data.current_streak}
              </Text>
              <Text className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-pop-on">
                {data.current_streak === 1 ? 'day in a row' : 'days in a row'}
              </Text>
              <Text className="w-[55%] font-ui text-[14px] leading-5 text-pop-on">
                {encouragement(data.current_streak, data.longest_streak)}
              </Text>
            </View>

            {/* ── This month ────────────────────────────────────────── */}
            <View className="w-full gap-2 rounded-2xl bg-surf-raised p-4" style={ELEVATION.card}>
              <Text accessibilityRole="header" className="font-ui-b text-[17px] leading-6 text-ink-1">
                {today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
              <View className="flex-row justify-between" accessible={false}>
                {WEEKDAYS.map((letter, i) => (
                  <View key={i} className="h-5 w-9 items-center justify-center">
                    <Text className="font-ui-md text-[12px] leading-4 text-ink-3">{letter}</Text>
                  </View>
                ))}
              </View>
              {weeks.map((week, w) => (
                <View key={w} className="flex-row justify-between">
                  {week.map((day, d) => (
                    <DayCell
                      key={d}
                      day={day}
                      done={day !== null && active.has(day)}
                      today={day === today.getDate()}
                    />
                  ))}
                </View>
              ))}
              <Text className="pt-1 font-ui-md text-[12px] leading-4 text-ink-3">
                {calendar.isError
                  ? 'We couldn’t load this month’s days. Pull down to try again.'
                  : 'A filled day is a day you showed up. Only you can see this.'}
              </Text>
            </View>

            {/* ── Totals ────────────────────────────────────────────── */}
            {/* Extra room above for the objects that break out of each tile. */}
            <View className="mt-2 flex-row" style={{ gap: 10 }}>
              <StatTile
                value={String(data.longest_streak)}
                label="Longest"
                colour="lime"
                object="rocket"
              />
              <StatTile
                value={String(data.grace_balance)}
                label="Grace days"
                colour="sky"
                object="gift"
              />
              <StatTile
                value={String(data.chapters_read)}
                label="Chapters"
                colour="pink"
                object="notebook"
              />
            </View>

            <View className="mt-1 w-full gap-1 rounded-2xl bg-surf-sunken p-4">
              <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-ink-3">
                Coming soon
              </Text>
              <Text className="font-ui-b text-[17px] leading-6 text-ink-1">
                Badges and certificates
              </Text>
              <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: -12 }}>
                <Object3D name="crown" size={60} />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** One day of the month. Done days are filled; today is ink; the rest are quiet. */
function DayCell({ day, done, today }: { day: number | null; done: boolean; today: boolean }) {
  if (day === null) return <View className="h-9 w-9" />;
  return (
    <View
      accessible
      accessibilityLabel={`${day}${today ? ', today' : ''}${done ? ', done' : ''}`}
      className={`h-9 w-9 items-center justify-center rounded-full ${
        today ? 'bg-ink' : done ? 'bg-pop-amber' : ''
      }`}
    >
      <Text
        className={`font-ui-sb text-[14px] leading-5 ${
          today ? 'text-on-ink' : done ? 'text-pop-on' : 'text-ink-3'
        }`}
      >
        {day}
      </Text>
      {/* Today can also be done; the ink fill wins, so a dot says so. */}
      {today && done && <View className="absolute bottom-1 h-1 w-1 rounded-full bg-pop-amber" />}
    </View>
  );
}

/** The month as weeks of seven, Monday first, with nulls outside the month. */
function monthGrid(today: Date): (number | null)[][] {
  const year = today.getFullYear();
  const month = today.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  // JS weeks start on Sunday; this grid starts on Monday.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The line under the streak. Looks forward, never back at what was lost. */
function encouragement(current: number, longest: number): string {
  if (current === 0) return 'Read today and this becomes day one.';
  if (current >= longest) return 'This is your longest run yet.';
  const gap = longest - current;
  return `${gap} more ${gap === 1 ? 'day' : 'days'} and you match your best.`;
}
