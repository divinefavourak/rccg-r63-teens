import { memo } from 'react';
import { Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';

import type { EventListItem } from '../api/types';
import { priceLabel, startOf, whereLabel } from '../data/events';
import { EVENT_PHOTO } from '../ui/art';
import { DateBadge } from '../ui/cards';
import { Press } from '../ui/Press';
import { useTokens } from '../theme/ThemeProvider';
import { ELEVATION, type PopColour } from '../theme/tokens';
import { Icon } from './Icon';

/**
 * An event's photo. Tribe is the one place in the app with photography
 * (09-design-principles.md); an event without a cover gets the bundled photo
 * of the region's own teens rather than a blank block.
 */
export const EventPhoto = memo(function EventPhoto({
  event,
  style,
}: {
  event: Pick<EventListItem, 'id' | 'cover_image'>;
  style: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={event.cover_image || EVENT_PHOTO}
      recyclingKey={event.id}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={200}
      accessible={false}
      style={[{ backgroundColor: '#1C1916' }, style]}
    />
  );
});

/** Date badges in a list take these in turn. */
export const ROW_COLOURS: PopColour[] = ['violet', 'sky', 'amber', 'pink', 'lime'];

/** One event in a list (Figma "event row"). */
export const EventRow = memo(function EventRow({
  event,
  colour,
  registered,
  onOpen,
}: {
  event: EventListItem;
  colour: PopColour;
  registered: boolean;
  onOpen: (id: string) => void;
}) {
  const tokens = useTokens();
  const where = whereLabel(event);
  const status = [priceLabel(event), registered ? 'You’re registered' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Press
      onPress={() => onOpen(event.id)}
      scaleTo={0.985}
      accessibilityLabel={`${event.title}. ${[where, status].filter(Boolean).join('. ')}`}
      className="w-full flex-row items-center gap-3 rounded-2xl bg-surf-raised p-3"
      style={ELEVATION.card}
    >
      <DateBadge date={startOf(event)} colour={colour} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-ink-1">
          {event.title}
        </Text>
        {!!where && (
          <Text numberOfLines={1} className="font-ui text-[14px] leading-5 text-ink-2">
            {where}
          </Text>
        )}
        <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-green">
          {status}
        </Text>
      </View>
      <View className="h-11 w-11 items-center justify-center rounded-full bg-surf-sunken">
        <Icon name="chevronRight" size={20} color={tokens.text1} />
      </View>
    </Press>
  );
});
