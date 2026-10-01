import { memo, useCallback } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { Icon } from '../../src/components/Icon';
import { AvatarMark, LeafGlyph, LeafMark, LeafTick } from '../../src/components/BrandMarks';
import { FaithTribeLogo } from '../../src/components/Logo';
import { Flame } from '../../src/components/Flame';
import { Button, Card, CheckBox, Eyebrow, IconButton, Press, SectionHeader } from '../../src/components/ui';
import { DevotionalCardSkeleton, ErrorState, Skeleton } from '../../src/components/states';
import { useTokens } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/state/auth';
import { useNavClearance } from '../../src/components/useNavClearance';
import { useCompleteChallenge, useToday, useUnreadCount } from '../../src/api/queries';
import type { TodayResponse } from '../../src/api/types';

/**
 * Today.
 *
 * "One Day. One Verse. One Message" is a visual principle, not just copy
 * (09-design-principles.md): the devotional card is the single hero and every
 * other block on this screen visibly supports it.
 *
 * One request drives the whole screen. `GET /today/` is public and returns the
 * shared half (devotional, verse, challenge) with the personal half null for a
 * guest — exactly the split this screen renders.
 */
export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const navClearance = useNavClearance(32);

  const today = useToday();
  const unread = useUnreadCount(!isGuest);

  const openDevotional = useCallback(() => {
    const id = today.data?.devotional?.id;
    if (id) router.push({ pathname: '/devotional', params: { id } });
  }, [router, today.data]);

  const openNotifications = useCallback(() => router.push('/notifications'), [router]);
  const goSignIn = useCallback(() => router.push('/sign-in'), [router]);
  const goRegister = useCallback(() => router.push('/register'), [router]);

  const data = today.data;

  return (
    <ScrollView
      className="flex-1 bg-surf-base"
      contentContainerStyle={{ paddingBottom: navClearance }}
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={today.isRefetching}
          onRefresh={today.refetch}
          // A teen who completed a devotional on another device expects a pull
          // to reconcile it.
          progressViewOffset={insets.top + 56}
        />
      }
    >
      <AppBar
        isGuest={isGuest}
        topInset={insets.top}
        hasUnread={(unread.data?.unread_count ?? 0) > 0}
        onBellPress={openNotifications}
      />

      <Greeting
        greeting={data?.greeting}
        name={isGuest ? 'Friend' : undefined}
        streak={data?.streak?.current_length ?? null}
        loading={today.isPending}
      />

      <View className="px-5 pt-5">
        {today.isPending ? (
          <DevotionalCardSkeleton />
        ) : today.isError ? (
          <ErrorState error={today.error} onRetry={today.refetch} compact />
        ) : data?.has_devotional && data.devotional ? (
          <DevotionalCard data={data} onRead={openDevotional} />
        ) : (
          // A pipeline gap is a 200 with has_devotional false, not a 404 — the
          // streak and challenge below are still true, so the screen keeps
          // working (06-user-flows.md flow 5).
          <NoDevotionalCard />
        )}
      </View>

      {data?.memory_verse && (
        <View className="px-5 pt-3.5">
          <VerseOfTheDay verse={data.memory_verse} />
        </View>
      )}

      <View className="flex-row gap-3 px-5 pt-3.5">
        {isGuest ? (
          <>
            <LockedCard
              emoji="🔒"
              title="Start your streak"
              body="Sign in to track your journey"
              cta="Sign in"
              onPress={goSignIn}
            />
            <LockedCard
              emoji="✦"
              title="Daily challenge"
              body="Join to unlock today's challenge"
              cta="Join free"
              onPress={goSignIn}
            />
          </>
        ) : (
          <>
            <StreakCard streak={data?.streak ?? null} loading={today.isPending} />
            <ChallengeCard data={data} loading={today.isPending} />
          </>
        )}
      </View>

      {!isGuest && data?.streak && <WeekTracker streak={data.streak} />}
      {isGuest && <GuestSignUpCard onPress={goRegister} />}
    </ScrollView>
  );
}

// ─── App bar ───────────────────────────────────────────────────────────────

