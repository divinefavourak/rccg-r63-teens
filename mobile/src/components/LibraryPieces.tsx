import { memo, useCallback } from 'react';
import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAudioPlayerStatus } from 'expo-audio';

import type { LibraryItem } from '../data/library';
import { audioSourceOf, clock, usePlayer, videoSourceOf } from '../state/player';
import { DrawingIn } from '../ui/art';
import { ContentCard, POP_BG } from '../ui/cards';
import { Press } from '../ui/Press';
import { Icon } from './Icon';

/**
 * Open a Library item in the right place: a reading or article in its reader,
 * sound in the audio player, and a video in the video screen. A video stored
 * as a page rather than a file (YouTube, say) cannot play in the app, so that
 * one alone opens outside it.
 */
export function useOpenLibraryItem(): (item: LibraryItem) => void {
  const router = useRouter();
  const { start } = usePlayer();

  return useCallback(
    (item: LibraryItem) => {
      if (item.source === 'devotional') {
        router.push({ pathname: '/devotional', params: { id: item.id } });
        return;
      }
      if (item.source === 'article') {
        router.push({ pathname: '/article/[id]', params: { id: item.id } });
        return;
      }
      const episode = item.episode;
      if (!episode) return;
      if (audioSourceOf(episode)) {
        start(episode);
        router.push('/player');
        return;
      }
      if (videoSourceOf(episode)) {
        router.push({ pathname: '/watch/[id]', params: { id: episode.id } });
        return;
      }
      if (episode.video_url) Linking.openURL(episode.video_url).catch(() => {});
    },
    [router, start],
  );
}

/** A Library item as a list card. */
export const LibraryCard = memo(function LibraryCard({
  item,
  onOpen,
  trailing,
}: {
  item: LibraryItem;
  onOpen: (item: LibraryItem) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <ContentCard
      eyebrow={item.eyebrow}
      title={item.title}
      detail={item.detail}
      colour={item.colour}
      drawing={item.drawing}
      image={item.image}
      onPress={() => onOpen(item)}
      trailing={trailing}
    />
  );
});

export const TILE_WIDTH = 148;

/** A square cover with a play button, for the sideways shelves. */
export const ShelfTile = memo(function ShelfTile({
  item,
  onOpen,
}: {
  item: LibraryItem;
  onOpen: (item: LibraryItem) => void;
}) {
  return (
    <Press
      onPress={() => onOpen(item)}
      scaleTo={0.98}
      accessibilityLabel={`${item.title}. ${item.caption}`}
      className="gap-2"
      style={{ width: TILE_WIDTH }}
    >
      <View
        className={`items-center justify-center overflow-hidden rounded-2xl ${POP_BG[item.colour]}`}
        style={{ width: TILE_WIDTH, height: TILE_WIDTH }}
      >
        {item.image ? (
          <Image
            source={item.image}
            recyclingKey={item.key}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessible={false}
            style={{ width: TILE_WIDTH, height: TILE_WIDTH }}
          />
        ) : (
          <DrawingIn name={item.drawing} box={120} />
        )}
        {/* Always dark with a light mark: it sits on a colour or a photo. */}
        <View className="absolute bottom-2 right-2 h-11 w-11 items-center justify-center rounded-full bg-pop-on">
          <Icon name="play" size={20} color="#FDFAF5" />
        </View>
      </View>
      <Text numberOfLines={2} className="font-ui-sb text-[16px] leading-6 text-ink-1">
        {item.title}
      </Text>
      <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-ink-3">
        {item.caption}
      </Text>
    </Press>
  );
});

/** Height of the docked player, for screens that pad their content clear of it. */
export const MINI_PLAYER_HEIGHT = 60;

/**
 * The docked player (Figma "App/Mini Player"): what is playing, how long is
 * left, and play or pause. Tapping the rest of it opens the full player.
 * Renders nothing until something has been started.
 */
export function MiniPlayer() {
  const router = useRouter();
  const { episode, player, toggle } = usePlayer();
  const status = useAudioPlayerStatus(player);

  if (!episode) return null;

  const left = status.duration > 0 ? `${clock(status.duration - status.currentTime)} left` : null;
  const line = [episode.series_title, left].filter(Boolean).join(' · ');

  return (
    <View className="w-full flex-row items-center gap-3 rounded-full bg-pop-amber p-2">
      <Press
        onPress={() => router.push('/player')}
        scaleTo={0.985}
        accessibilityLabel={`Now playing: ${episode.title}. Open the player`}
        className="min-w-0 flex-1 flex-row items-center gap-3"
      >
        {/* Fixed cream: the drawing on it is black and must show in dark mode. */}
        <View
          className="h-11 w-11 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: '#FDFAF5' }}
        >
          {episode.thumbnail ? (
            <Image
              source={episode.thumbnail}
              contentFit="cover"
              accessible={false}
              style={{ width: 44, height: 44 }}
            />
          ) : (
            <DrawingIn name="dancing" box={36} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-ui-sb text-[14px] leading-5 text-pop-on">
            {episode.title}
          </Text>
          {!!line && (
            <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-pop-on">
              {line}
            </Text>
          )}
        </View>
      </Press>
      <Press
        onPress={toggle}
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}
        className="h-11 w-11 items-center justify-center rounded-full bg-pop-on"
      >
        <Icon name={status.playing ? 'pause' : 'play'} size={20} color="#FDFAF5" />
      </Press>
    </View>
  );
}
