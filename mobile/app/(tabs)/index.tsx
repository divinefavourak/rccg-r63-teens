import { memo, useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompleteChallenge, useToday, useUnreadCount } from '../../src/api/queries';
import type { StreakState, TodayResponse } from '../../src/api/types';
import { Icon } from '../../src/components/Icon';
import { useNavClearance } from '../../src/components/useNavClearance';
import { DAY_MS, inRun, startOfDay, streakWeek, streakWords } from '../../src/data/streak';
import { useAuth } from '../../src/state/auth';
import { useMyPhoto } from '../../src/state/photo';
import { Object3D } from '../../src/ui/art';
import {
  HeroCard,
  PopCard,
  PopEyebrow,
  StreakCard,
  WeekPill,
  type WeekDayState,
} from '../../src/ui/cards';
import { Press } from '../../src/ui/Press';
import {
  EmptyState,
  GuestBanner,
  HEADER_GAP,
  OfflineBar,
  Skeleton,
} from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';
import { POP } from '../../src/theme/tokens';

/**
 * Today.
 *
 * "One Day. One Verse. One Message" is a visual principle, not just copy
 * (09-design-principles.md): the reading is the one hero, and everything under
 * "Your day" visibly supports it.
 *
 * One request drives the whole screen. `GET /today/` is public and returns the
 * shared half (reading, verse, challenge) with the personal half null for a
 * guest — exactly the split this screen renders.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { isGuest, user } = useAuth();
  const navClearance = useNavClearance(24);
  const photo = useMyPhoto();

  const today = useToday();
  const unread = useUnreadCount(!isGuest);
  const data = today.data;

  const openReading = useCallback(() => {
    const id = data?.devotional?.id;
    if (id) router.push({ pathname: '/devotional', params: { id } });
  }, [router, data]);

  const signUp = useCallback(() => router.push('/sign-up'), [router]);

  // A refetch that fails while there is still something to show is "offline",
  // not "broken": keep the saved screen and say so. With nothing saved there
  // is only the error to show.
  const offline = today.isError && !!data;
  const failed = today.isError && !data;

  return (
    <View className="flex-1 bg-surf-base">
      <Header
        name={isGuest ? null : (user?.first_name ?? null)}
        photo={photo}
        date={data?.date}
        streak={isGuest ? null : (data?.streak?.current_length ?? null)}
        hasUnread={(unread.data?.unread_count ?? 0) > 0}
        onBell={() => router.push('/notifications')}
      />
      {offline && <OfflineBar />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 20,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: navClearance,
        }}
        refreshControl={
          // A teen who finished the reading on another device expects a pull
          // to reconcile it.
          <RefreshControl refreshing={today.isRefetching} onRefresh={today.refetch} />
        }
      >
        {today.isPending ? (
          <Loading />
        ) : failed ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="sitting"
              message="We couldn’t load today’s reading. Check your connection, then try again."
              actionLabel="Try again"
              onAction={() => today.refetch()}
            />
          </View>
        ) : data ? (
          <>
            <Reading data={data} onOpen={openReading} />

            {isGuest ? (
              <GuestBanner
                title="Start your streak"
                body="Sign up to keep your days and saved verses."
                onSignUp={signUp}
              />
            ) : (
              <WeekStrip streak={data.streak} />
            )}

            <Text
              accessibilityRole="header"
              className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
            >
              Your day
            </Text>

            <DayGrid data={data} isGuest={isGuest} />

            {!isGuest && data.streak && <Streak streak={data.streak} done={data.devotional_completed} />}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

const Header = memo(function Header({
  name,
  photo,
  date,
  streak,
  hasUnread,
  onBell,
}: {
  /** Null for a guest. */
  name: string | null;
  photo: string | null;
  date: string | undefined;
  streak: number | null;
  hasUnread: boolean;
  onBell: () => void;
}) {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();

  return (
    <View
      className="flex-row items-center gap-3 px-5 pb-2"
      style={{ paddingTop: insets.top + HEADER_GAP }}
    >
      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-pop-amber">
        {photo ? (
          <Image
            source={photo}
            contentFit="cover"
            accessibilityLabel="Your photo"
            style={{ width: 48, height: 48 }}
          />
        ) : (
          <Text className="font-ui-b text-[17px] leading-6 text-pop-on">
            {name ? name.charAt(0).toUpperCase() : '👋'}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
        >
          {name ? `Hello, ${name}` : 'Hello there'}
        </Text>
        <Text className="font-ui text-[14px] leading-5 text-ink-2">{shortDate(date)}</Text>
      </View>

      {streak !== null && (
        <View
          accessible
          accessibilityLabel={`${streak}-day streak`}
          className="h-10 flex-row items-center gap-1 rounded-full bg-ink pl-2 pr-3.5"
        >
          <Object3D name="fire" size={26} />
          <Text className="font-ui-sb text-[14px] leading-5 text-on-ink">{streak}</Text>
        </View>
      )}

      <Press
        onPress={onBell}
        accessibilityLabel={hasUnread ? 'Notifications, unread' : 'Notifications'}
        className="h-11 w-11 items-center justify-center rounded-full bg-surf-sunken"
      >
        <Icon name="bell" size={24} color={tokens.text1} />
        {hasUnread && (
          <View
            className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-surf-sunken"
            style={{ backgroundColor: POP.pink }}
          />
        )}
      </Press>
    </View>
  );
});

// ─── The reading ───────────────────────────────────────────────────────────

function Reading({ data, onOpen }: { data: TodayResponse; onOpen: () => void }) {
  // A pipeline gap is a 200 with `has_devotional: false`, not a 404 — the
  // streak and challenge below are still true, so the screen keeps working and
  // only this card changes (06-user-flows.md flow 5).
  if (!data.has_devotional || !data.devotional) {
    return (
      <PopCard colour="green" className="w-full gap-2 rounded-3xl p-5">
        <PopEyebrow>Today’s reading</PopEyebrow>
        <Text className="font-ui-xb text-[28px] leading-9 tracking-[-0.56px] text-pop-on">
          On its way
        </Text>
        <Text className="font-ui text-[14px] leading-5 text-pop-on">
          Nothing has been published yet. Your streak is safe — check back a little later.
        </Text>
      </PopCard>
    );
  }

  const minutes = data.devotional.reading_time_minutes;
  return (
    <HeroCard
      eyebrow={minutes ? `Today’s reading · ${minutes} min` : 'Today’s reading'}
      title={data.devotional.title}
      detail={data.scripture_references[0]?.reference_display}
      actionLabel={data.devotional_completed ? 'Read again' : 'Read now'}
      onPress={onOpen}
      drawing="reading-side"
      object="notebook"
    />
  );
}

// ─── Week strip ────────────────────────────────────────────────────────────

/**
 * Seven days with today fifth: four behind, two ahead — as drawn. A past day
 * outside the run looks the same as a day still to come. There is no "missed"
 * state, on purpose (12-gamification.md: never shame a gap).
 */
function WeekStrip({ streak }: { streak: StreakState | null }) {
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const offset = i - 4;
      const date = new Date(today.getTime() + offset * DAY_MS);
      const state: WeekDayState =
        offset === 0 ? 'today' : offset < 0 && inRun(streak, -offset) ? 'done' : 'next';
      return {
        key: date.toISOString(),
        weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: date.getDate(),
        state,
      };
    });
  }, [streak]);

  return (
    <View className="w-full flex-row justify-between">
      {days.map((day) => (
        <WeekPill key={day.key} weekday={day.weekday} date={day.date} state={day.state} />
      ))}
    </View>
  );
}

