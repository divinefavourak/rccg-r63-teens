import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { BackHandler, FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useArticles, useDevotionals, useEpisodes } from '../../src/api/queries';
import {
  LibraryCard,
  MINI_PLAYER_HEIGHT,
  MiniPlayer,
  ShelfTile,
  TILE_WIDTH,
  useOpenLibraryItem,
} from '../../src/components/LibraryPieces';
import { useNavClearance } from '../../src/components/useNavClearance';
import {
  actionFor,
  fromArticle,
  fromDevotional,
  fromEpisode,
  type LibraryItem,
  type LibraryKind,
} from '../../src/data/library';
import { useAuth } from '../../src/state/auth';
import { usePlayer } from '../../src/state/player';
import { HeroCard } from '../../src/ui/cards';
import { ChipRow, SearchField } from '../../src/ui/inputs';
import {
  EmptyState,
  GuestBanner,
  HEADER_GAP,
  IconButton,
  OfflineBar,
  SectionTitle,
  Skeleton,
  TabHeader,
} from '../../src/ui/screen';

type Filter = 'all' | LibraryKind;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'read', label: 'Read' },
  { value: 'watch', label: 'Watch' },
  { value: 'listen', label: 'Listen' },
] as const;

const FILTER_NAME: Record<Filter, string> = {
  all: 'All',
  read: 'Read',
  watch: 'Watch',
  listen: 'Listen',
};

/** How many readings the "All" view shows before "See all". */
const READ_PREVIEW = 4;

/**
 * Library — things to read, watch and listen to.
 *
 * Three endpoints feed it (daily readings, articles, media episodes), turned
 * into one kind of item in `data/library.ts`. A shelf with nothing in it is
 * simply not drawn, so the screen is honest about what has been published.
 *
 * Search lives here rather than as a destination of its own
 * (05-navigation.md): the header turns into a search field and the same
 * filter chips narrow the results.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const { episode: playing } = usePlayer();
  const navClearance = useNavClearance(24);
  const open = useOpenLibraryItem();

  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState('');
  // The field updates on every key; the requests wait for typing to settle.
  const deferred = useDeferredValue(text.trim());
  const query = searching && deferred.length >= 2 ? deferred : undefined;

  const devotionals = useDevotionals(query);
  const articles = useArticles(query);
  const episodes = useEpisodes(query);
  const sources = [devotionals, articles, episodes];

  const items = useMemo(() => {
    const all: LibraryItem[] = [
      ...(episodes.data ?? []).map(fromEpisode),
      ...(articles.data ?? []).map(fromArticle),
      ...(devotionals.data ?? []).map(fromDevotional),
    ];
    return all.sort((a, b) => b.when - a.when);
  }, [devotionals.data, articles.data, episodes.data]);

  const byKind = useMemo(
    () => ({
      read: items.filter((i) => i.kind === 'read'),
      watch: items.filter((i) => i.kind === 'watch'),
      listen: items.filter((i) => i.kind === 'listen'),
    }),
    [items],
  );

  // The editor's pick if there is one, otherwise simply the newest thing.
  const featured = useMemo(() => items.find((i) => i.featured) ?? items[0] ?? null, [items]);

  const closeSearch = useCallback(() => {
    setSearching(false);
    setText('');
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Hardware back leaves search before it leaves the tab.
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!searching) return false;
        closeSearch();
        return true;
      });
      return () => sub.remove();
    }, [searching, closeSearch]),
  );

  const refetch = () => sources.forEach((s) => s.refetch());

  const pending = sources.every((s) => s.isPending);
  const failed = sources.every((s) => s.isError) && items.length === 0;
  // Something would not refresh while there is still something to show.
  const offline = sources.some((s) => s.isError) && items.length > 0;
  const shown = filter === 'all' ? items : byKind[filter];

  const bottom = navClearance + (playing ? MINI_PLAYER_HEIGHT + 8 : 0);

  return (
    <View className="flex-1 bg-surf-base">
      {searching ? (
        <View
          className="flex-row items-center gap-2 pb-2 pl-4 pr-5"
          style={{ paddingTop: insets.top + HEADER_GAP }}
        >
          <IconButton icon="chevronLeft" label="Close search" onPress={closeSearch} />
          <SearchField
            label="Search the Library"
            value={text}
            onChange={setText}
            autoFocus
            className="h-12 flex-1"
          />
        </View>
      ) : (
        <TabHeader title="Library">
          <IconButton icon="search" label="Search the Library" onPress={() => setSearching(true)} />
          <IconButton icon="bookmark" label="Saved" onPress={() => router.push('/saved')} />
        </TabHeader>
      )}

      {offline && <OfflineBar />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          flexGrow: 1,
          gap: 20,
          paddingHorizontal: 20,
          // Room for the star that breaks out of the featured card.
          paddingTop: searching ? 8 : 24,
          paddingBottom: bottom,
        }}
        refreshControl={
          <RefreshControl refreshing={sources.some((s) => s.isRefetching)} onRefresh={refetch} />
        }
      >
        {searching ? (
          <>
            <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
            {!query ? (
              <Text className="font-ui text-[16px] leading-6 text-ink-2">
                Search readings, articles, talks and videos.
              </Text>
            ) : pending ? (
              <ListSkeleton />
            ) : shown.length === 0 ? (
              <EmptyState
                drawing="strolling"
                message={
                  filter === 'all'
                    ? `Nothing for “${query}” yet. Try a shorter word.`
                    : `Nothing for “${query}” in ${FILTER_NAME[filter]} yet. Try All, or a shorter word.`
                }
                actionLabel={filter === 'all' ? undefined : 'Search in All'}
                onAction={() => setFilter('all')}
              />
            ) : (
              shown.map((item) => <LibraryCard key={item.key} item={item} onOpen={open} />)
            )}
          </>
        ) : pending ? (
          <Loading />
        ) : failed ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="sitting"
              message="We couldn’t load the Library. Check your connection, then try again."
              actionLabel="Try again"
              onAction={refetch}
            />
          </View>
        ) : items.length === 0 ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="reading"
              message="Nothing has been published here yet. Today’s reading is on the Today tab."
              actionLabel="Go to Today"
              onAction={() => router.push('/')}
            />
          </View>
        ) : (
          <>
            {isGuest && (
              <GuestBanner
                title="Keep what you love"
                body="Sign up to save readings and talks for later."
                onSignUp={() => router.push('/sign-up')}
              />
            )}

            {featured && (
              <HeroCard
                colour="violet"
                eyebrow={featured.eyebrow}
                title={featured.title}
                detail={featured.detail ?? undefined}
                actionLabel={actionFor(featured.kind)}
                play={featured.kind !== 'read'}
                onPress={() => open(featured)}
                drawing="selfie"
                drawingWidth={116}
                object="star"
              />
            )}

            <ChipRow options={FILTERS} value={filter} onChange={setFilter} />

            {filter === 'all' ? (
              <>
                <Shelf
                  title="Listen"
                  items={byKind.listen}
                  onOpen={open}
                  onSeeAll={() => setFilter('listen')}
                />
                <Shelf
                  title="Watch"
                  items={byKind.watch}
                  onOpen={open}
                  onSeeAll={() => setFilter('watch')}
                />
                {byKind.read.length > 0 && (
                  <>
                    <SectionTitle
                      actionLabel={byKind.read.length > READ_PREVIEW ? 'See all' : undefined}
                      onAction={() => setFilter('read')}
                    >
                      Read
                    </SectionTitle>
                    {byKind.read.slice(0, READ_PREVIEW).map((item) => (
                      <LibraryCard key={item.key} item={item} onOpen={open} />
                    ))}
                  </>
                )}
              </>
            ) : shown.length === 0 ? (
              <EmptyState
                drawing="strolling"
                message={`Nothing to ${filter === 'listen' ? 'listen to' : filter} yet. New things show up here as they are published.`}
                actionLabel="Show everything"
                onAction={() => setFilter('all')}
              />
            ) : (
              shown.map((item) => <LibraryCard key={item.key} item={item} onOpen={open} />)
            )}
          </>
        )}
      </ScrollView>

      {/* Docked above the nav, and only once something has been started. */}
      {playing && (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-4"
          style={{ bottom: navClearance - 24 }}
        >
          <MiniPlayer />
        </View>
      )}
    </View>
  );
}

