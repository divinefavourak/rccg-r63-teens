import { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMyRegistrations } from '../src/api/queries';
import type { EventRegistration } from '../src/api/types';
import { ROW_COLOURS } from '../src/components/EventPieces';
import { Icon } from '../src/components/Icon';
import { isLive, startOf, ticketStatus, whereLabel } from '../src/data/events';
import { useAuth } from '../src/state/auth';
import { DateBadge } from '../src/ui/cards';
import { Press } from '../src/ui/Press';
import { BackHeader, EmptyState, Skeleton } from '../src/ui/screen';
import { useTokens } from '../src/theme/ThemeProvider';
import { ELEVATION, type PopColour } from '../src/theme/tokens';

/**
 * My tickets: every event the teen holds a place for, soonest first. Reached
 * from Tribe's header and from Me.
 */
export default function TicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const mine = useMyRegistrations(!isGuest);

  const tickets = useMemo(
    () =>
      (mine.data ?? [])
        .filter(isLive)
        .sort((a, b) => when(a) - when(b)),
    [mine.data],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/tribe'));

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="My tickets" onBack={back} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
        refreshControl={
          isGuest ? undefined : (
            <RefreshControl refreshing={mine.isRefetching} onRefresh={mine.refetch} />
          )
        }
      >
        {isGuest ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="strolling"
              message="Your event tickets live here once you have an account."
              actionLabel="Sign up"
              onAction={() => router.push('/sign-up')}
            />
          </View>
        ) : mine.isPending ? (
          <>
            <Skeleton height={84} />
            <Skeleton height={84} />
          </>
        ) : mine.isError && !mine.data ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="sitting"
              message="We couldn’t load your tickets. Check your connection, then try again."
              actionLabel="Try again"
              onAction={() => mine.refetch()}
            />
          </View>
        ) : tickets.length === 0 ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="plant"
              message="No tickets yet. Register for an event and its ticket shows here."
              actionLabel="See events"
              onAction={() => router.replace('/tribe')}
            />
          </View>
        ) : (
          tickets.map((ticket, i) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              colour={ROW_COLOURS[i % ROW_COLOURS.length]}
              onOpen={() => router.push({ pathname: '/ticket/[id]', params: { id: ticket.id } })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** When the ticket's event starts; tickets with no event sort last. */
function when(ticket: EventRegistration): number {
  return ticket.event_detail ? startOf(ticket.event_detail).getTime() : Number.MAX_SAFE_INTEGER;
}

function TicketRow({
  ticket,
  colour,
  onOpen,
}: {
  ticket: EventRegistration;
  colour: PopColour;
  onOpen: () => void;
}) {
  const tokens = useTokens();
  const event = ticket.event_detail;
  const status = ticketStatus(ticket);
  const where = event ? whereLabel(event) : null;

  return (
    <Press
      onPress={onOpen}
      scaleTo={0.985}
      accessibilityLabel={`Ticket for ${event?.title ?? 'an event'}. ${status.label}`}
      className="w-full flex-row items-center gap-3 rounded-2xl bg-surf-raised p-3"
      style={ELEVATION.card}
    >
      {event && <DateBadge date={startOf(event)} colour={colour} />}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-ink-1">
          {event?.title ?? ticket.registration_id}
        </Text>
        {!!where && (
          <Text numberOfLines={1} className="font-ui text-[14px] leading-5 text-ink-2">
            {where}
          </Text>
        )}
        <Text
          numberOfLines={1}
          className={`font-ui-md text-[12px] leading-4 ${
            status.settled ? 'text-green' : 'text-feedback-caution'
          }`}
        >
          {status.label}
        </Text>
      </View>
      <View className="h-11 w-11 items-center justify-center rounded-full bg-surf-sunken">
        <Icon name="qr" size={20} color={tokens.text1} />
      </View>
    </Press>
  );
}
