import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { Photo } from '../../src/components/Photo';
import { Card, Press, ProgressBar, SectionHeader } from '../../src/components/ui';
import { useTokens } from '../../src/theme/ThemeProvider';
import { useSession } from '../../src/state/session';
import {
  CATEGORIES,
  FEATURED,
  SHELVES,
  type LibraryItem,
  type LibraryItemType,
  type Shelf,
} from '../../src/data/content';

/** Verb per content type — "Read"/"Watch" tells a teen what they're in for. */
const TYPE_VERB: Record<LibraryItemType, string> = {
  devotional: 'Read',
  video: 'Watch',
  podcast: 'Listen',
  course: 'Learn',
};

const TYPE_ICON = {
  devotional: 'book',
  video: 'video',
  podcast: 'headphones',
  course: 'school',
} as const;

/**
 * Library — devotionals, videos, podcasts and courses.
 *
 * Search lives in the top bar rather than as a nav destination
 * (05-navigation.md), and opening it from here scopes it to content.
 */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Filtering happens here so the shelves stay dumb renderers. With fixtures
  // this is cheap, but memoising keeps the shelf identities stable, which is
  // what lets the memoised cards below actually skip work.
  const shelves = useMemo<Shelf[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q && !activeCategory) return SHELVES;

    const wantedType = activeCategory
      ? ({ devotionals: 'devotional', videos: 'video', podcasts: 'podcast', courses: 'course' } as const)[
          activeCategory as 'devotionals' | 'videos' | 'podcasts' | 'courses'
        ]
      : null;

    return SHELVES.map((shelf) => ({
      ...shelf,
      items: shelf.items.filter((item) => {
        if (wantedType && item.type !== wantedType) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) || item.author.toLowerCase().includes(q)
        );
      }),
    })).filter((shelf) => shelf.items.length > 0);
  }, [query, activeCategory]);

  const toggleCategory = useCallback((id: string) => {
    setActiveCategory((prev) => (prev === id ? null : id));
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-surf-base"
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      // Dismiss the keyboard when the user starts browsing rather than typing.
      keyboardDismissMode="on-drag"
    >
      <View className="px-5" style={{ paddingTop: insets.top + 16 }}>
        <Text className="mb-1 font-ui-b text-[24px] text-ink-1">Library</Text>
        <Text className="font-ui text-[14px] text-ink-3">
          Devotionals, videos, podcasts and courses
        </Text>

        <View className="mt-4 h-12 flex-row items-center gap-2.5 rounded-md border border-line bg-surf-raised px-3.5">
          <Icon name="search" size={18} color={tokens.text3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search devotionals, topics, speakers…"
            placeholderTextColor={tokens.text3}
            returnKeyType="search"
            accessibilityLabel="Search the library"
            className="flex-1 font-ui text-[15px] text-ink-1"
            style={{ paddingVertical: 0 }}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Icon name="close" size={16} color={tokens.text3} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Categories — filter chips, not navigation. */}
      <View className="flex-row flex-wrap gap-2.5 px-5 pt-5">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <Press
              key={cat.id}
              onPress={() => toggleCategory(cat.id)}
              accessibilityLabel={cat.label}
              accessibilityState={{ selected: active }}
              className="h-14 flex-row items-center gap-2.5 rounded-md px-4"
              style={{
                width: '47.5%',
                borderWidth: 1.5,
                borderColor: active ? cat.tint : tokens.border,
                backgroundColor: active ? cat.bg : tokens.surfRaised,
              }}
            >
              <Text className="text-[20px]">{cat.emoji}</Text>
              <Text
                className="font-ui-sb text-[14px]"
                style={{ color: active ? cat.tint : tokens.text1 }}
              >
                {cat.label}
              </Text>
            </Press>
          );
        })}
      </View>

      <FeaturedBanner />

      {shelves.length === 0 ? (
        <EmptyResults query={query} />
      ) : (
        shelves.map((shelf) => <ShelfRow key={shelf.id} shelf={shelf} />)
      )}
    </ScrollView>
  );
}

// ─── Featured ──────────────────────────────────────────────────────────────

function FeaturedBanner() {
  const pct = FEATURED.progress / FEATURED.days;

  return (
    <View className="px-5 pt-5">
      <View
        className="overflow-hidden rounded-xl p-5"
        style={{ backgroundColor: FEATURED.color }}
      >
        {/* Soft off-canvas circle — the design's only decorative flourish. */}
        <View
          pointerEvents="none"
          className="absolute h-32 w-32 rounded-full"
          style={{ right: -20, top: -20, backgroundColor: 'rgba(255,255,255,0.08)' }}
        />
        <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <Text className="font-ui-sb text-[11px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {FEATURED.tag}
          </Text>
        </View>

        <Text className="mb-1.5 mt-2.5 font-ui-b text-[20px] text-white">{FEATURED.title}</Text>
        <Text className="mb-4 font-ui text-[13px] leading-[18px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {FEATURED.subtitle}
        </Text>

        <View className="mb-3.5">
          <View className="mb-1.5 flex-row justify-between">
            <Text className="font-ui-md text-[12px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Day {FEATURED.progress} of {FEATURED.days}
            </Text>
            <Text className="font-ui-sb text-[12px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {Math.round(pct * 100)}%
            </Text>
          </View>
          <ProgressBar value={pct} height={5} track="rgba(255,255,255,0.25)" fill="#fff" />
        </View>

        <Press
          accessibilityLabel={`Continue day ${FEATURED.progress + 1}`}
          className="h-11 flex-row items-center gap-2 self-start rounded-sm bg-white px-5"
        >
          <Text className="font-ui-b text-[14px]" style={{ color: FEATURED.color }}>
            Continue Day {FEATURED.progress + 1}
          </Text>
          <Icon name="arrowRight" size={16} color={FEATURED.color} />
        </Press>
      </View>
    </View>
  );
}

