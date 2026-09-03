import { memo, useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { Icon } from '../../src/components/Icon';
import { AvatarMark, FlameMark, LeafGlyph, LeafMark, LeafTick } from '../../src/components/BrandMarks';
import { Button, Card, CheckBox, Eyebrow, IconButton, Press, SectionHeader } from '../../src/components/ui';
import { useTokens } from '../../src/theme/ThemeProvider';
import { useSession } from '../../src/state/session';
import {
  DAILY_CHALLENGE,
  PROFILE,
  TODAY_DEVOTIONAL,
  VERSE_OF_THE_DAY,
  WEEK,
} from '../../src/data/content';

/**
 * Today.
 *
 * "One Day. One Verse. One Message" is a visual principle, not just copy
 * (09-design-principles.md): the devotional card is the single hero and every
 * other block on this screen visibly supports it. Nothing here competes for
 * the same attention.
 */
export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest, signIn } = useSession();

  const openDevotional = useCallback(() => router.push('/devotional'), [router]);
  const openNotifications = useCallback(() => router.push('/notifications'), [router]);

  return (
    <ScrollView
      className="flex-1 bg-surf-base"
      contentContainerStyle={{ paddingBottom: 32 }}
      // The app bar is index 0 and pinned; everything else scrolls under it.
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
    >
      <AppBar
        isGuest={isGuest}
        topInset={insets.top}
        onBellPress={openNotifications}
      />

      <Greeting isGuest={isGuest} />

      <View className="px-5 pt-5">
        <DevotionalCard onRead={openDevotional} />
      </View>

      <View className="px-5 pt-3.5">
        <VerseOfTheDay />
      </View>

      <View className="flex-row gap-3 px-5 pt-3.5">
        {isGuest ? (
          <>
            <LockedCard
              emoji="🔒"
              title="Start your streak"
              body="Sign up to track your journey"
              cta="Sign up"
              onPress={signIn}
            />
            <LockedCard
              emoji="✦"
              title="Daily challenge"
              body="Join to unlock today's challenge"
              cta="Join free"
              onPress={signIn}
            />
          </>
        ) : (
          <>
            <StreakCard />
            <ChallengeCard />
          </>
        )}
      </View>

      {!isGuest && <WeekTracker />}
      {isGuest && <GuestSignUpCard onPress={signIn} />}
    </ScrollView>
  );
}

// ─── App bar ───────────────────────────────────────────────────────────────

