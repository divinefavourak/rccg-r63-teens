import { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEvents } from '../../src/api/queries';
import type { EventListItem } from '../../src/api/types';
import { EventRow, ROW_COLOURS } from '../../src/components/EventPieces';
import { isPast, startOf } from '../../src/data/events';
import { BackHeader, EmptyState, Skeleton } from '../../src/ui/screen';

/**
 * Past events.
 *
 * Kept off the Tribe tab so that opens on what a teen can still turn up to.
 * Shares Tribe's `useEvents` query, so opening this is a cache read rather
 * than a second fetch.
 */
export default function PastEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useEvents();

  // Most recent first: the event a teen just went to is the one they are most
  // likely looking for.
  const past = useMemo(() => {
    const now = Date.now();
    return (query.data ?? [])
      .filter((e) => e.status !== 'cancelled' && isPast(e, now))
      .sort((a, b) => startOf(b).getTime() - startOf(a).getTime());
  }, [query.data]);

  const open = useCallback(
    (id: string) => router.push({ pathname: '/event/[id]', params: { id } }),
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: EventListItem; index: number }) => (
      <EventRow
        event={item}
        colour={ROW_COLOURS[index % ROW_COLOURS.length]}
        registered={false}
        onOpen={open}
      />
    ),
    [open],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/tribe'));

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Past events" onBack={back} />

      {query.isPending ? (
        <View className="gap-3 px-5 pt-2">
          <Skeleton height={84} />
          <Skeleton height={84} />
          <Skeleton height={84} />
        </View>
      ) : (
        <FlatList
          data={past}
          keyExtractor={keyOfEvent}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="flex-1 justify-center">
              <EmptyState
                drawing="sitting"
                message={
                  query.isError
                    ? 'We couldn’t load past events. Check your connection, then try again.'
                    : 'Nothing has happened yet. Events you could have gone to are kept here.'
                }
                actionLabel={query.isError ? 'Try again' : undefined}
                onAction={() => query.refetch()}
              />
            </View>
          }
          contentContainerStyle={{
            flexGrow: 1,
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />}
        />
      )}
    </View>
  );
}

const keyOfEvent = (e: EventListItem) => e.id;
