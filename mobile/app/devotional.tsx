import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../src/api/client';
import {
  useDevotional,
  useMarkDevotionalRead,
  useSaved,
  useToday,
} from '../src/api/queries';
import type { DevotionalDetail } from '../src/api/types';
import { Icon } from '../src/components/Icon';
import { useAuth } from '../src/state/auth';
import { Drawing, Object3D } from '../src/ui/art';
import { Button } from '../src/ui/Button';
import {
  EmptyState,
  GuestBanner,
  Sheet,
  Skeleton,
  TopAppBar,
  VerseCard,
} from '../src/ui/screen';
import { useTokens } from '../src/theme/ThemeProvider';

/**
 * Today's reading.
 *
 * Open to everyone: a guest reads the whole thing, with one banner above it
 * and an offer to sign up only *after* they finish (the sheet on "Mark as
 * done"). Reading is never gated (05-navigation.md).
 *
 * Set in the reader's serif (Lora). Every Open Heavens section is optional per
 * devotional, so each one renders on its own presence rather than assuming a
 * fixed template.
 */
export default function DevotionalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { isGuest } = useAuth();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const today = useToday();
  // Opened from Today with an id; opened from a deep link without one, in which
  // case today's devotional is the right subject.
  const devotionalId = id ?? today.data?.devotional?.id;
  const isTodays = !!devotionalId && devotionalId === today.data?.devotional?.id;

  const query = useDevotional(devotionalId);
  const saved = useSaved('devotional', !isGuest);
  const markRead = useMarkDevotionalRead();

  const [sheetOpen, setSheetOpen] = useState(false);

  const devotional = query.data;
  const bookmarked = devotionalId ? saved.isSaved(devotionalId) : false;
  const done = markRead.isSuccess || (isTodays && (today.data?.devotional_completed ?? false));

  const signUp = useCallback(() => {
    setSheetOpen(false);
    router.push('/sign-up');
  }, [router]);

  const logIn = useCallback(() => {
    setSheetOpen(false);
    router.push('/log-in');
  }, [router]);

  const onBookmark = useCallback(() => {
    if (!devotionalId) return;
    if (isGuest) router.push('/log-in');
    else saved.toggle(devotionalId);
  }, [devotionalId, isGuest, router, saved]);

  const onDone = useCallback(() => {
    if (!devotionalId) return;
    // A guest cannot keep a streak, so finishing is the moment to offer an
    // account — after the reading, never in front of it.
    if (isGuest) setSheetOpen(true);
    else markRead.mutate(devotionalId);
  }, [devotionalId, isGuest, markRead]);

  // No id in the link and today's has not loaded yet: still loading, not broken.
  const waiting = query.isPending && (!!devotionalId || today.isPending);

  return (
    <View className="flex-1 bg-surf-base">
      <TopAppBar
        title={isTodays || !devotionalId ? 'Today’s reading' : 'Reading'}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        action={
          devotional
            ? {
                icon: 'bookmark',
                label: bookmarked ? 'Remove from saved' : 'Save this reading',
                onPress: onBookmark,
                filled: bookmarked,
              }
            : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
      >
        {/* A comfortable measure on tablets and wide phones. */}
        <View className="mx-auto w-full flex-1 gap-5" style={{ maxWidth: 640 }}>
          {waiting ? (
            <ReaderSkeleton />
          ) : !devotional ? (
            <View className="flex-1 justify-center">
              <EmptyState
                drawing="sitting"
                message={
                  query.error instanceof ApiError && query.error.status === 404
                    ? 'That reading is not here any more. Today’s is waiting for you.'
                    : !devotionalId
                      ? 'Today’s reading has not been published yet. Check back a little later.'
                      : 'We couldn’t load this reading. Check your connection, then try again.'
                }
                actionLabel={devotionalId ? 'Try again' : 'Back to Today'}
                onAction={() => (devotionalId ? query.refetch() : router.replace('/'))}
              />
            </View>
          ) : (
            <>
              {isGuest && (
                <GuestBanner
                  title="You’re reading as a guest"
                  body="It’s free to read. Sign up to keep a streak."
                  onSignUp={signUp}
                />
              )}

              <Text className="font-ui-md text-[12px] uppercase leading-4 text-ink-3">
                {longDate(devotional.date)} · {readingMinutes(devotional)} min read
              </Text>

              <Text
                accessibilityRole="header"
                className="font-read-sb text-[24px] leading-8 text-ink-1"
              >
                {devotional.title}
              </Text>

              <BibleLink
                devotional={devotional}
                onPress={() => {
                  const place = devotional.scripture_references[0];
                  if (place) {
                    router.push({
                      pathname: '/bible',
                      params: {
                        book: place.book_osis,
                        chapter: String(place.chapter_number),
                        ...(place.start_verse_number
                          ? { verse: String(place.start_verse_number) }
                          : {}),
                      },
                    });
                  } else if (devotional.bible_text_passage) {
                    // Older readings hold the passage only as words.
                    router.push({
                      pathname: '/bible',
                      params: { passage: devotional.bible_text_passage },
                    });
                  } else {
                    router.push('/bible');
                  }
                }}
              />

              {paragraphs(devotional.content).map((para, i) => (
                <Text key={i} className="font-read text-[18px] leading-[30px] text-ink-1">
                  {para}
                </Text>
              ))}

              <Verse devotional={devotional} />

              {!!devotional.key_point && <Callout label="Key point">{devotional.key_point}</Callout>}
              {!!devotional.action_point && (
                <Callout label="Action point">{devotional.action_point}</Callout>
              )}

              {!!devotional.prayer && <Closing title="Prayer">{devotional.prayer}</Closing>}
              {!!devotional.confession && (
                <Closing title="Confession">{devotional.confession}</Closing>
              )}

              {!!devotional.bible_in_one_year && (
                <View className="flex-row items-center gap-3">
                  <Icon name="book" size={20} color={tokens.text3} />
                  <Text className="flex-1 font-ui text-[14px] leading-5 text-ink-2">
                    <Text className="font-ui-sb text-ink-1">Bible in one year: </Text>
                    {devotional.bible_in_one_year}
                  </Text>
                </View>
              )}

              {markRead.isError && (
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-center font-ui-md text-[14px] leading-5 text-feedback-error"
                >
                  That did not save. Check your connection and tap again.
                </Text>
              )}

              {done ? (
                <View
                  accessible
                  accessibilityLabel="Done for today"
                  className="h-12 w-full flex-row items-center justify-center gap-2 rounded-full bg-green-tonal"
                >
                  <Icon name="check" size={20} color={tokens.green} />
                  <Text className="font-ui-sb text-[16px] leading-6 text-green">Done for today</Text>
                </View>
              ) : (
                <Button
                  label="Mark as done"
                  onPress={onDone}
                  loading={markRead.isPending}
                  className="h-12 w-full"
                />
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View className="mt-1 h-[150px] w-[150px] items-center justify-center rounded-full bg-pop-lime">
          <Drawing name="reading" width={109} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 110, top: -6 }}>
            <Object3D name="fire" size={56} />
          </View>
        </View>
        <Text
          accessibilityRole="header"
          className="text-center font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-ink-1"
        >
          Nice. You finished today’s reading
        </Text>
        <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">
          Create a free account and this counts as day one of your streak. Or keep reading as a
          guest.
        </Text>
        <Button label="Create account" onPress={signUp} className="w-full" />
        <Button label="I already have an account" variant="secondary" onPress={logIn} className="w-full" />
        <Button
          label="Not now"
          variant="tertiary"
          onPress={() => setSheetOpen(false)}
          className="w-full"
        />
      </Sheet>
    </View>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

/** "Read Ephesians 6:10–18 in the Bible" — only when there is a passage to name. */
function BibleLink({ devotional, onPress }: { devotional: DevotionalDetail; onPress: () => void }) {
  const tokens = useTokens();
  const passage =
    devotional.scripture_references[0]?.reference_display ?? devotional.bible_text_passage;
  if (!passage) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      className="h-11 flex-row items-center gap-2 self-start"
    >
      <Icon name="book" size={20} color={tokens.green} />
      <Text numberOfLines={1} className="shrink font-ui-sb text-[14px] leading-5 text-green">
        Read {passage} in the Bible
      </Text>
      <Icon name="chevronRight" size={16} color={tokens.green} />
    </Pressable>
  );
}

function Verse({ devotional }: { devotional: DevotionalDetail }) {
  const verse = devotional.memory_verse;
  const text = verse?.text ?? devotional.memory_verse_content;
  if (!text) return null;

  const reference = verse?.reference_display ?? devotional.memory_verse_passage;
  return (
    <VerseCard
      verse={text}
      reference={
        reference && verse?.translation_code ? `${reference} · ${verse.translation_code}` : reference
      }
      attribution={verse?.attribution}
    />
  );
}

/** A sunken box for the one line to take away. */
function Callout({ label, children }: { label: string; children: string }) {
  return (
    <View className="w-full gap-2 rounded-lg bg-surf-sunken p-4">
      <Text className="font-ui-md text-[12px] uppercase leading-4 text-ink-3">{label}</Text>
      <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">{children}</Text>
    </View>
  );
}

/** Prayer and confession: a plain title and the words, in the reader's serif. */
function Closing({ title, children }: { title: string; children: string }) {
  return (
    <View className="w-full gap-2">
      <Text accessibilityRole="header" className="font-ui-b text-[17px] leading-6 text-ink-1">
        {title}
      </Text>
      <Text className="font-read text-[18px] leading-[30px] text-ink-2">{children}</Text>
    </View>
  );
}

function ReaderSkeleton() {
  return (
    <>
      <Skeleton width={200} height={16} radius={8} />
      <Skeleton width="70%" height={32} radius={8} />
      <Skeleton width="80%" height={20} radius={8} />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} width={i % 3 === 2 ? '72%' : '100%'} height={18} radius={8} />
      ))}
      <Skeleton height={180} />
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Split CMS body text into paragraphs.
 *
 * Prefers blank lines, but falls back to single newlines: the importer is not
 * consistent, and treating a single-newline entry as one paragraph produced a
 * wall of text that looked like the devotional had been truncated.
 */
function paragraphs(content: string | null | undefined): string[] {
  if (!content) return [];

  const byBlankLine = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (byBlankLine.length > 1) return byBlankLine;

  return content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Whole minutes at a teen's reading pace, never less than one. */
function readingMinutes(devotional: DevotionalDetail): number {
  const words = devotional.content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** "Thursday 1 October" from an ISO date. */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday} ${d.getDate()} ${month}`;
}
