import { memo } from 'react';
import { Text, View } from 'react-native';

import { Icon } from './Icon';
import { Photo } from './Photo';
import { Card, Pill, Press, ProgressBar } from './ui';
import { useTokens } from '../theme/ThemeProvider';
import type { EventListItem } from '../api/types';

/**
 * The event card, shared by Tribe and the past-events screen.
 *
 * Lives here rather than in a route file: expo-router treats everything under
 * `app/` as routes, and exporting a component from one both muddies the route
 * graph and trips its typed-routes generator.
 */

// ─── Event card ────────────────────────────────────────────────────────────

/** Fallback banner tints, so a photoless event still reads as a card. */
const TINTS = ['#2D6340', '#7B4FA8', '#C87A15', '#1D6FA4'];

/**
 * Memoised: without it every card re-renders whenever the list scrolls, and
 * each one owns a decoded banner image.
 */
export const EventCard = memo(function EventCard({
  event,
  onOpen,
}: {
  event: EventListItem;
  onOpen: (id: string) => void;
}) {
  const tokens = useTokens();

  const start = new Date(event.start_datetime);
  const spotsLeft = event.spots_remaining;
  const fillRatio =
    event.max_attendees && event.max_attendees > 0
      ? Math.min(1, event.registration_count / event.max_attendees)
      : null;
  // Only surfaced when the number is actually pressing.
  const nearlyFull = spotsLeft !== null && spotsLeft > 0 && spotsLeft < 50;

  const tint = TINTS[hash(event.id) % TINTS.length];
  const location = [event.venue, event.city].filter(Boolean).join(', ');
  const price = event.is_free ? null : formatNaira(event.current_price ?? event.price);

  return (
    <Press
      onPress={() => onOpen(event.id)}
      accessibilityLabel={`${event.title}, ${formatShortDate(start)}${location ? `, ${location}` : ''}`}
      className="mx-5"
      scaleTo={0.985}
    >
      <Card className="overflow-hidden">
        <View className="h-[120px]" style={{ backgroundColor: tint }}>
          {event.cover_image && (
            <Photo
              uri={event.cover_image}
              recyclingKey={event.id}
              fallbackColor={tint}
              scrim={{ top: 0.28, bottom: 0.32 }}
              style={{ width: '100%', height: '100%' }}
            />
          )}

          <View
            className="absolute left-3 top-3 rounded-full px-2.5 py-1"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          >
            <Text className="font-ui-sb text-[11px] tracking-wide text-white">
              {humanise(event.event_type)}
            </Text>
          </View>

          {price && (
            <View
              className="absolute right-3 top-3 rounded-full px-2.5 py-1"
              style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            >
              <Text className="font-ui-b text-[11px] text-white">{price}</Text>
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
              {start.toLocaleDateString(undefined, { month: 'short' })}
            </Text>
            <Text className="font-ui-b text-[22px] leading-[24px]" style={{ color: '#1C1916' }}>
              {start.getDate()}
            </Text>
          </View>
        </View>

        <View className="px-4 pb-4 pt-3.5">
          <View className="mb-2 flex-row items-start justify-between gap-2.5">
            <Text className="flex-1 font-ui-b text-[16px] leading-[21px] text-ink-1">
              {event.title}
            </Text>
            <StatusBadge status={event.registration_status} />
          </View>

          <View className="gap-1.5">
            <View className="flex-row items-center gap-2">
              <Icon name="calendar" size={14} color={tokens.text3} />
              <Text className="font-ui-md text-[13px] text-ink-2">
                {formatShortDate(start)} · {formatTime(start)}
              </Text>
            </View>
            {!!location && (
              <View className="flex-row items-center gap-2">
                <Icon name="mapPin" size={14} color={tokens.text3} />
                <Text numberOfLines={1} className="flex-1 font-ui text-[13px] text-ink-2">
                  {location}
                </Text>
              </View>
            )}
          </View>

          {nearlyFull && fillRatio !== null && (
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

function StatusBadge({ status }: { status: string }) {
  const tokens = useTokens();

  if (status === 'closed' || status === 'full') {
    return (
      <Pill tone="neutral">
        <Text className="font-ui-sb text-[11px] text-ink-3">
          {status === 'full' ? 'Full' : 'Closed'}
        </Text>
      </Pill>
    );
  }

  return (
    <Pill tone="amber">
      <Text className="font-ui-sb text-[11px] text-amber">Open</Text>
    </Pill>
  );
}

// ─── Formatting ────────────────────────────────────────────────────────────

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "worship_service" -> "Worship service". */
function humanise(value: string): string {
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** DRF sends decimals as strings, so this never does float maths on money. */
export function formatNaira(value: string | null): string | null {
  if (!value) return null;
  const amount = Number(value);
  if (Number.isNaN(amount) || amount === 0) return null;
  return `₦${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Stable per-id tint pick, so an event's colour does not change between loads. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
