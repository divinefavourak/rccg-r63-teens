import { useCallback } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../../src/api/client';
import { useEvent, useMyRegistrations } from '../../../src/api/queries';
import { EventPhoto } from '../../../src/components/EventPieces';
import {
  closedLabel,
  isClosed,
  isLive,
  priceLabel,
  startOf,
  whenLabel,
  whereLabel,
} from '../../../src/data/events';
import { useAuth } from '../../../src/state/auth';
import { Object3D } from '../../../src/ui/art';
import { Button } from '../../../src/ui/Button';
import { DateBadge, FactChip, PopCard, PopEyebrow } from '../../../src/ui/cards';
import { BackHeader, EmptyState, GuestBanner, Skeleton } from '../../../src/ui/screen';
import { ELEVATION } from '../../../src/theme/tokens';

/**
 * Event detail.
 *
 * Anyone can read it; registering is the one thing here that needs an account,
 * so that is where a guest is asked to sign up (05-navigation.md). A pushed
 * screen rather than a modal, so Android's back gesture is left alone.
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();

  const query = useEvent(id);
  const mine = useMyRegistrations(!isGuest);
  const event = query.data;
  const registration = (mine.data ?? []).find((r) => r.event === id && isLive(r));

  const back = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/tribe')),
    [router],
  );

  const onShare = useCallback(() => {
    if (!event) return;
    const lines = [event.title, whenLabel(event), whereLabel(event)].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  }, [event]);

  if (query.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Event" onBack={back} />
        <View className="gap-4 px-5 pt-2">
          <Skeleton height={208} radius={28} />
          <Skeleton width={120} height={24} radius={8} />
          <Skeleton width="80%" height={40} radius={8} />
          <Skeleton width={200} height={40} radius={999} />
          <Skeleton width={180} height={40} radius={999} />
          <Skeleton height={100} />
        </View>
      </View>
    );
  }

  // A link can name an event that is gone. Never a dead end: say so, and
  // offer the way back (05-navigation.md).
  if (!event) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Event" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message={
              gone
                ? 'That event is not here any more. See what else is coming up.'
                : 'We couldn’t load this event. Check your connection, then try again.'
            }
            actionLabel={gone ? 'Back to Tribe' : 'Try again'}
            onAction={() => (gone ? router.replace('/tribe') : query.refetch())}
          />
        </View>
      </View>
    );
  }

  const where = whereLabel(event);
  const price = priceLabel(event);
  const taken = event.registration_count;
  const places = event.max_attendees;
  const bring = (event.what_to_bring ?? []).filter(Boolean);
  const about = event.description || event.short_description;

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader
        title="Event"
        onBack={back}
        action={{ icon: 'shareUp', label: 'Share this event', onPress: onShare }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        {isGuest && (
          <GuestBanner
            title="Want to come?"
            body="Sign up to register and get your ticket."
            onSignUp={() => router.push('/sign-up')}
          />
        )}

        <View>
          <EventPhoto event={event} style={{ width: '100%', height: 208, borderRadius: 28 }} />
          <View style={{ position: 'absolute', left: 16, top: 16 }}>
            <DateBadge date={startOf(event)} />
          </View>
        </View>

        {!!event.organizer_name && (
          <View className="self-start rounded-sm bg-surf-sunken px-2 py-1">
            <Text className="font-ui-md text-[12px] leading-4 text-ink-2">{event.organizer_name}</Text>
          </View>
        )}

        <Text
          accessibilityRole="header"
          className="font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
        >
          {event.title}
        </Text>

        <View className="flex-row flex-wrap gap-2">
          <FactChip icon="calendar" colour="amber">
            {whenLabel(event)}
          </FactChip>
          {!!where && (
            <FactChip icon="mapPin" colour="sky">
              {where}
            </FactChip>
          )}
          <FactChip icon="ticket" colour="lime">
            {price}
          </FactChip>
        </View>

        {(taken > 0 || !!places) && (
          <View className="w-full gap-3 rounded-2xl bg-surf-raised p-4" style={ELEVATION.card}>
            <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">
              {places ? `${taken} of ${places} places taken` : `${taken} going`}
            </Text>
            {!!places && (
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: places, now: Math.min(taken, places) }}
                className="h-2 w-full overflow-hidden rounded-full bg-surf-sunken"
              >
                <View
                  className="h-2 rounded-full bg-pop-green"
                  style={{ width: `${Math.min(1, taken / places) * 100}%` }}
                />
              </View>
            )}
          </View>
        )}

        {!!about && <Text className="font-ui text-[16px] leading-6 text-ink-2">{about}</Text>}

        {bring.length > 0 && (
          <PopCard colour="violet" className="w-full gap-1">
            <PopEyebrow>What to bring</PopEyebrow>
            <Text className="pr-20 font-ui-sb text-[16px] leading-6 text-pop-on">
              {bring.join(', ')}
            </Text>
            <View pointerEvents="none" style={{ position: 'absolute', right: 12, top: 4 }}>
              <Object3D name="gift" size={72} />
            </View>
          </PopCard>
        )}
      </ScrollView>

      {/* The one action, docked where a thumb reaches it. */}
      <View className="px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {registration ? (
          <Button
            label="View your ticket"
            onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: registration.id } })}
            className="w-full"
          />
        ) : isClosed(event) ? (
          <Button label={closedLabel(event)} disabled className="w-full" />
        ) : isGuest ? (
          <Button label="Sign up to register" onPress={() => router.push('/sign-up')} className="w-full" />
        ) : (
          <Button
            label={`Register · ${price}`}
            onPress={() => router.push({ pathname: '/event/[id]/register', params: { id } })}
            className="w-full"
          />
        )}
      </View>
    </View>
  );
}
