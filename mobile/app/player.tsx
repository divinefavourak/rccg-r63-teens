import { useCallback, useState } from 'react';
import { Pressable, Share, Text, View, type LayoutChangeEvent } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAudioPlayerStatus } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSaved } from '../src/api/queries';
import { Icon } from '../src/components/Icon';
import { useAuth } from '../src/state/auth';
import { clock, usePlayer } from '../src/state/player';
import { DrawingIn, Object3D } from '../src/ui/art';
import { Button } from '../src/ui/Button';
import { Press, Spinner } from '../src/ui/Press';
import { HEADER_GAP, IconButton } from '../src/ui/screen';
import { useTokens } from '../src/theme/ThemeProvider';

const SKIP_SECONDS = 15;
const PLATE = '#FDFAF5';

/**
 * The full player (Figma "Podcast player").
 *
 * A view of the player held in `state/player`, not a player of its own:
 * closing this screen leaves the sound running, and the Library's docked
 * player picks up where this one left off.
 */
export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { isGuest } = useAuth();
  const { episode, player, toggle, skip } = usePlayer();
  const status = useAudioPlayerStatus(player);
  const saved = useSaved('media_episode', !isGuest);

  const [trackWidth, setTrackWidth] = useState(0);
  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width),
    [],
  );

  const close = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/library')),
    [router],
  );

  // Opened by a link with nothing loaded: there is nothing to show.
  if (!episode) return <Redirect href="/library" />;

  const duration = status.duration || episode.duration_seconds || 0;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const isSaved = saved.isSaved(episode.id);
  const waiting = !status.isLoaded || status.isBuffering;

  const onSave = () => {
    if (isGuest) router.push('/sign-up');
    else saved.toggle(episode.id);
  };

  const onShare = () => {
    const where = [episode.series_title, 'Faith Tribe'].filter(Boolean).join(' · ');
    const link = episode.audio_url?.startsWith('http') ? `\n${episode.audio_url}` : '';
    Share.share({ message: `${episode.title}\n${where}${link}` }).catch(() => {});
  };

  return (
    <View className="flex-1 bg-pop-amber">
      <View
        className="flex-row items-center gap-3 pb-1 pl-4 pr-5"
        style={{ paddingTop: insets.top + HEADER_GAP }}
      >
        <IconButton icon="chevronDown" label="Close the player" tone="raised" onPress={close} />
        <Text className="flex-1 text-center font-ui-md text-[12px] uppercase leading-4 tracking-[1.92px] text-pop-on">
          Now playing
        </Text>
        {/* Balances the close button so the label sits in the middle. */}
        <View className="h-11 w-11" />
      </View>

      {/* ── Stage ───────────────────────────────────────────────────────── */}
      <View className="flex-1 items-center justify-center">
        {/* Fixed cream, not the theme's raised surface: the drawing on it is
            black line art and must stay visible in dark mode. */}
        <View
          className="h-[250px] w-[250px] items-center justify-center rounded-full"
          style={{ backgroundColor: PLATE }}
        >
          {episode.thumbnail ? (
            <Image
              source={episode.thumbnail}
              contentFit="cover"
              accessibilityLabel={episode.title}
              style={{ width: 250, height: 250, borderRadius: 125 }}
            />
          ) : (
            <DrawingIn name="dancing" box={236} />
          )}
          <View pointerEvents="none" style={{ position: 'absolute', right: -37, top: 6 }}>
            <Object3D name="bell" size={80} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: -33, top: 162 }}>
            <Object3D name="flash" size={60} />
          </View>
        </View>
      </View>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <View
        className="items-center gap-4 rounded-t-[40px] bg-surf-raised px-6 pt-6"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
      >
        <Text
          numberOfLines={2}
          accessibilityRole="header"
          className="text-center font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-ink-1"
        >
          {episode.title}
        </Text>
        <Text numberOfLines={1} className="text-center font-ui text-[14px] leading-5 text-ink-2">
          {[episode.series_title, episode.episode_number ? `Episode ${episode.episode_number}` : null]
            .filter(Boolean)
            .join(' · ') || 'Faith Tribe'}
        </Text>

        <View className="w-full gap-2">
          {/* Tap anywhere along the bar to jump there. */}
          <Pressable
            onLayout={onTrackLayout}
            onPress={(e) => {
              if (trackWidth > 0 && duration > 0) {
                player.seekTo((e.nativeEvent.locationX / trackWidth) * duration).catch(() => {});
              }
            }}
            hitSlop={{ top: 14, bottom: 14 }}
            accessibilityRole="adjustable"
            accessibilityLabel="Position"
            accessibilityValue={{ text: `${clock(status.currentTime)} of ${clock(duration)}` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) =>
              skip(e.nativeEvent.actionName === 'increment' ? SKIP_SECONDS : -SKIP_SECONDS)
            }
            className="h-2 w-full overflow-hidden rounded-full bg-surf-sunken"
          >
            <View className="h-2 rounded-full bg-ink" style={{ width: `${progress * 100}%` }} />
          </Pressable>
          <View className="flex-row justify-between">
            <Text className="font-ui-md text-[12px] leading-4 text-ink-3">
              {clock(status.currentTime)}
            </Text>
            <Text className="font-ui-md text-[12px] leading-4 text-ink-3">{clock(duration)}</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-6">
          <SkipButton label="Back 15 seconds" text="−15" onPress={() => skip(-SKIP_SECONDS)} />
          <Press
            onPress={toggle}
            accessibilityLabel={status.playing ? 'Pause' : 'Play'}
            className="h-[76px] w-[76px] items-center justify-center rounded-full bg-ink"
          >
            {waiting && !status.playing ? (
              <Spinner size={24} color={tokens.onInk} />
            ) : (
              <Icon name={status.playing ? 'pause' : 'play'} size={28} color={tokens.onInk} />
            )}
          </Press>
          <SkipButton label="Forward 15 seconds" text="+15" onPress={() => skip(SKIP_SECONDS)} />
        </View>

        {!saved.unavailable && (
          <View className="w-full flex-row gap-3">
            <Button
              label={isSaved ? 'Saved' : 'Save'}
              variant="secondary"
              onPress={onSave}
              className="min-w-0 flex-1"
            />
            <Button label="Share" variant="secondary" onPress={onShare} className="min-w-0 flex-1" />
          </View>
        )}

        <Text className="text-center font-ui-md text-[12px] leading-4 text-ink-3">
          Audio keeps playing when you leave this screen.
        </Text>
      </View>
    </View>
  );
}

function SkipButton({
  label,
  text,
  onPress,
}: {
  label: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      className="h-14 w-14 items-center justify-center rounded-full bg-surf-sunken"
    >
      <Text className="font-ui-sb text-[14px] leading-5 text-ink-1">{text}</Text>
    </Press>
  );
}
