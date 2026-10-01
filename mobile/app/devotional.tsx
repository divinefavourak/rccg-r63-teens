import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '../src/components/Icon';
import { LeafDivider, LeafGlyph } from '../src/components/BrandMarks';
import { Button, Card, Eyebrow, IconButton, Pill } from '../src/components/ui';
import { ErrorState, Skeleton } from '../src/components/states';
import { useTokens } from '../src/theme/ThemeProvider';
import { useAuth } from '../src/state/auth';
import { useDevotional, useSaved, useToday } from '../src/api/queries';

/**
 * The full devotional.
 *
 * A long-form reading surface, so it follows the Reader's rules rather than the
 * card-based ones: serif for scripture, generous line height, and a measure
 * capped for comfortable reading (09-design-principles.md).
 *
 * An Open Heavens entry is a fixed set of sections — memory verse, Bible
 * reading, message, key point, action point, prayer, Bible in one year — but
 * any given day fills only some of them. Each renders on its own presence
 * rather than against an assumed template, because assuming one is how whole
 * sections went missing from complete devotionals.
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

  const query = useDevotional(devotionalId);
  const saved = useSaved('devotional', !isGuest);

  const [journal, setJournal] = useState('');

  const devotional = query.data;
  const bookmarked = devotionalId ? saved.isSaved(devotionalId) : false;

  const onBookmark = useCallback(() => {
    if (!devotionalId) return;
    if (isGuest) {
      router.push('/sign-in');
      return;
    }
    saved.toggle(devotionalId);
  }, [devotionalId, isGuest, router, saved]);

  const verse = devotional?.memory_verse;
  const verseText = verse?.text ?? devotional?.memory_verse_content;
  const verseRef = verse?.reference_display ?? devotional?.memory_verse_passage;

  // The importer writes the same verse into both `memory_verse_*` and
  // `anchor_scripture`/`scripture_text` — identical in every published
  // devotional checked. Rendering both printed the memory verse twice, so the
  // anchor block only appears when it genuinely carries something else.
  const anchorDiffers =
    !!devotional?.scripture_text &&
    normalise(devotional.scripture_text) !== normalise(verseText) &&
    normalise(devotional.anchor_scripture) !== normalise(verseRef);

  return (
    <View className="flex-1 bg-surf-base">
      <View
        className="flex-row items-center justify-between border-b border-line bg-surf-raised px-4 pb-3.5"
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable
          onPress={router.back}
          accessibilityRole="button"
          accessibilityLabel="Back to Today"
          className="h-11 flex-row items-center gap-1 pr-3"
          hitSlop={8}
        >
          <Icon name="chevronLeft" size={20} color={tokens.green} />
          <Text className="font-ui-sb text-[15px] text-green">Today</Text>
        </Pressable>

        <View className="flex-row gap-2">
          <IconButton
            name="bookmark"
            label={bookmarked ? 'Remove bookmark' : 'Bookmark devotional'}
            onPress={onBookmark}
            active={bookmarked}
            filled={bookmarked}
            iconSize={18}
          />
          <IconButton name="share" label="Share devotional" iconSize={18} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 64 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mx-auto w-full" style={{ maxWidth: 640 }}>
            {query.isPending ? (
              <ReaderSkeleton />
            ) : query.isError || !devotional ? (
              <ErrorState error={query.error} onRetry={query.refetch} />
            ) : (
              <>
                <View className="mb-3 flex-row items-center gap-2.5">
                  <Pill tone="green">
                    <LeafGlyph size={11} color={tokens.green} />
                    <Text className="font-ui-b text-[11px] uppercase tracking-wide text-green">
                      Devotional
                    </Text>
                  </Pill>
                  <Text className="font-ui-md text-[12px] text-ink-3">
                    {formatDate(devotional.date)}
                  </Text>
                </View>

                <Text className="mb-2 font-ui-b text-[28px] leading-[34px] tracking-tight text-ink-1">
                  {devotional.title}
                </Text>

                {!!devotional.author && (
                  <Text className="mb-6 font-ui-md text-[13px] text-ink-3">
                    {devotional.author}
                  </Text>
                )}

                <View className="mb-6 flex-row items-center gap-2.5">
                  <View className="h-px flex-1 bg-line" />
                  <LeafDivider color={tokens.green} />
                  <View className="h-px flex-1 bg-line" />
                </View>

                {/* Memory verse — amber tonal, serif, with the accent rule. */}
                {!!verseText && (
                  <Animated.View
                    entering={FadeInDown.duration(280)}
                    className="mb-7 rounded-lg bg-amber-tonal px-5 py-[18px]"
                    style={{ borderLeftWidth: 4, borderLeftColor: tokens.amberBright }}
                  >
                    <Eyebrow tone="amber">Memory verse</Eyebrow>
                    <Text className="mb-2.5 mt-2.5 font-read-i text-[18px] leading-[30px] text-ink-1">
                      {verseText}
                    </Text>
                    {!!verseRef && (
                      <Text className="font-ui-b text-[12px] tracking-wide text-amber">
                        {verseRef}
                        {verse?.translation_code ? ` — ${verse.translation_code}` : ''}
                      </Text>
                    )}
                    {/* Licensed translations require the copyright line
                        (08-bible-experience.md §11). */}
                    {!!verse?.attribution && (
                      <Text className="mt-2 font-ui text-[11px] leading-4 text-ink-3">
                        {verse.attribution}
                      </Text>
                    )}
                  </Animated.View>
                )}

                {/* Anchor scripture — shown only when it is not simply the
                    memory verse repeated. */}
                {anchorDiffers && (
                  <Section title="Scripture" tone="green">
                    <Text className="font-read-i text-[16px] leading-[28px] text-ink-1">
                      {devotional.scripture_text}
                    </Text>
                    {!!devotional.anchor_scripture && (
                      <Text className="mt-2 font-ui-b text-[12px] tracking-wide text-green">
                        {devotional.anchor_scripture}
                      </Text>
                    )}
                  </Section>
                )}

                {/* Bible reading. */}
                {!!devotional.bible_text_content && (
                  <Section title={devotional.bible_text_passage ?? 'Bible reading'}>
                    {paragraphs(devotional.bible_text_content).map((para, i) => (
                      <Text
                        key={i}
                        className="font-read text-[16px] leading-[28px] text-ink-2"
                        style={{ marginTop: i === 0 ? 0 : 12 }}
                      >
                        {para}
                      </Text>
                    ))}
                  </Section>
                )}

                {/* The message. Arrives as one string from the CMS; split on
                    blank lines so each paragraph settles in on its own. */}
                {paragraphs(devotional.content).map((para, i) => (
                  <Animated.Text
                    key={i}
                    entering={FadeInDown.delay(Math.min(i, 6) * 60).duration(280)}
                    className="font-ui text-[17px] leading-[30px] text-ink-2"
                    style={{ marginBottom: 20 }}
                  >
                    {para}
                  </Animated.Text>
                ))}

                {!!devotional.key_point && (
                  <Section title="Key point" tone="green">
                    <Text className="font-ui-sb text-[15px] leading-[24px] text-ink-1">
                      {devotional.key_point}
                    </Text>
                  </Section>
                )}

                {!!devotional.action_point && (
                  <Section title="Action point" tone="green">
                    <Text className="font-ui-sb text-[15px] leading-[24px] text-ink-1">
                      {devotional.action_point}
                    </Text>
                  </Section>
                )}

                {!!devotional.confession && (
                  <Section title="Confession" tone="amber">
                    <Text className="font-read-i text-[15px] leading-[26px] text-ink-1">
                      {devotional.confession}
                    </Text>
                  </Section>
                )}

                {/* Reflection — the private journal. Local for now: the backend
                    has no journal endpoint, so this is deliberately not
                    presented as saved. */}
                {devotional.discussion_questions.length > 0 && (
                  <Section title="Reflect" tone="green">
                    <Text className="mb-3.5 font-ui-sb text-[15px] leading-[23px] text-ink-1">
                      {devotional.discussion_questions[0].text}
                    </Text>
                    <TextInput
                      value={journal}
                      onChangeText={setJournal}
                      placeholder="Write your thoughts here…"
                      placeholderTextColor={tokens.text3}
                      accessibilityLabel="Your reflection"
                      multiline
                      textAlignVertical="top"
                      className="rounded-sm border-[1.5px] border-line bg-surf-raised px-3.5 py-3 font-ui text-[14px] leading-[22px] text-ink-1"
                      style={{ minHeight: 90 }}
                    />
                  </Section>
                )}

                {!!devotional.prayer && (
                  <View className="mb-7 flex-row items-start gap-2.5 py-1">
                    <View className="mt-0.5">
                      <LeafGlyph size={18} color={tokens.green} />
                    </View>
                    <Text className="flex-1 font-read-i text-[15px] leading-[26px] text-ink-3">
                      {devotional.prayer}
                    </Text>
                  </View>
                )}

                {!!devotional.bible_in_one_year && (
                  <Card className="mb-8 flex-row items-center gap-3 p-4">
                    <View className="h-9 w-9 items-center justify-center rounded-sm bg-green/10">
                      <Icon name="book" size={18} color={tokens.green} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-ui-sb text-[13px] text-ink-1">Bible in one year</Text>
                      <Text className="mt-0.5 font-ui text-[13px] text-ink-2">
                        {devotional.bible_in_one_year}
                      </Text>
                    </View>
                  </Card>
                )}

                {isGuest ? (
                  <Button
                    label="Sign in to track your streak"
                    onPress={() => router.push('/sign-in')}
                    height={52}
                  />
                ) : (
                  <CompleteButton completed={today.data?.devotional_completed ?? false} />
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** A titled block. Tonal background for the ones the design calls out. */
function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'green' | 'amber';
  children: React.ReactNode;
}) {
  const bg =
    tone === 'green' ? 'bg-green-tonal' : tone === 'amber' ? 'bg-amber-tonal' : 'bg-surf-raised';
  const border = tone ? '' : 'border border-line';

  return (
    <View className={`mb-7 rounded-lg px-5 py-[18px] ${bg} ${border}`}>
      <Eyebrow tone={tone ?? 'muted'}>{title}</Eyebrow>
      <View className="mt-2.5">{children}</View>
    </View>
  );
}

