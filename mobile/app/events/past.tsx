import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { EmptyState, ErrorState, ListSkeleton } from '../../src/components/states';
import { useTokens } from '../../src/theme/ThemeProvider';
import { useEvents } from '../../src/api/queries';
import type { EventListItem } from '../../src/api/types';
import { EventCard } from '../../src/components/EventCard';

/**
 * Past events.
 *
 * Split off Tribe so the tab opens on what a teen can still turn up to. Reached
 * from "Browse past events" at the foot of that list, and pushed rather than
 * presented modally so the Android back gesture behaves normally
 * (05-navigation.md).
 *
 * Shares the same `useEvents` query as Tribe, so opening this screen is a cache
 * read rather than a second fetch.
 */
export default function PastEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();

  const query = useEvents();

  // Most recent first: the event a teen just attended is the one they are most
  // likely looking for.
  const past = useMemo(() => {
    const now = Date.now();
    return (query.data ?? [])
      .filter((e) => e.status !== 'cancelled')
      .filter((e) => +new Date(e.end_datetime ?? e.start_datetime) < now)
      .sort((a, b) => +new Date(b.start_datetime) - +new Date(a.start_datetime));
  }, [query.data]);

  const openEvent = useCallback(
    (id: string) => router.push({ pathname: '/event/[id]', params: { id } }),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: EventListItem }) => <EventCard event={item} onOpen={openEvent} />,
    [openEvent],
  );

  const header = (
    <View className="px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
      <Pressable
        onPress={router.back}
        accessibilityRole="button"
        accessibilityLabel="Back to Tribe"
        hitSlop={8}
        className="mb-3 h-10 w-10 items-center justify-center rounded-md border border-line bg-surf-raised"
      >
        <Icon name="chevronLeft" size={20} color={tokens.text2} />
      </Pressable>
      <Text className="mb-1 font-ui-b text-[24px] text-ink-1">Past events</Text>
      <Text className="font-ui text-[14px] text-ink-3">
        Everything your tribe has already been to
      </Text>
    </View>
  );

  if (query.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        {header}
        <ListSkeleton rows={3} height={230} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View className="flex-1 bg-surf-base">
        {header}
        <ErrorState error={query.error} onRetry={query.refetch} />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-surf-base"
      data={past}
      keyExtractor={keyOfEvent}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          title="No past events"
          body="Once your tribe has been to something, it will be kept here."
        />
      }
      contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 16 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />}
      initialNumToRender={3}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

const keyOfEvent = (e: EventListItem) => e.id;
