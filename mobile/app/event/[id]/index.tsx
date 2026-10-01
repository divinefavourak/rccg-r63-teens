import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../../src/components/Icon';
import { Photo } from '../../../src/components/Photo';
import { Button, Card, Pill, ProgressBar } from '../../../src/components/ui';
import { ErrorState, Skeleton } from '../../../src/components/states';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { useAuth } from '../../../src/state/auth';
import { useEvent, useMyRegistrations } from '../../../src/api/queries';
import { formatNaira } from '../../../src/components/EventCard';

/**
 * Event detail.
 *
 * A pushed screen rather than a modal so Android's back gesture is untouched —
 * 05-navigation.md calls hardware back "sacred".
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { isGuest } = useAuth();

  const query = useEvent(id);
  const myRegistrations = useMyRegistrations(!isGuest);
  const event = query.data;

  const onRegister = useCallback(() => {
    // Registering genuinely needs an account, so this is exactly the contextual
    // prompt 05-navigation.md permits — and the flow resumes here afterwards.
    if (isGuest) {
      router.push('/sign-in');
      return;
    }
    // The endpoint needs eleven attendee and guardian fields, so this opens the
    // form rather than posting from the button.
    router.push({ pathname: '/event/[id]/register', params: { id: id as string } });
  }, [isGuest, router, id]);

  if (query.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        <Skeleton height={220} radius={0} />
        <View className="gap-4 p-5">
          <Skeleton width={90} height={22} radius={999} />
          <Skeleton width="85%" height={28} />
          <Skeleton height={16} />
          <Skeleton height={16} />
          <Skeleton width="70%" height={16} />
        </View>
      </View>
    );
  }

  // A deep link can name an event that no longer exists. 05-navigation.md:
  // "never trap the user" — give them a working way back rather than a blank.
  if (query.isError || !event) {
    return (
      <View className="flex-1 items-center justify-center bg-surf-base px-8">
        <ErrorState error={query.error} onRetry={query.refetch} />
        <Button label="Back to Tribe" onPress={() => router.replace('/tribe')} height={48} />
      </View>
    );
  }

  const start = new Date(event.start_datetime);
  const location = [event.venue, event.address, event.city].filter(Boolean).join(', ');
  const price = event.is_free ? null : formatNaira(event.current_price ?? event.price);
  const spotsLeft = event.spots_remaining;
  const registered = (myRegistrations.data ?? []).some((r) => r.event === id);
  const closed = event.registration_status === 'closed' || event.registration_status === 'full';

  return (
    <View className="flex-1 bg-surf-base">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="h-[220px]" style={{ backgroundColor: '#2D6340' }}>
          {event.cover_image && (
            <Photo
              uri={event.cover_image}
              fallbackColor="#2D6340"
              accessibilityLabel={event.title}
              scrim={{ top: 0.4, bottom: 0.5 }}
              style={{ width: '100%', height: '100%' }}
            />
          )}

          <Pressable
            onPress={router.back}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="absolute left-4 h-10 w-10 items-center justify-center rounded-md"
            style={{ top: insets.top + 8, backgroundColor: 'rgba(0,0,0,0.35)' }}
          >
            <Icon name="chevronLeft" size={22} color="#fff" />
          </Pressable>

          <View
            className="absolute right-5 h-14 w-[52px] items-center justify-center rounded-md border border-line bg-surf-raised"
            style={{
              bottom: -24,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Text className="font-ui-b text-[11px] uppercase leading-[12px] text-green">
              {start.toLocaleDateString(undefined, { month: 'short' })}
            </Text>
            <Text className="font-ui-b text-[26px] leading-[28px] text-ink-1">
              {start.getDate()}
            </Text>
          </View>
        </View>

        <View className="px-5 pb-6 pt-9">
          <View className="mb-2 self-start">
            {registered ? (
              <Pill tone="green">
                <Icon name="check" size={11} color={tokens.green} />
                <Text className="font-ui-sb text-[11px] text-green">Registered</Text>
              </Pill>
            ) : closed ? (
              <Pill tone="neutral">
                <Text className="font-ui-sb text-[11px] text-ink-3">Registration closed</Text>
              </Pill>
            ) : (
              <Pill tone="amber">
                <Text className="font-ui-sb text-[11px] text-amber">Open</Text>
              </Pill>
            )}
          </View>

          <Text className="mb-5 font-ui-b text-[24px] leading-[30px] text-ink-1">{event.title}</Text>

          <View className="mb-6 gap-3.5">
            <DetailRow
              icon="calendar"
              label={start.toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              sub={start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            />
            {!!location && <DetailRow icon="mapPin" label={location} />}
            {event.is_virtual && <DetailRow icon="video" label="Online event" />}
            <DetailRow icon="ticket" label={price ? `Registration fee: ${price}` : 'Free entry'} />
          </View>

          <View className="mb-5 h-px bg-line" />

          {!!(event.description || event.short_description) && (
            <Text className="mb-8 font-ui text-[16px] leading-[27px] text-ink-2">
              {event.description ?? event.short_description}
            </Text>
          )}

          {event.max_attendees ? (
            <Card className="p-4">
              <View className="mb-2 flex-row justify-between">
                <Text className="font-ui-sb text-[13px] text-ink-2">Registrations</Text>
                <Text className="font-ui-b text-[13px] text-ink-1">
                  {event.registration_count} / {event.max_attendees}
                </Text>
              </View>
              <ProgressBar
                value={Math.min(1, event.registration_count / event.max_attendees)}
                track={tokens.border}
              />
              {spotsLeft !== null && (
                <Text className="mt-1.5 font-ui text-[12px] text-ink-3">
                  {spotsLeft > 0 ? `${spotsLeft} spots remaining` : 'This event is full'}
                </Text>
              )}
            </Card>
          ) : null}

        </View>
      </ScrollView>

      {/* Docked CTA — primary actions live in the bottom 60% of the screen
          (05-navigation.md, one-thumb reachability). */}
      <View
        className="border-t border-line bg-surf-raised px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {registered ? (
          <View className="h-14 flex-row items-center justify-center gap-2.5 rounded-md bg-green/10">
            <Icon name="check" size={20} color={tokens.green} />
            <Text className="font-ui-sb text-[16px] text-green">You're registered</Text>
          </View>
        ) : closed ? (
          <View className="h-14 items-center justify-center rounded-md bg-surf-sunken">
            <Text className="font-ui-sb text-[15px] text-ink-3">Registration has closed</Text>
          </View>
        ) : (
          <Button
            label={isGuest ? 'Sign in to register' : `Register — ${price ?? 'Free'}`}
            onPress={onRegister}
            height={56}
            icon={<Icon name="arrowRight" size={18} color="#fff" />}
          />
        )}
      </View>
    </View>
  );
}

function DetailRow({ icon, label, sub }: { icon: IconName; label: string; sub?: string }) {
  const tokens = useTokens();
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-sm bg-green/10">
        <Icon name={icon} size={18} color={tokens.green} />
      </View>
      <View className="flex-1">
        <Text className="font-ui-sb text-[14px] leading-[19px] text-ink-1">{label}</Text>
        {sub && <Text className="mt-0.5 font-ui text-[13px] text-ink-3">{sub}</Text>}
      </View>
    </View>
  );
}