// ─── Your day ──────────────────────────────────────────────────────────────

function DayGrid({ data, isGuest }: { data: TodayResponse; isGuest: boolean }) {
  const router = useRouter();
  const verse = data.memory_verse;
  // "John 3": where the teen left off in the Bible, if they have begun.
  const next = data.continue_reading?.chapter_detail.reference ?? null;

  return (
    <View className="w-full flex-row gap-3">
      <PopCard colour="violet" className="h-[224px] flex-1 gap-2">
        <PopEyebrow>Verse of the day</PopEyebrow>
        {verse ? (
          <>
            <Text numberOfLines={5} className="font-ui-b text-[17px] leading-6 text-pop-on">
              {verse.text}
            </Text>
            <View className="flex-1" />
            <Text className="pr-16 font-ui-sb text-[12px] leading-4 text-pop-on">
              {verse.reference_display}
            </Text>
          </>
        ) : (
          <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">
            Today’s verse will show here.
          </Text>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', right: 12, bottom: 2 }}>
          <Object3D name="bell" size={72} />
        </View>
      </PopCard>

      <View className="flex-1 gap-3">
        <Challenge data={data} isGuest={isGuest} />

        <PopCard
          colour="pink"
          onPress={() =>
            // The card knows "John 3" as words; the reader resolves them.
            next
              ? router.push({ pathname: '/bible', params: { passage: next } })
              : router.push('/bible')
          }
          accessibilityLabel={next ? `Continue reading ${next}` : 'Open the Bible'}
          className="h-[72px] flex-row items-center gap-2 py-3 pl-4 pr-3"
        >
          <View className="flex-1">
            <PopEyebrow>{next ? 'Continue' : 'Bible'}</PopEyebrow>
            <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-pop-on">
              {next ?? 'Read'}
            </Text>
          </View>
          {/* Always dark with a light arrow: it sits on pink in both themes. */}
          <View className="h-10 w-10 items-center justify-center rounded-full bg-pop-on">
            <Icon name="chevronRight" size={20} color="#FDFAF5" />
          </View>
        </PopCard>
      </View>
    </View>
  );
}

/**
 * The day's one challenge. Tapping it marks it done; there is no "undo" and no
 * penalty for leaving it (12-gamification.md).
 */
function Challenge({ data, isGuest }: { data: TodayResponse; isGuest: boolean }) {
  const router = useRouter();
  const complete = useCompleteChallenge();
  const challenge = data.challenge;
  const done = data.challenge_completed || complete.isSuccess;

  const onPress = useCallback(() => {
    if (isGuest) router.push('/sign-up');
    else if (!done && !complete.isPending) complete.mutate();
  }, [isGuest, router, done, complete]);

  if (!challenge) {
    return (
      <PopCard colour="sky" className="h-[140px] gap-1.5">
        <PopEyebrow>Challenge</PopEyebrow>
        <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">
          None today. Enjoy the quiet.
        </Text>
      </PopCard>
    );
  }

  return (
    <PopCard
      colour="sky"
      onPress={onPress}
      accessibilityLabel={
        done
          ? `Challenge done: ${challenge.title}`
          : isGuest
            ? `Challenge: ${challenge.title}. Sign up to take part.`
            : `Challenge: ${challenge.title}. Tap when you have done it.`
      }
      className="h-[140px] gap-1.5"
    >
      <PopEyebrow>{done ? 'Challenge · done' : 'Challenge'}</PopEyebrow>
      <Text numberOfLines={3} className="font-ui-sb text-[16px] leading-6 text-pop-on">
        {challenge.title}
      </Text>
      {done ? (
        <View
          className="absolute bottom-3 right-3 h-9 w-9 items-center justify-center rounded-full bg-pop-on"
        >
          <Icon name="check" size={20} color={POP.sky} />
        </View>
      ) : (
        <View pointerEvents="none" style={{ position: 'absolute', right: -6, bottom: -8 }}>
          <Object3D name="chat-bubble" size={64} />
        </View>
      )}
    </PopCard>
  );
}

// ─── Streak ────────────────────────────────────────────────────────────────

function Streak({ streak, done }: { streak: StreakState; done: boolean }) {
  return <StreakCard {...streakWords(streak, done)} week={streakWeek(streak, done)} />;
}

// ─── Loading ───────────────────────────────────────────────────────────────

/** Blocks in the shape of what is coming, so nothing jumps when it lands. */
function Loading() {
  return (
    <>
      <Skeleton height={212} radius={28} />
      <View className="flex-row justify-between">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} width={40} height={76} radius={999} />
        ))}
      </View>
      <Skeleton width={120} height={24} radius={8} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Skeleton height={224} />
        </View>
        <View className="flex-1 gap-3">
          <Skeleton height={140} />
          <Skeleton height={72} />
        </View>
      </View>
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** "Thu 1 October", from the server's date so it agrees with the reading. */
function shortDate(iso: string | undefined): string {
  const date = iso ? new Date(`${iso}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday} ${date.getDate()} ${month}`;
}
