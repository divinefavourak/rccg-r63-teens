import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '../src/components/Icon';
import { LeafDivider, LeafGlyph } from '../src/components/BrandMarks';
import { Button, Eyebrow, IconButton, Pill } from '../src/components/ui';
import { useTokens } from '../src/theme/ThemeProvider';
import { useSession } from '../src/state/session';
import { TODAY_DEVOTIONAL } from '../src/data/content';

/**
 * The full devotional.
 *
 * A long-form reading surface, so it follows the Reader's rules rather than
 * the card-based ones: serif for scripture, generous line height, and a
 * measure capped for comfortable reading (09-design-principles.md).
 */
export default function DevotionalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { saved, toggleSaved } = useSession();

  const [journal, setJournal] = useState('');
  const [complete, setComplete] = useState(false);

  const bookmarked = saved.has(TODAY_DEVOTIONAL.id);
  const onBookmark = useCallback(() => toggleSaved(TODAY_DEVOTIONAL.id), [toggleSaved]);

  const markComplete = useCallback(() => {
    setComplete(true);
    // Return to Today so the streak and week tracker are the first thing seen.
    setTimeout(() => router.back(), 550);
  }, [router]);

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
            <View className="mb-3 flex-row items-center gap-2.5">
              <Pill tone="green">
                <LeafGlyph size={11} color={tokens.green} />
                <Text className="font-ui-b text-[11px] uppercase tracking-wide text-green">
                  Day {TODAY_DEVOTIONAL.day}
                </Text>
              </Pill>
              <Text className="font-ui-md text-[12px] text-ink-3">{TODAY_DEVOTIONAL.date}</Text>
            </View>

            <Text className="mb-6 font-ui-b text-[28px] leading-[34px] tracking-tight text-ink-1">
              {TODAY_DEVOTIONAL.title}
            </Text>

            <View className="mb-6 flex-row items-center gap-2.5">
              <View className="h-px flex-1 bg-line" />
              <LeafDivider color={tokens.green} />
              <View className="h-px flex-1 bg-line" />
            </View>

            {/* Memory verse — amber tonal, serif, with the accent rule. */}
            <Animated.View
              entering={FadeInDown.duration(280)}
              className="mb-7 rounded-lg bg-amber-tonal px-5 py-[18px]"
              style={{ borderLeftWidth: 4, borderLeftColor: tokens.amberBright }}
            >
              <Eyebrow tone="amber">Memory verse</Eyebrow>
              <Text className="mb-2.5 mt-2.5 font-read-i text-[18px] leading-[30px] text-ink-1">
                {TODAY_DEVOTIONAL.memoryVerse.text}
              </Text>
              <Text className="font-ui-b text-[12px] tracking-wide text-amber">
                {TODAY_DEVOTIONAL.memoryVerse.reference} — {TODAY_DEVOTIONAL.memoryVerse.translation}
              </Text>
            </Animated.View>

            {/* Body — staggered so the page settles rather than snapping in. */}
            {TODAY_DEVOTIONAL.body.map((para, i) => (
              <Animated.Text
                key={i}
                entering={FadeInDown.delay(i * 60).duration(280)}
                className="font-ui text-[17px] leading-[30px] text-ink-2"
                style={{ marginBottom: i < TODAY_DEVOTIONAL.body.length - 1 ? 20 : 32 }}
              >
                {para}
              </Animated.Text>
            ))}

            {/* Reflection — the private journal. */}
            <View className="mb-5 rounded-lg bg-green-tonal px-5 py-[18px]">
              <Eyebrow tone="green">Reflect</Eyebrow>
              <Text className="mb-3.5 mt-2.5 font-ui-sb text-[15px] leading-[23px] text-ink-1">
                {TODAY_DEVOTIONAL.reflection}
              </Text>
              <TextInput
                value={journal}
                onChangeText={setJournal}
                placeholder="Write your thoughts here…"
                placeholderTextColor={tokens.text3}
                accessibilityLabel="Your reflection"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="rounded-sm border-[1.5px] border-line bg-surf-raised px-3.5 py-3 font-ui text-[14px] leading-[22px] text-ink-1"
                style={{ minHeight: 90 }}
              />
            </View>

            {/* Prayer — no card, just the words. */}
            <View className="mb-9 flex-row items-start gap-2.5 py-1">
              <View className="mt-0.5">
                <LeafGlyph size={18} color={tokens.green} />
              </View>
              <Text className="flex-1 font-read-i text-[14px] leading-[23px] text-ink-3">
                {TODAY_DEVOTIONAL.prayer}
              </Text>
            </View>

            <Button
              label={complete ? `Day ${TODAY_DEVOTIONAL.day} complete` : `Mark Day ${TODAY_DEVOTIONAL.day} complete`}
              onPress={markComplete}
              disabled={complete}
              height={52}
              icon={<LeafGlyph size={18} color="#fff" />}
              iconPosition="leading"
            />

            <Text className="mt-3.5 text-center font-ui text-[12px] text-ink-3">
              Day {TODAY_DEVOTIONAL.day + 1} unlocks tomorrow morning
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