/**
 * Marking a devotional read.
 *
 * Reading completion is recorded by the Progress domain, which the app does not
 * yet post to — the challenge endpoint is the only completion route wired. This
 * reflects state rather than inventing a write the backend has not agreed to.
 */
function CompleteButton({ completed }: { completed: boolean }) {
  const tokens = useTokens();

  if (completed) {
    return (
      <View className="h-[52px] flex-row items-center justify-center gap-2.5 rounded-md bg-green/10">
        <Icon name="check" size={20} color={tokens.green} />
        <Text className="font-ui-sb text-[16px] text-green">Completed today</Text>
      </View>
    );
  }

  return (
    <View className="h-[52px] flex-row items-center justify-center gap-2.5 rounded-md bg-surf-sunken">
      <LeafGlyph size={18} color={tokens.text3} />
      <Text className="font-ui-sb text-[15px] text-ink-3">Reading counts once you finish</Text>
    </View>
  );
}

function ReaderSkeleton() {
  return (
    <View className="gap-4">
      <Skeleton width={140} height={22} radius={999} />
      <Skeleton width="90%" height={30} />
      <Skeleton height={110} radius={16} />
      <Skeleton height={16} />
      <Skeleton height={16} />
      <Skeleton width="80%" height={16} />
      <Skeleton height={16} />
      <Skeleton width="65%" height={16} />
    </View>
  );
}

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

/** Compare verse text ignoring case, punctuation and spacing noise. */
function normalise(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "Tuesday, 2 Sep" from an ISO date, in the device locale. */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}