// ─── Shelves ───────────────────────────────────────────────────────────────

const ShelfRow = memo(function ShelfRow({ shelf }: { shelf: Shelf }) {
  const renderItem = useCallback(
    ({ item }: { item: LibraryItem }) => <ItemCard item={item} />,
    [],
  );

  return (
    <View className="pt-7">
      <SectionHeader title={shelf.title} actionLabel="See all" className="mb-3.5 px-5" />
      {/* Horizontal FlatList rather than a ScrollView of all children: only
          the visible cards mount, so their images never get fetched offscreen. */}
      <FlatList
        data={shelf.items}
        keyExtractor={keyOfItem}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        // Cards are a fixed 160 + 12 gap, so the list can position rows without
        // measuring them — this removes a layout pass per scroll frame.
        getItemLayout={getCardLayout}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
});

const keyOfItem = (item: LibraryItem) => item.id;

const CARD_WIDTH = 160;
const CARD_GAP = 12;
const getCardLayout = (_: unknown, index: number) => ({
  length: CARD_WIDTH,
  offset: (CARD_WIDTH + CARD_GAP) * index,
  index,
});

const ItemCard = memo(function ItemCard({ item }: { item: LibraryItem }) {
  const tokens = useTokens();
  const { saved, toggleSaved } = useSession();
  const isSaved = saved.has(item.id);

  const onSave = useCallback(() => toggleSaved(item.id), [item.id, toggleSaved]);

  return (
    <Card className="overflow-hidden" style={{ width: CARD_WIDTH }}>
      <View className="h-[90px]">
        <Photo
          uri={item.photoUrl}
          recyclingKey={item.id}
          fallbackColor={item.color}
          accessibilityLabel={item.title}
          scrim={{ top: 0.12, bottom: 0.38 }}
          style={{ width: '100%', height: '100%' }}
        />

        {(item.type === 'video' || item.type === 'podcast') && (
          <View
            className="absolute bottom-2 left-2 h-7 w-7 items-center justify-center rounded-sm"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <Icon name={item.type === 'video' ? 'play' : 'headphones'} size={13} color="#fff" />
          </View>
        )}

        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
          accessibilityState={{ selected: isSaved }}
          hitSlop={6}
          className="absolute right-2 top-2 h-[30px] w-[30px] items-center justify-center rounded-sm"
          style={{ backgroundColor: 'rgba(255,255,255,0.88)' }}
        >
          <Icon name="bookmark" size={14} color={isSaved ? tokens.green : '#857D78'} filled={isSaved} />
        </Pressable>

        {item.progress !== undefined && (
          <View className="absolute bottom-0 left-0 right-0">
            <ProgressBar value={item.progress / 100} height={3} track="rgba(0,0,0,0.12)" />
          </View>
        )}
      </View>

      <View className="px-3 pb-3.5 pt-3">
        <View className="mb-1.5 flex-row items-center gap-1">
          <Icon name={TYPE_ICON[item.type]} size={13} color={tokens.text3} />
          <Text className="font-ui-md text-[11px] text-ink-3">
            {TYPE_VERB[item.type]} · {item.duration}
          </Text>
        </View>
        <Text numberOfLines={2} className="mb-1 font-ui-sb text-[13px] leading-[18px] text-ink-1">
          {item.title}
        </Text>
        <Text numberOfLines={1} className="font-ui text-[11px] text-ink-3">
          {item.author}
        </Text>
      </View>
    </Card>
  );
});

// ─── Empty state ───────────────────────────────────────────────────────────

/** Illustration + one line + one action (06-user-flows.md flow 26). */
function EmptyResults({ query }: { query: string }) {
  return (
    <View className="items-center gap-3 px-8 py-16">
      <View className="h-[72px] w-[72px] items-center justify-center rounded-lg bg-green/10">
        <Text className="text-[28px]">🌱</Text>
      </View>
      <Text className="font-ui-b text-[16px] text-ink-1">Nothing here yet</Text>
      <Text className="text-center font-ui text-[13px] leading-5 text-ink-3">
        {query
          ? `We couldn't find anything for "${query}". Try a different word.`
          : 'No items in this category yet — check back soon.'}
      </Text>
    </View>
  );
}