const AppBar = memo(function AppBar({
  isGuest,
  topInset,
  onBellPress,
}: {
  isGuest: boolean;
  topInset: number;
  onBellPress: () => void;
}) {
  const tokens = useTokens();

  return (
    <View
      className="flex-row items-center gap-3 border-b border-line bg-surf-base px-5 pb-4"
      style={{ paddingTop: topInset + 12 }}
    >
      <View className="h-9 w-9 items-center justify-center rounded bg-green">
        <LeafMark size={20} color="#fff" />
      </View>

      <Text className="flex-1 font-ui-b text-[13px] tracking-tight text-green">Faith Tribe</Text>

      <View>
        <IconButton name="bell" label="Notifications" onPress={onBellPress} />
        {!isGuest && (
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

function Greeting({ isGuest }: { isGuest: boolean }) {
  return (
    <View className="flex-row items-end justify-between gap-3 px-5 pt-6">
      <View>
        <Text className="mb-0.5 font-ui text-[15px] text-ink-3">{salutation()}</Text>
        <Text className="font-ui-xb text-[38px] leading-[40px] tracking-tight text-ink-1">
          {isGuest ? 'Friend' : PROFILE.firstName}
        </Text>
      </View>

      {!isGuest && (
        <View
          className="flex-row items-center gap-1.5 rounded-full bg-amber-tonal px-3.5 py-2"
          style={{ borderWidth: 1.5, borderColor: 'rgba(232,149,26,0.25)' }}
          accessibilityLabel={`${PROFILE.streak} day streak`}
        >
          <FlameMark size={16} />
          <Text className="font-ui-xb text-[18px] leading-[18px] text-amber-bright">
            {PROFILE.streak}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Time-of-day greeting — the design hardcodes "Good morning". */
function salutation(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

// ─── The hero card ─────────────────────────────────────────────────────────

function DevotionalCard({ onRead }: { onRead: () => void }) {
  const { saved, toggleSaved } = useSession();
  const bookmarked = saved.has(TODAY_DEVOTIONAL.id);

  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <Card className="overflow-hidden rounded-xl">
        <View className="px-5 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Eyebrow tone="green">Daily Devotional</Eyebrow>
            <Text className="font-ui-md text-[12px] text-ink-3">{TODAY_DEVOTIONAL.date}</Text>
          </View>

          <Text className="mb-2.5 font-ui-b text-[24px] leading-[30px] tracking-tight text-ink-1">
            {TODAY_DEVOTIONAL.title}
          </Text>

          <Text numberOfLines={2} className="mb-[18px] font-ui text-[14px] leading-[22px] text-ink-3">
            {TODAY_DEVOTIONAL.preview}
          </Text>

          {/* The memory verse, embedded on the deep green. This is the "one
              verse" of the day's single message. */}
          <View className="mb-[18px] rounded-md p-[18px]" style={{ backgroundColor: '#2D6340' }}>
            <Text
              className="mb-2.5 font-ui-b text-[10px] uppercase tracking-[1px]"
              style={{ color: 'rgba(144,210,162,0.9)' }}
            >
              Memory Verse
            </Text>
            <Text className="mb-2.5 font-read-i text-[15px] leading-[25px] text-white">
              {TODAY_DEVOTIONAL.memoryVerse.text}
            </Text>
            <Text
              className="font-ui-b text-[11px] tracking-wide"
              style={{ color: 'rgba(144,210,162,0.85)' }}
            >
              — {TODAY_DEVOTIONAL.memoryVerse.reference}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2.5 px-5 pb-5">
          <Button
            label="Read Full Devotional"
            onPress={onRead}
            className="flex-1"
            height={50}
            icon={<Icon name="arrowRight" size={16} color="#fff" />}
          />
          <IconButton
            name="bookmark"
            label={bookmarked ? 'Remove bookmark' : 'Bookmark devotional'}
            onPress={() => toggleSaved(TODAY_DEVOTIONAL.id)}
            active={bookmarked}
            filled={bookmarked}
            size={50}
          />
        </View>
      </Card>
    </Animated.View>
  );
}

// ─── Verse of the day ──────────────────────────────────────────────────────

function VerseOfTheDay() {
  const tokens = useTokens();
  return (
    <Card className="flex-row items-center gap-3 px-4 py-3.5">
      <View className="h-[38px] w-[38px] items-center justify-center rounded bg-amber-tonal">
        <Text className="text-[18px] text-amber">✦</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Eyebrow tone="amber">Verse of the day</Eyebrow>
        <Text numberOfLines={1} className="mt-0.5 font-read-i text-[13px] leading-[20px] text-ink-2">
          {VERSE_OF_THE_DAY.text}
        </Text>
        <Text className="mt-0.5 font-ui-sb text-[11px] text-ink-3">
          {VERSE_OF_THE_DAY.reference}
        </Text>
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

function StreakCard() {
  return (
    <Card className="flex-1 overflow-hidden p-4" style={{ backgroundColor: '#FDF5E4' }}>
      <FlameMark size={26} />
      <Text className="mb-0.5 mt-1.5 font-ui-xb text-[36px] leading-[36px] text-amber-bright">
        {PROFILE.streak}
      </Text>
      <Text className="font-ui-b text-[12px] text-ink-2">Day streak</Text>
      <Text className="mt-0.5 font-ui text-[11px] text-ink-3">Keep it going 🌱</Text>
    </Card>
  );
}

function ChallengeCard() {
  const { challengesDone, toggleChallenge } = useSession();
  const allDone = DAILY_CHALLENGE.every((c) => challengesDone.has(c.id));

  return (
    <Card className="flex-1 p-4">
      <Eyebrow>Today's challenge</Eyebrow>
      <View className="mt-3.5 gap-3">
        {DAILY_CHALLENGE.map((item) => (
          <ChallengeRow
            key={item.id}
            id={item.id}
            label={item.label}
            done={challengesDone.has(item.id)}
            onToggle={toggleChallenge}
          />
        ))}
      </View>
      {allDone && (
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
  id,
  label,
  done,
  onToggle,
}: {
  id: string;
  label: string;
  done: boolean;
  onToggle: (id: string) => void;
}) {
  const tokens = useTokens();
  const handle = useCallback(() => onToggle(id), [id, onToggle]);

  return (
    <View className="flex-row items-center gap-2.5">
      <CheckBox done={done} onToggle={handle} label={label} />
      <Text
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

function WeekTracker() {
  const tokens = useTokens();

  return (
    <View className="px-5 pt-6">
      <SectionHeader title="This week" actionLabel="View journey" className="mb-3.5" />
      <View className="flex-row gap-1.5">
        {WEEK.labels.map((day, i) => {
          const done = i <= WEEK.doneThrough;
          const isToday = i === WEEK.todayIndex;
          return (
            <View key={i} className="flex-1 items-center gap-1.5">
              <Text
                className={`font-ui-sb text-[11px] ${isToday ? 'text-green' : 'text-ink-3'}`}
              >
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
        <Button
          label="Sign up — it's free"
          onPress={onPress}
          className="w-full"
          height={52}
        />
        <Press onPress={onPress} accessibilityLabel="I already have an account">
          <Text className="font-ui text-[13px] text-ink-3">I already have an account</Text>
        </Press>
      </Card>
    </View>
  );
}
