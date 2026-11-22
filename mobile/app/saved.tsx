import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  devotionalQuery,
  episodeQuery,
  useBookmarks,
  useDevotionals,
  useEpisodes,
  useFavorites,
  useHighlights,
  useSetHighlight,
  useToggleBookmark,
  useToggleFavorite,
} from '../src/api/queries';
import type { Bookmark, Favorite, Highlight } from '../src/api/types';
import { Icon } from '../src/components/Icon';
import { LibraryCard, useOpenLibraryItem } from '../src/components/LibraryPieces';
import { fromDevotional, fromEpisode, type LibraryItem } from '../src/data/library';
import { plainVerse } from '../src/data/scripture';
import { useAuth } from '../src/state/auth';
import { ChipRow } from '../src/ui/inputs';
import { Press } from '../src/ui/Press';
import { BackHeader, EmptyState, IconButton, Skeleton } from '../src/ui/screen';
import { HIGHLIGHT_SWATCH, POP } from '../src/theme/tokens';

type Filter = 'all' | 'verses' | 'highlights' | 'library';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'verses', label: 'Verses' },
  { value: 'highlights', label: 'Highlights' },
  { value: 'library', label: 'Library' },
] as const;

/**
 * Saved (Figma "Saved"): the verses a teen has kept or highlighted in the
 * Bible and the readings and talks kept from the Library, newest first.
 *
 * Three stores sit behind it. Verses are Bible bookmarks and highlights are
 * Bible highlights; both carry their own text. Library items are favourites, which hold only an id — so
 * each is matched against the lists the Library already has in memory, and
 * only fetched by itself when it is too old to be in them.
 */