const AppBar = memo(function AppBar({
  isGuest,
  topInset,
  hasUnread,
  onBellPress,
}: {
  isGuest: boolean;
  topInset: number;
  hasUnread: boolean;
  onBellPress: () => void;
}) {
  const tokens = useTokens();

  return (
    <View
      className="flex-row items-center gap-3 border-b border-line bg-surf-base px-5 pb-4"
      style={{ paddingTop: topInset + 12 }}
    >
      <FaithTribeLogo size={36} />

      <View className="flex-1">
        <Text className="font-ui-b text-[14px] tracking-tight text-ink-1">Faith Tribe</Text>
        <Text className="font-ui text-[11px] text-ink-3">RCCG Region 63 Teens</Text>
      </View>

      <View>
        <IconButton name="bell" label="Notifications" onPress={onBellPress} />
        {hasUnread && (
          // A single calm dot, not a count. 05-navigation.md permits a badge on
          // the bell alone, and 09-design-principles.md forbids pulsing it.
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full bg-green"
            style={{ borderWidth: 1.5, borderColor: tokens.surfBase }}
          />
        )}
      </View>

      {!isGuest ? (
        <View
          className="h-10 w-10 overflow-hidden rounded-full border-2 border-green"
          accessibilityLabel="Your profile"
        >
          <AvatarMark size={36} />
        </View>
      ) : (
        <View className="h-10 w-10 items-center justify-center rounded-full border border-line bg-surf-sunken">
          <Icon name="person" size={20} color={tokens.text3} />
        </View>
      )}
    </View>
  );
});

// ─── Greeting ──────────────────────────────────────────────────────────────

