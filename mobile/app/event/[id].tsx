import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../src/components/Icon';
import { Photo } from '../../src/components/Photo';
import { Button, Card, Pill, ProgressBar } from '../../src/components/ui';
import { useTokens } from '../../src/theme/ThemeProvider';
import { EVENTS } from '../../src/data/content';

/**
 * Event detail.
 *
 * A pushed screen rather than a modal so Android's back gesture is untouched —
 * 05-navigation.md calls hardware back "sacred". Registration is the one place
 * the design intercepts anything, and only between initiated and resolved.
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();

  const event = useMemo(() => EVENTS.find((e) => e.id === id), [id]);

  const [registered, setRegistered] = useState(event?.registered ?? false);
  const [loading, setLoading] = useState(false);

  const register = useCallback(() => {
    setLoading(true);
    // Stands in for the POST to /api/v1/events/{id}/register/.
    const t = setTimeout(() => {
      setLoading(false);
      setRegistered(true);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // A deep link can name an event that no longer exists. 05-navigation.md:
  // "never trap the user" — give them a working way back rather than a blank.
  if (!event) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-surf-base px-8">
        <Text className="text-[28px]">🌱</Text>
        <Text className="font-ui-b text-[16px] text-ink-1">We couldn't find that event</Text>
        <Text className="text-center font-ui text-[13px] leading-5 text-ink-3">
          It may have finished, or the link may be out of date.
        </Text>
        <Button label="Back to Tribe" onPress={() => router.replace('/tribe')} height={48} />
      </View>
    );
  }

  const spotsLeft = event.capacity - event.registeredCount;

  return (
    <View className="flex-1 bg-surf-base">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="h-[220px]">
          <Photo
            uri={event.photoUrl}
            fallbackColor={event.photoColor}
            accessibilityLabel={event.title}
            scrim={{ top: 0.4, bottom: 0.5 }}
            style={{ width: '100%', height: '100%' }}
          />

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
              {event.month}
            </Text>
            <Text className="font-ui-b text-[26px] leading-[28px] text-ink-1">{event.day}</Text>
          </View>
        </View>

        <View className="px-5 pb-6 pt-9">
          <View className="mb-2 self-start">
            {registered ? (
              <Pill tone="green">
                <Icon name="check" size={11} color={tokens.green} />
                <Text className="font-ui-sb text-[11px] text-green">Registered</Text>
              </Pill>
            ) : (
              <Pill tone="amber">
                <Text className="font-ui-sb text-[11px] text-amber">Open</Text>
              </Pill>
            )}
          </View>

          <Text className="mb-5 font-ui-b text-[24px] leading-[30px] text-ink-1">{event.title}</Text>

          <View className="mb-6 gap-3.5">
            <DetailRow icon="calendar" label={event.date} sub={event.time} />
            <DetailRow icon="mapPin" label={event.location} />
            <DetailRow
              icon="ticket"
              label={event.price ? `Registration fee: ${event.price}` : 'Free entry'}
            />
          </View>

          <View className="mb-5 h-px bg-line" />

          <Text className="mb-8 font-ui text-[16px] leading-[27px] text-ink-2">{event.desc}</Text>

          <Card className="p-4">
            <View className="mb-2 flex-row justify-between">
              <Text className="font-ui-sb text-[13px] text-ink-2">Registrations</Text>
              <Text className="font-ui-b text-[13px] text-ink-1">
                {event.registeredCount} / {event.capacity}
              </Text>
            </View>
            <ProgressBar value={event.registeredCount / event.capacity} track={tokens.border} />
            <Text className="mt-1.5 font-ui text-[12px] text-ink-3">
              {spotsLeft} spots remaining
            </Text>
          </Card>
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
        ) : (
          <Button
            label={`Register — ${event.price ?? 'Free'}`}
            onPress={register}
            loading={loading}
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
