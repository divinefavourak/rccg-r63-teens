import { useEffect } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { episodeQuery, useSaved } from '../../src/api/queries';
import { minutesLabel } from '../../src/data/library';
import { useAuth } from '../../src/state/auth';
import { usePlayer, videoSourceOf } from '../../src/state/player';
import { Button } from '../../src/ui/Button';
import { BackHeader, EmptyState, Skeleton } from '../../src/ui/screen';

/**
 * A video from the Library, played in the app.
 *
 * The phone's own controls (play, scrub, full screen) rather than custom ones:
 * they are what teens already know, and they handle rotation and captions.
 * Talk audio and a video never play over each other, so opening this pauses
 * the audio player.
 */
export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const audio = usePlayer();
  const saved = useSaved('media_episode', !isGuest);

  const query = useQuery({ ...episodeQuery(id ?? ''), enabled: !!id });
  const episode = query.data;
  const source = episode ? videoSourceOf(episode) : null;

  useEffect(() => {
    if (audio.player.playing) audio.player.pause();
  }, [audio.player]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader
        title="Video"
        onBack={back}
        action={
          episode
            ? {
                icon: 'shareUp',
                label: 'Share this video',
                onPress: () => {
                  const where = [episode.series_title, 'Faith Tribe'].filter(Boolean).join(' · ');
                  Share.share({ message: `${episode.title}\n${where}` }).catch(() => {});
                },
              }
            : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 16,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
      >
        {query.isPending ? (
          <>
            <Skeleton height={190} />
            <Skeleton width="80%" height={32} radius={8} />
            <Skeleton width="50%" height={20} radius={8} />
          </>
        ) : !episode || !source ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="sitting"
              message={
                episode
                  ? 'This video can’t play here.'
                  : 'We couldn’t load this video. Check your connection, then try again.'
              }
              actionLabel={episode ? 'Back to the Library' : 'Try again'}
              onAction={() => (episode ? back() : query.refetch())}
            />
          </View>
        ) : (
          <>
            <Video uri={source} />

            <Text
              accessibilityRole="header"
              className="font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-ink-1"
            >
              {episode.title}
            </Text>
            <Text className="font-ui text-[14px] leading-5 text-ink-2">
              {[episode.series_title, minutesLabel(episode.duration_seconds)]
                .filter(Boolean)
                .join(' · ') || 'Faith Tribe'}
            </Text>
            {!!episode.description && (
              <Text className="font-ui text-[16px] leading-6 text-ink-2">{episode.description}</Text>
            )}

            {!saved.unavailable && (
              <Button
                label={saved.isSaved(episode.id) ? 'Saved' : 'Save'}
                variant="secondary"
                onPress={() =>
                  isGuest ? router.push('/sign-up') : saved.toggle(episode.id)
                }
                className="w-full"
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The player itself. Its own component so the native player is only made once
 * the address is known; it starts playing as soon as it is ready.
 */
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return (
    <View className="w-full overflow-hidden rounded-2xl" style={{ backgroundColor: '#000' }}>
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture
        style={{ width: '100%', aspectRatio: 16 / 9 }}
      />
    </View>
  );
}