export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const open = useOpenLibraryItem();
  const [filter, setFilter] = useState<Filter>('all');

  const bookmarks = useBookmarks(!isGuest);
  const highlights = useHighlights(!isGuest);
  const favorites = useFavorites(!isGuest);
  const devotionals = useDevotionals();
  const episodes = useEpisodes();
  const toggleBookmark = useToggleBookmark();
  const setHighlight = useSetHighlight();
  const toggleFavorite = useToggleFavorite();

  const wanted = useMemo(
    () =>
      (favorites.data ?? []).filter(
        (f) => f.content_type === 'devotional' || f.content_type === 'media_episode',
      ),
    [favorites.data],
  );

  const listed = useMemo(() => {
    const map = new Map<string, LibraryItem>();
    for (const d of devotionals.data ?? []) map.set(`devotional:${d.id}`, fromDevotional(d));
    for (const e of episodes.data ?? []) map.set(`media_episode:${e.id}`, fromEpisode(e));
    return map;
  }, [devotionals.data, episodes.data]);

  // Only once the lists have settled, or everything would be fetched twice.
  const listsSettled = !devotionals.isPending && !episodes.isPending;
  const missing = listsSettled ? wanted.filter((f) => !listed.has(keyOf(f))) : [];
  const fetched = useQueries({
    queries: missing.map((f) =>
      f.content_type === 'devotional' ? devotionalQuery(f.content_id) : episodeQuery(f.content_id),
    ),
  });

  // A handful of rows at most, so this is simply worked out each render.
  const extra = new Map<string, LibraryItem>();
  missing.forEach((f, i) => {
    const data = fetched[i]?.data;
    if (!data) return;
    extra.set(
      keyOf(f),
      f.content_type === 'devotional'
        ? fromDevotional(data as Parameters<typeof fromDevotional>[0])
        : fromEpisode(data as Parameters<typeof fromEpisode>[0]),
    );
  });
  const library = wanted
    .map((f) => ({ favorite: f, item: listed.get(keyOf(f)) ?? extra.get(keyOf(f)) }))
    .filter((row): row is { favorite: Favorite; item: LibraryItem } => !!row.item);

  const verses = useMemo(
    () => (bookmarks.data ?? []).filter((b) => !!b.verse_detail),
    [bookmarks.data],
  );

  const marked = useMemo(
    () => (highlights.data ?? []).filter((h) => !!h.verse_detail),
    [highlights.data],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/me'));

  const pending = !isGuest && (bookmarks.isPending || favorites.isPending || highlights.isPending);
  const failed =
    bookmarks.isError &&
    favorites.isError &&
    highlights.isError &&
    !bookmarks.data &&
    !favorites.data &&
    !highlights.data;
  const showVerses = filter === 'all' || filter === 'verses' ? verses : [];
  const showMarked = filter === 'all' || filter === 'highlights' ? marked : [];
  const showLibrary = filter === 'all' || filter === 'library' ? library : [];
  const nothingSaved = verses.length === 0 && marked.length === 0 && wanted.length === 0;
  const refetchAll = () => {
    bookmarks.refetch();
    highlights.refetch();
    favorites.refetch();
  };

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Saved" onBack={back} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 16,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
        refreshControl={
          isGuest ? undefined : (
            <RefreshControl
              refreshing={bookmarks.isRefetching || highlights.isRefetching || favorites.isRefetching}
              onRefresh={refetchAll}
            />
          )
        }
      >
        {isGuest ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="plant"
              message="Sign up to keep verses, readings and talks in one place."
              actionLabel="Sign up"
              onAction={() => router.push('/sign-up')}
            />
          </View>
        ) : pending ? (
          <>
            <Skeleton height={200} />
            <Skeleton height={112} />
            <Skeleton height={112} />
          </>
        ) : failed ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="sitting"
              message="We couldn’t load what you saved. Check your connection, then try again."
              actionLabel="Try again"
              onAction={refetchAll}
            />
          </View>
        ) : nothingSaved ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="plant"
              message="Nothing saved yet. Tap the bookmark on anything you want to keep."
              actionLabel="Browse the Library"
              onAction={() => router.replace('/library')}
            />
          </View>
        ) : (
          <>
            <ChipRow options={FILTERS} value={filter} onChange={setFilter} />

            {showVerses.map((mark) => (
              <SavedVerse
                key={mark.id}
                mark={mark}
                onOpen={() =>
                  router.push({ pathname: '/bible', params: { passage: mark.target_reference } })
                }
                onRemove={() =>
                  toggleBookmark.mutate({ verseId: mark.verse as string, bookmarkId: mark.id })
                }
              />
            ))}

            {showMarked.map((mark) => (
              <HighlightedVerse
                key={mark.id}
                mark={mark}
                onOpen={() => {
                  const reference = mark.verse_detail?.reference;
                  if (reference) router.push({ pathname: '/bible', params: { passage: reference } });
                }}
                onRemove={() => setHighlight.mutate({ verseId: mark.verse, color: null })}
              />
            ))}

            {showLibrary.map(({ favorite, item }) => (
              <LibraryCard
                key={favorite.id}
                item={item}
                onOpen={open}
                trailing={
                  <IconButton
                    icon="bookmark"
                    filled
                    label={`Remove ${item.title} from saved`}
                    onPress={() =>
                      toggleFavorite.mutate({
                        contentType: favorite.content_type,
                        contentId: favorite.content_id,
                        saved: true,
                      })
                    }
                  />
                }
              />
            ))}

            {showVerses.length === 0 && showMarked.length === 0 && showLibrary.length === 0 && (
              <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">
                {filter === 'verses'
                  ? 'No verses saved yet. Tap a verse in the Bible, then Save.'
                  : filter === 'highlights'
                    ? 'No highlights yet. Tap a verse in the Bible, then pick a colour.'
                    : 'Nothing saved from the Library yet.'}
              </Text>
            )}

            <Text className="text-center font-ui-md text-[12px] leading-4 text-ink-3">
              {filter === 'highlights' || (showMarked.length > 0 && showVerses.length === 0 && showLibrary.length === 0)
                ? 'Tap × to take a highlight off.'
                : showMarked.length > 0
                  ? 'Tap a bookmark, or × on a highlight, to remove it from here.'
                  : 'Tap a bookmark to remove it from here.'}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const keyOf = (f: Favorite) => `${f.content_type}:${f.content_id}`;

/** A kept verse, in the reader's serif on violet. Tapping it opens the Bible there. */
function SavedVerse({
  mark,
  onOpen,
  onRemove,
}: {
  mark: Bookmark;
  onOpen: () => void;
  onRemove: () => void;
}) {
  if (!mark.verse_detail) return null;
  // The red-letter marks are for the reader; here the words are quoted plain.
  const verse = { ...mark.verse_detail, text: plainVerse(mark.verse_detail.text) };
  const reference = [verse.reference, verse.translation_code].filter(Boolean).join(' · ');

  return (
    <View className="w-full gap-3 overflow-hidden rounded-2xl bg-pop-violet px-5 pb-3 pt-5">
      <View pointerEvents="none" style={{ position: 'absolute', right: -16, top: -28, opacity: 0.14 }}>
        <Icon name="book" size={120} color={POP.on} />
      </View>
      <Press
        onPress={onOpen}
        scaleTo={0.985}
        accessibilityLabel={`${verse.reference}. ${verse.text}. Opens in the Bible`}
        className="gap-3"
      >
        <Text className="font-ui-md text-[12px] uppercase leading-4 text-pop-on">Saved verse</Text>
        <Text className="font-read-md text-[22px] leading-8 text-pop-on">“{verse.text}”</Text>
      </Press>
      <View className="flex-row items-center gap-2">
        <Text numberOfLines={1} className="flex-1 font-ui-sb text-[14px] leading-5 text-pop-on">
          {reference}
        </Text>
        <VerseAction
          icon="shareUp"
          label={`Share ${verse.reference}`}
          onPress={() => {
            Share.share({ message: `“${verse.text}”\n${reference}` }).catch(() => {});
          }}
        />
        <VerseAction
          icon="bookmark"
          label={`Remove ${verse.reference} from saved`}
          filled
          onPress={onRemove}
        />
      </View>
    </View>
  );
}

/**
 * A highlighted verse, on a card of its own highlight colour. Tapping it opens
 * the Bible there; × takes the highlight off.
 */
function HighlightedVerse({
  mark,
  onOpen,
  onRemove,
}: {
  mark: Highlight;
  onOpen: () => void;
  onRemove: () => void;
}) {
  if (!mark.verse_detail) return null;
  const verse = { ...mark.verse_detail, text: plainVerse(mark.verse_detail.text) };
  const reference = [verse.reference, verse.translation_code].filter(Boolean).join(' · ');

  return (
    <View
      className="w-full gap-3 overflow-hidden rounded-2xl px-5 pb-3 pt-5"
      style={{ backgroundColor: HIGHLIGHT_SWATCH[mark.color] }}
    >
      <Press
        onPress={onOpen}
        scaleTo={0.985}
        accessibilityLabel={`${verse.reference}, highlighted ${mark.color}. ${verse.text}. Opens in the Bible`}
        className="gap-3"
      >
        <Text className="font-ui-md text-[12px] uppercase leading-4 text-pop-on">Highlight</Text>
        <Text className="font-read-md text-[20px] leading-8 text-pop-on">“{verse.text}”</Text>
      </Press>
      <View className="flex-row items-center gap-2">
        <Text numberOfLines={1} className="flex-1 font-ui-sb text-[14px] leading-5 text-pop-on">
          {reference}
        </Text>
        <VerseAction
          icon="shareUp"
          label={`Share ${verse.reference}`}
          onPress={() => {
            Share.share({ message: `“${verse.text}”\n${reference}` }).catch(() => {});
          }}
        />
        <VerseAction icon="close" label={`Remove the highlight on ${verse.reference}`} onPress={onRemove} />
      </View>
    </View>
  );
}

/** A plain 44px icon on the violet card; always dark, as the card never changes. */
function VerseAction({
  icon,
  label,
  filled,
  onPress,
}: {
  icon: 'shareUp' | 'bookmark' | 'close';
  label: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} accessibilityLabel={label} className="h-11 w-11 items-center justify-center">
      <Icon name={icon} size={24} color={POP.on} filled={filled} />
    </Press>
  );
}
