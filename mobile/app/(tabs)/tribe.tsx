import { memo, useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Press } from '../../src/components/ui';
import { EventCard } from '../../src/components/EventCard';
import { EmptyState, ErrorState, ListSkeleton } from '../../src/components/states';
import { useNavClearance } from '../../src/components/useNavClearance';
import { useEvents } from '../../src/api/queries';
import type { EventListItem } from '../../src/api/types';

/**
 * Tribe — upcoming events and meetups.
 *
 * This is the one teen surface where real ministry photography appears
 * (09-design-principles.md); Today and Bible stay illustrated to protect calm.
 *
 * 04-information-architecture.md scopes Tribe to "events + community"; the
 * community half (friends, prayer, groups) joins this tab later.
 */
export default function TribeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navClearance = useNavClearance(24);

  const query = useEvents();

  // Upcoming only, newest first. Past events move to their own screen behind
  // "Browse past events" — the first thing a teen sees should be what they can
  // still turn up to, not last December's campout.
  const { upcoming, pastCount } = useMemo(() => {
    const all = (query.data ?? []).filter((e) => e.status !== 'cancelled');
    const now = Date.now();

    // `end_datetime` where the event has one: a camp running until Sunday is
    // still current on Saturday.
    const isPast = (e: EventListItem) =>
      +new Date(e.end_datetime ?? e.start_datetime) < now;

    return {
      upcoming: all
        .filter((e) => !isPast(e))
        .sort((a, b) => +new Date(b.start_datetime) - +new Date(a.start_datetime)),
      pastCount: all.filter(isPast).length,
    };
  }, [query.data]);

  const openEvent = useCallback(
    (id: string) => router.push({ pathname: '/event/[id]', params: { id } }),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: EventListItem }) => <EventCard event={item} onOpen={openEvent} />,
    [openEvent],
  );

  if (query.isPending) {
    return (
      <View className="flex-1 bg-surf-base" style={{ paddingTop: insets.top + 16 }}>
        <Header monthLabel={monthLabel(new Date())} />
        <ListSkeleton rows={3} height={230} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View className="flex-1 justify-center bg-surf-base">
        <ErrorState error={query.error} onRetry={query.refetch} />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-surf-base"
      data={upcoming}
      keyExtractor={keyOfEvent}
      renderItem={renderItem}
      ListHeaderComponent={
        <View style={{ paddingTop: insets.top + 16 }}>
          <Header monthLabel={monthLabel(new Date())} />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="Nothing coming up"
          body="When your tribe plans something new, it will show up here."
        />
      }
      ListFooterComponent={<PastEventsTeaser count={pastCount} />}
      contentContainerStyle={{ paddingBottom: navClearance, gap: 16 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />
      }
      // Event cards each carry a banner photo; keeping the mounted window small
      // stops several full-width images decoding at once on first paint.
      initialNumToRender={3}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

const keyOfEvent = (e: EventListItem) => e.id;

function Header({ monthLabel: label }: { monthLabel: string }) {
  return (
    <View>
      <View className="px-5 pb-4">
        <Text className="mb-1 font-ui-b text-[24px] text-ink-1">Tribe</Text>
        <Text className="font-ui text-[14px] text-ink-3">Upcoming events and meetups</Text>
      </View>

      <View className="flex-row items-center gap-3 px-5 pb-4">
        <View className="h-px flex-1 bg-line" />
        <Text className="font-ui-sb text-[12px] uppercase tracking-[1px] text-ink-3">{label}</Text>
        <View className="h-px flex-1 bg-line" />
      </View>
    </View>
  );
}

function PastEventsTeaser({ count }: { count: number }) {
  const router = useRouter();
  if (count === 0) return null;

  return (
    <View className="items-center px-5 pt-6">
      <Text className="mb-2.5 font-ui text-[13px] text-ink-3">Looking for a past event?</Text>
      <Press
        onPress={() => router.push('/events/past')}
        accessibilityLabel={`Browse ${count} past events`}
        className="h-11 justify-center rounded-md border-[1.5px] border-line px-5"
      >
        <Text className="font-ui-sb text-[14px] text-ink-2">
          Browse past events ({count})
        </Text>
      </Press>
    </View>
  );
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
