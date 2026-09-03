import { memo, useCallback } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { Photo } from '../../src/components/Photo';
import { Card, Pill, Press, ProgressBar } from '../../src/components/ui';
import { useTokens } from '../../src/theme/ThemeProvider';
import { EVENTS, type TribeEvent } from '../../src/data/content';

/**
 * Tribe — upcoming events and meetups.
 *
 * This is the one teen surface where real ministry photography appears
 * (09-design-principles.md); Today and Bible stay illustrated to protect calm.
 */
export default function TribeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openEvent = useCallback(
    (id: string) => router.push({ pathname: '/event/[id]', params: { id } }),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: TribeEvent }) => <EventCard event={item} onOpen={openEvent} />,
    [openEvent],
  );

  return (
    <FlatList
      className="flex-1 bg-surf-base"
      data={EVENTS}
      keyExtractor={keyOfEvent}
      renderItem={renderItem}
      ListHeaderComponent={<Header topInset={insets.top} />}
      ListFooterComponent={<PastEventsTeaser />}
      contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
      showsVerticalScrollIndicator={false}
      // Event cards each carry a banner photo; keeping the mounted window
      // small stops four full-width images decoding at once on first paint.
      initialNumToRender={3}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

const keyOfEvent = (e: TribeEvent) => e.id;

function Header({ topInset }: { topInset: number }) {
  return (
    <View>
      <View className="px-5 pb-4" style={{ paddingTop: topInset + 16 }}>
        <Text className="mb-1 font-ui-b text-[24px] text-ink-1">Tribe</Text>
        <Text className="font-ui text-[14px] text-ink-3">Upcoming events and meetups</Text>
      </View>

      <View className="flex-row items-center gap-3 px-5 pb-4">
        <View className="h-px flex-1 bg-line" />
        <Text className="font-ui-sb text-[12px] uppercase tracking-[1px] text-ink-3">
          September 2026
        </Text>
        <View className="h-px flex-1 bg-line" />
      </View>
    </View>
  );
}

// ─── Event card ────────────────────────────────────────────────────────────

/**
 * Memoised: without it, every card re-renders whenever the list scrolls, and
 * each one owns a decoded banner image.
 */
const EventCard = memo(function EventCard({
  event,
  onOpen,
}: {
  event: TribeEvent;
  onOpen: (id: string) => void;
}) {
  const tokens = useTokens();
  const spotsLeft = event.capacity - event.registeredCount;
  const fillRatio = event.registeredCount / event.capacity;
  const nearlyFull = spotsLeft < 50;

  return (
    <Press
      onPress={() => onOpen(event.id)}
      accessibilityLabel={`${event.title}, ${event.dateShort}, ${event.location}`}
      className="mx-5"
      scaleTo={0.985}
    >
      <Card className="overflow-hidden">
        <View className="h-[120px]">
          <Photo
            uri={event.photoUrl}
            recyclingKey={event.id}
            fallbackColor={event.photoColor}
            scrim={{ top: 0.28, bottom: 0.32 }}
            style={{ width: '100%', height: '100%' }}
          />

          <View
            className="absolute left-3 top-3 rounded-full px-2.5 py-1"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          >
            <Text className="font-ui-sb text-[11px] tracking-wide text-white">{event.category}</Text>
          </View>

          {event.price && (
            <View
              className="absolute right-3 top-3 rounded-full px-2.5 py-1"
              style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            >
              <Text className="font-ui-b text-[11px] text-white">{event.price}</Text>
            </View>
          )}

          {/* Date block — the event card's fixed anatomy (10-design-system.md). */}
          <View
            className="absolute bottom-3 right-3 h-12 w-11 items-center justify-center rounded-sm bg-white"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Text className="font-ui-b text-[10px] uppercase leading-[11px] text-green">
              {event.month}
            </Text>
            <Text className="font-ui-b text-[22px] leading-[24px]" style={{ color: '#1C1916' }}>
              {event.day}
            </Text>
          </View>
        </View>

        <View className="px-4 pb-4 pt-3.5">
          <View className="mb-2 flex-row items-start justify-between gap-2.5">
            <Text className="flex-1 font-ui-b text-[16px] leading-[21px] text-ink-1">
              {event.title}
            </Text>
            <StatusBadge registered={event.registered} />
          </View>

          <View className="gap-1.5">
            <View className="flex-row items-center gap-2">
              <Icon name="calendar" size={14} color={tokens.text3} />
              <Text className="font-ui-md text-[13px] text-ink-2">
                {event.dateShort} · {event.time}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Icon name="mapPin" size={14} color={tokens.text3} />
              <Text numberOfLines={1} className="flex-1 font-ui text-[13px] text-ink-2">
                {event.location}
              </Text>
            </View>
          </View>

          {nearlyFull && (
            <View className="mt-3">
              <Text className="mb-1.5 font-ui text-[11px] text-ink-3">
                {spotsLeft} spots remaining
              </Text>
              <ProgressBar
                value={fillRatio}
                height={4}
                track={tokens.border}
                // Amber signals "filling up" — a celebration/attention colour,
                // never error red, which the design reserves for system failure.
                fill={fillRatio > 0.8 ? tokens.amberBright : tokens.green}
              />
            </View>
          )}
        </View>
      </Card>
    </Press>
  );
});

function StatusBadge({ registered }: { registered: boolean }) {
  const tokens = useTokens();
  if (registered) {
    return (
      <Pill tone="green">
        <Icon name="check" size={11} color={tokens.green} />
        <Text className="font-ui-sb text-[11px] text-green">Registered</Text>
      </Pill>
    );
  }
  return (
    <Pill tone="amber">
      <Text className="font-ui-sb text-[11px] text-amber">Open</Text>
    </Pill>
  );
}

function PastEventsTeaser() {
  return (
    <View className="items-center px-5 pt-6">
      <Text className="mb-2.5 font-ui text-[13px] text-ink-3">Looking for a past event?</Text>
      <Press
        accessibilityLabel="Browse past events"
        className="h-11 justify-center rounded-md border-[1.5px] border-line px-5"
      >
        <Text className="font-ui-sb text-[14px] text-ink-2">Browse past events</Text>
      </Press>
    </View>
  );
}