function Greeting({
  greeting,
  name,
  streak,
  loading,
}: {
  greeting?: string;
  name?: string;
  streak: number | null;
  loading: boolean;
}) {
  const { user } = useAuth();
  // The server derives the greeting from the hour in the app's timezone, so a
  // teen in Lagos is not wished good morning at 9pm by a UTC clock.
  const salutation = greeting ?? 'Hello,';
  const display = name ?? user?.first_name ?? user?.username ?? 'Friend';

  return (
    <View className="flex-row items-end justify-between gap-3 px-5 pt-6">
      <View>
        <Text className="mb-0.5 font-ui text-[15px] text-ink-3">{salutation}</Text>
        <Text className="font-ui-xb text-[38px] leading-[40px] tracking-tight text-ink-1">
          {display}
        </Text>
      </View>

      {loading ? (
        <Skeleton width={72} height={38} radius={999} />
      ) : streak !== null && streak > 0 ? (
        <View
          className="flex-row items-center gap-1.5 rounded-full bg-amber-tonal px-3.5 py-2"
          style={{ borderWidth: 1.5, borderColor: 'rgba(232,149,26,0.25)' }}
          accessibilityLabel={`${streak} day streak`}
        >
          <Flame size={20} />
          <Text className="font-ui-xb text-[18px] leading-[18px] text-amber-bright">{streak}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── The hero card ─────────────────────────────────────────────────────────

function DevotionalCard({ data, onRead }: { data: TodayResponse; onRead: () => void }) {
  const devotional = data.devotional!;
  const verse = data.memory_verse;

  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <Card className="overflow-hidden rounded-xl">
        <View className="px-5 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Eyebrow tone="green">Daily Devotional</Eyebrow>
            <Text className="font-ui-md text-[12px] text-ink-3">{formatDate(devotional.date)}</Text>
          </View>

          <Text className="mb-2.5 font-ui-b text-[24px] leading-[30px] tracking-tight text-ink-1">
            {devotional.title}
          </Text>

          <Text numberOfLines={2} className="mb-1.5 font-ui text-[14px] leading-[22px] text-ink-3">
            {devotional.excerpt}
          </Text>

          {/* A promise about effort — the whole argument for the daily habit is
              that it is small (01-vision.md). */}
          <Text className="mb-[18px] font-ui-md text-[12px] text-ink-3">
            {devotional.reading_time_minutes} min read
            {devotional.author ? ` · ${devotional.author}` : ''}
          </Text>

          {verse && (
            <View className="mb-[18px] rounded-md p-[18px]" style={{ backgroundColor: '#2D6340' }}>
              <Text
                className="mb-2.5 font-ui-b text-[10px] uppercase tracking-[1px]"
                style={{ color: 'rgba(144,210,162,0.9)' }}
              >
                Memory Verse
              </Text>
              <Text className="mb-2.5 font-read-i text-[15px] leading-[25px] text-white">
                {verse.text}
              </Text>
              <Text
                className="font-ui-b text-[11px] tracking-wide"
                style={{ color: 'rgba(144,210,162,0.85)' }}
              >
                — {verse.reference_display}
                {verse.translation_code ? ` ${verse.translation_code}` : ''}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-2.5 px-5 pb-5">
          <Button
            label={data.devotional_completed ? 'Read again' : 'Read Full Devotional'}
            onPress={onRead}
            className="flex-1"
            height={50}
            icon={<Icon name="arrowRight" size={16} color="#fff" />}
          />
          {data.devotional_completed && (
            <View className="h-[50px] w-[50px] items-center justify-center rounded-md bg-green/10">
              <Icon name="check" size={22} color="#3A7D52" />
            </View>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

/** No devotional published for today — the rest of the screen still works. */
function NoDevotionalCard() {
  const tokens = useTokens();
  return (
    <Card className="items-center gap-2.5 rounded-xl p-6">
      <LeafMark size={34} color={tokens.green} />
      <Text className="text-center font-ui-b text-[17px] text-ink-1">
        Today's devotional is on its way
      </Text>
      <Text className="text-center font-ui text-[13px] leading-5 text-ink-3">
        Nothing has been published yet. Your streak is safe — check back a little later.
      </Text>
    </Card>
  );
}

// ─── Verse of the day ──────────────────────────────────────────────────────

function VerseOfTheDay({ verse }: { verse: NonNullable<TodayResponse['memory_verse']> }) {
  const tokens = useTokens();
  return (
    <Card className="flex-row items-center gap-3 px-4 py-3.5">
      <View className="h-[38px] w-[38px] items-center justify-center rounded bg-amber-tonal">
        <Text className="text-[18px] text-amber">✦</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Eyebrow tone="amber">Verse of the day</Eyebrow>
        <Text numberOfLines={1} className="mt-0.5 font-read-i text-[13px] leading-[20px] text-ink-2">
          {verse.text}
        </Text>
        <Text className="mt-0.5 font-ui-sb text-[11px] text-ink-3">{verse.reference_display}</Text>
      </View>
      <Press
        accessibilityLabel="Share verse"
        className="p-1"
        // Sharing is the growth channel: WhatsApp forwarding is the region's
        // real social network (03-user-personas.md).
      >
        <Icon name="share" size={17} color={tokens.text3} />
      </Press>
    </Card>
  );
}

// ─── Streak & challenge ────────────────────────────────────────────────────

function StreakCard({ streak, loading }: { streak: TodayResponse['streak']; loading: boolean }) {
  if (loading) {
    return (
      <Card className="flex-1 gap-2 p-4">
        <Skeleton width={30} height={30} radius={8} />
        <Skeleton width={50} height={34} />
        <Skeleton width="70%" height={12} />
      </Card>
    );
  }

  const current = streak?.current_length ?? 0;

  return (
    <Card className="flex-1 overflow-hidden p-4" style={{ backgroundColor: '#FDF5E4' }}>
      <Flame size={32} />
      <Text className="mb-0.5 mt-1.5 font-ui-xb text-[36px] leading-[36px] text-amber-bright">
        {current}
      </Text>
      <Text className="font-ui-b text-[12px] text-ink-2">Day streak</Text>
      {/* No deficit, no "days missed", no red — 12-gamification.md requires
          warm, non-shaming streak copy. */}
      <Text className="mt-0.5 font-ui text-[11px] text-ink-3">
        {current === 0 ? 'Start today 🌱' : 'Keep it going 🌱'}
      </Text>
    </Card>
  );
}

function ChallengeCard({ data, loading }: { data?: TodayResponse; loading: boolean }) {
  const complete = useCompleteChallenge();

  if (loading) {
    return (
      <Card className="flex-1 gap-3 p-4">
        <Skeleton width="70%" height={10} />
        <Skeleton height={20} />
        <Skeleton height={20} />
      </Card>
    );
  }

  if (!data?.challenge) {
    return (
      <Card className="flex-1 justify-center gap-1.5 p-4">
        <Text className="text-[20px]">✦</Text>
        <Text className="font-ui-b text-[13px] text-ink-1">No challenge today</Text>
        <Text className="font-ui text-[11px] leading-4 text-ink-3">Enjoy the quiet.</Text>
      </Card>
    );
  }

  const done = data.challenge_completed;

  return (
    <Card className="flex-1 p-4">
      <Eyebrow>Today's challenge</Eyebrow>
      <View className="mt-3.5 gap-3">
        <ChallengeRow
          label={data.challenge.title}
          done={done}
          // There is no "uncomplete" server-side and no penalty for skipping,
          // so the control is one-way by design.
          onToggle={done ? undefined : () => complete.mutate()}
          pending={complete.isPending}
        />
      </View>
      {done && (
        // Celebration is "a smile rather than a slot machine"
        // (09-design-principles.md) — one gentle fade, no confetti.
        <Animated.View
          entering={FadeIn.duration(240)}
          className="mt-3 flex-row items-center gap-1.5 rounded-sm bg-green/10 px-2.5 py-2"
        >
          <Text className="text-[14px]">🎉</Text>
          <Text className="font-ui-b text-[11px] text-green">All done!</Text>
        </Animated.View>
      )}
    </Card>
  );
}

const ChallengeRow = memo(function ChallengeRow({
  label,
  done,
  onToggle,
  pending,
}: {
  label: string;
  done: boolean;
  onToggle?: () => void;
  pending: boolean;
}) {
  const tokens = useTokens();
  const noop = useCallback(() => {}, []);

  return (
    <View className="flex-row items-center gap-2.5" style={{ opacity: pending ? 0.6 : 1 }}>
      <CheckBox done={done} onToggle={onToggle ?? noop} label={label} />
      <Text
        numberOfLines={2}
        className={`flex-1 font-ui-md text-[14px] ${done ? 'text-ink-3' : 'text-ink-2'}`}
        style={done ? { textDecorationLine: 'line-through' } : undefined}
      >
        {label}
      </Text>
      {done && <LeafGlyph size={14} color={tokens.green} />}
    </View>
  );
});

// ─── This week ─────────────────────────────────────────────────────────────

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The current week, derived from the streak.
 *
 * `last_active_on` plus `current_length` is enough to colour the week without a
 * second request: any day within `current_length` days back from the last
 * active day is part of the run.
 */
function WeekTracker({ streak }: { streak: NonNullable<TodayResponse['streak']> }) {
  const tokens = useTokens();

  const now = new Date();
  // JS weeks start Sunday; the design's tracker starts Monday.
  const todayIndex = (now.getDay() + 6) % 7;
  const lastActive = streak.last_active_on ? new Date(streak.last_active_on) : null;

  const daysAgoActive = lastActive
    ? Math.round((startOfDay(now).getTime() - startOfDay(lastActive).getTime()) / 86_400_000)
    : null;

  return (
    <View className="px-5 pt-6">
      <SectionHeader title="This week" actionLabel="View journey" className="mb-3.5" />
      <View className="flex-row gap-1.5">
        {WEEK_LABELS.map((day, i) => {
          const daysAgo = todayIndex - i;
          const withinRun =
            daysAgoActive !== null &&
            daysAgo >= daysAgoActive &&
            daysAgo < daysAgoActive + streak.current_length;
          const isToday = i === todayIndex;
          const done = withinRun && daysAgo >= 0;

          return (
            <View key={i} className="flex-1 items-center gap-1.5">
              <Text className={`font-ui-sb text-[11px] ${isToday ? 'text-green' : 'text-ink-3'}`}>
                {day}
              </Text>
              <View
                accessibilityLabel={
                  done ? `${day}, completed` : isToday ? `${day}, today` : `${day}, not yet`
                }
                className="h-[34px] w-[34px] items-center justify-center rounded-sm"
                style={{
                  backgroundColor: done
                    ? tokens.green
                    : isToday
                      ? tokens.greenSoft
                      : tokens.surfSunken,
                  borderWidth: 2,
                  borderColor: isToday ? tokens.green : 'transparent',
                }}
              >
                {done ? (
                  <LeafTick />
                ) : isToday ? (
                  <View className="h-2 w-2 rounded-full bg-green" />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "Tuesday, 2 Sep" from an ISO date, in the device locale. */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

// ─── Guest states ──────────────────────────────────────────────────────────

function LockedCard({
  emoji,
  title,
  body,
  cta,
  onPress,
}: {
  emoji: string;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <Card className="flex-1 gap-2 p-4">
      <Text className="text-[22px]">{emoji}</Text>
      <Text className="font-ui-b text-[13px] text-ink-1">{title}</Text>
      <Text className="font-ui text-[11px] leading-4 text-ink-3">{body}</Text>
      <Press
        onPress={onPress}
        accessibilityLabel={cta}
        className="h-9 items-center justify-center rounded-sm border-[1.5px] border-green"
      >
        <Text className="font-ui-sb text-[12px] text-green">{cta}</Text>
      </Press>
    </Card>
  );
}

function GuestSignUpCard({ onPress }: { onPress: () => void }) {
  const tokens = useTokens();
  return (
    <View className="px-5 pt-6">
      <Card className="items-center gap-3.5 rounded-xl p-6">
        <View className="h-16 w-16 items-center justify-center rounded-lg bg-green/10">
          <LeafMark size={32} color={tokens.green} />
        </View>
        <View>
          <Text className="mb-1.5 text-center font-ui-b text-[18px] text-ink-1">
            Start your faith journey
          </Text>
          <Text className="text-center font-ui text-[14px] leading-[22px] text-ink-3">
            Join Faith Tribe to track streaks, unlock challenges, and grow with your tribe.
          </Text>
        </View>
        <Button label="Create a free account" onPress={onPress} className="w-full" height={52} />
      </Card>
    </View>
  );
}