// ─── Shelves ───────────────────────────────────────────────────────────────

const TILE_GAP = 12;
const keyOfItem = (item: LibraryItem) => item.key;

/** A sideways row of covers. Draws nothing when there is nothing to show. */
function Shelf({
  title,
  items,
  onOpen,
  onSeeAll,
}: {
  title: string;
  items: LibraryItem[];
  onOpen: (item: LibraryItem) => void;
  onSeeAll: () => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: LibraryItem }) => <ShelfTile item={item} onOpen={onOpen} />,
    [onOpen],
  );
  if (items.length === 0) return null;

  return (
    <>
      <SectionTitle actionLabel={items.length > 2 ? 'See all' : undefined} onAction={onSeeAll}>
        {title}
      </SectionTitle>
      {/* A FlatList rather than a row of children: only the covers on screen
          mount, so their images are not fetched until they are scrolled to. */}
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyOfItem}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        // Bleeds to the screen edge, so a cut-off cover shows there is more.
        style={{ marginHorizontal: -20, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: TILE_GAP }}
        initialNumToRender={3}
        windowSize={5}
      />
    </>
  );
}

// ─── Loading ───────────────────────────────────────────────────────────────

/** Blocks in the shape of what is coming, so nothing jumps when it lands. */
function Loading() {
  return (
    <>
      <Skeleton height={212} radius={28} />
      <View className="flex-row gap-2">
        {[56, 72, 80, 76].map((w, i) => (
          <Skeleton key={i} width={w} height={40} radius={999} />
        ))}
      </View>
      <Skeleton width={96} height={24} radius={8} />
      <View className="flex-row" style={{ gap: TILE_GAP }}>
        <Skeleton width={TILE_WIDTH} height={TILE_WIDTH} />
        <Skeleton width={TILE_WIDTH} height={TILE_WIDTH} />
      </View>
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      <Skeleton height={112} />
      <Skeleton height={112} />
      <Skeleton height={112} />
    </>
  );
}
