import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { Photo } from '../../src/components/Photo';
import { Card, Press, ProgressBar, SectionHeader } from '../../src/components/ui';
import { EmptyState, ErrorState, Skeleton } from '../../src/components/states';
import { useTokens } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/state/auth';
import { useNavClearance } from '../../src/components/useNavClearance';
import { useDevotionals, useSaved } from '../../src/api/queries';
import type { DevotionalListItem } from '../../src/api/types';

/**
 * Library — devotionals, videos, podcasts and courses.
 *
 * Search lives in the top bar rather than as a nav destination
 * (05-navigation.md), and opening it from here scopes it to content.
 *
 * Only devotionals are wired: `/content/` also exposes articles, manuals and
 * manual series, and `/media/` the video and podcast catalogue. Those shelves
 * arrive with the player work (see mobile/README.md).
 */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const router = useRouter();
  const navClearance = useNavClearance(24);
  const { isGuest } = useAuth();

  const [query, setQuery] = useState('');
  // Keeps typing responsive: the field updates every keystroke while the list
  // re-renders against the settled value.
  const deferredQuery = useDeferredValue(query);

  const devotionals = useDevotionals(deferredQuery.trim() || undefined);
  const saved = useSaved('devotional', !isGuest);

  const items = devotionals.data ?? [];

  // Newest first, and split into "this week" and the rest so the shelf
  // structure the design calls for survives a flat API response.
  const shelves = useMemo(() => {
    const sorted = [...items].sort((a, b) => +new Date(b.date) - +new Date(a.date));
    const weekAgo = Date.now() - 7 * 86_400_000;

    const recent = sorted.filter((d) => +new Date(d.date) >= weekAgo);
    const older = sorted.filter((d) => +new Date(d.date) < weekAgo);

    return [
      { id: 'recent', title: 'New this week', items: recent },
      { id: 'earlier', title: 'Earlier devotionals', items: older },
    ].filter((s) => s.items.length > 0);
  }, [items]);

  const openDevotional = useCallback(
    (id: string) => router.push({ pathname: '/devotional', params: { id } }),
    [router],
  );

  return (
    <ScrollView
      className="flex-1 bg-surf-base"
      contentContainerStyle={{ paddingBottom: navClearance }}
      showsVerticalScrollIndicator={false}
      // Dismiss the keyboard when the user starts browsing rather than typing.
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl refreshing={devotionals.isRefetching} onRefresh={devotionals.refetch} />
      }
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

      {devotionals.isPending ? (
        <ShelfSkeleton />
      ) : devotionals.isError ? (
        <ErrorState error={devotionals.error} onRetry={devotionals.refetch} />
      ) : shelves.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={
            query
              ? `We couldn't find anything for "${query}". Try a different word.`
              : 'New devotionals will appear here as they are published.'
          }
        />
      ) : (
        shelves.map((shelf) => (
          <ShelfRow
            key={shelf.id}
            title={shelf.title}
            items={shelf.items}
            onOpen={openDevotional}
            isSaved={saved.isSaved}
            onToggleSave={isGuest || saved.unavailable ? undefined : saved.toggle}
          />
        ))
      )}
    </ScrollView>
  );
}

// ─── Shelves ───────────────────────────────────────────────────────────────

const CARD_WIDTH = 160;
const CARD_GAP = 12;

const ShelfRow = memo(function ShelfRow({
  title,
  items,
  onOpen,
  isSaved,
  onToggleSave,
}: {
  title: string;
  items: DevotionalListItem[];
  onOpen: (id: string) => void;
  isSaved: (id: string) => boolean;
  onToggleSave?: (id: string) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: DevotionalListItem }) => (
      <ItemCard
        item={item}
        onOpen={onOpen}
        saved={isSaved(item.id)}
        onToggleSave={onToggleSave}
      />
    ),
    [onOpen, isSaved, onToggleSave],
  );

  return (
    <View className="pt-7">
      <SectionHeader title={title} actionLabel="See all" className="mb-3.5 px-5" />
      {/* Horizontal FlatList rather than a ScrollView of all children: only the
          visible cards mount, so their images are never fetched offscreen. */}
      <FlatList
        data={items}
        keyExtractor={keyOfItem}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: CARD_GAP }}
        // Cards are a fixed width, so the list can position rows without
        // measuring them — this removes a layout pass per scroll frame.
        getItemLayout={getCardLayout}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
});

const keyOfItem = (item: DevotionalListItem) => item.id;

const getCardLayout = (_: unknown, index: number) => ({
  length: CARD_WIDTH,
  offset: (CARD_WIDTH + CARD_GAP) * index,
  index,
});

/** Cover tints, so a devotional without a cover image still reads as a card. */
const TINTS = ['#E8F3EC', '#FDF0DC', '#EEF0FD', '#FDE8EE'];

const ItemCard = memo(function ItemCard({
  item,
  onOpen,
  saved,
  onToggleSave,
}: {
  item: DevotionalListItem;
  onOpen: (id: string) => void;
  saved: boolean;
  onToggleSave?: (id: string) => void;
}) {
  const tokens = useTokens();
  const tint = TINTS[hash(item.id) % TINTS.length];

  return (
    <Press
      onPress={() => onOpen(item.id)}
      accessibilityLabel={item.title}
      scaleTo={0.97}
      style={{ width: CARD_WIDTH }}
    >
      <Card className="overflow-hidden">
        <View className="h-[90px]" style={{ backgroundColor: tint }}>
          {item.cover_image && (
            <Photo
              uri={item.cover_image}
              recyclingKey={item.id}
              fallbackColor={tint}
              accessibilityLabel={item.title}
              scrim={{ top: 0.12, bottom: 0.38 }}
              style={{ width: '100%', height: '100%' }}
            />
          )}

          {item.has_audio && (
            <View
              className="absolute bottom-2 left-2 h-7 w-7 items-center justify-center rounded-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
              <Icon name="headphones" size={13} color="#fff" />
            </View>
          )}

          {onToggleSave && (
            <Pressable
              onPress={() => onToggleSave(item.id)}
              accessibilityRole="button"
              accessibilityLabel={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
              accessibilityState={{ selected: saved }}
              hitSlop={6}
              className="absolute right-2 top-2 h-[30px] w-[30px] items-center justify-center rounded-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.88)' }}
            >
              <Icon
                name="bookmark"
                size={14}
                color={saved ? tokens.green : '#857D78'}
                filled={saved}
              />
            </Pressable>
          )}
        </View>

        <View className="px-3 pb-3.5 pt-3">
          <View className="mb-1.5 flex-row items-center gap-1">
            <Icon name="book" size={13} color={tokens.text3} />
            <Text className="font-ui-md text-[11px] text-ink-3">
              Read · {formatDate(item.date)}
            </Text>
          </View>
          <Text numberOfLines={2} className="mb-1 font-ui-sb text-[13px] leading-[18px] text-ink-1">
            {item.title}
          </Text>
          {!!item.memory_verse_passage && (
            <Text numberOfLines={1} className="font-ui text-[11px] text-ink-3">
              {item.memory_verse_passage}
            </Text>
          )}
        </View>
      </Card>
    </Press>
  );
});

// ─── Loading ───────────────────────────────────────────────────────────────

function ShelfSkeleton() {
  return (
    <View className="pt-7">
      <View className="mb-3.5 px-5">
        <Skeleton width={140} height={18} />
      </View>
      <View className="flex-row gap-3 px-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={CARD_WIDTH} height={180} radius={16} />
        ))}
      </View>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Stable per-id tint pick, so a card's colour does not change between loads. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
