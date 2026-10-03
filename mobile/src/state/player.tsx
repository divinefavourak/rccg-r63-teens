import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';

import { api } from '../api/client';
import type { MediaEpisode } from '../api/types';

interface PlayerValue {
  /** What is loaded, playing or paused. Null until something is started. */
  episode: MediaEpisode | null;
  /** The native player. Read its progress with `useAudioPlayerStatus(player)`. */
  player: AudioPlayer;
  /** Load an episode and start it. Starting the one already loaded resumes it. */
  start: (episode: MediaEpisode) => void;
  toggle: () => void;
  /** Jump forwards or back by a number of seconds. */
  skip: (seconds: number) => void;
}

const PlayerContext = createContext<PlayerValue | null>(null);

/** Where an episode's sound lives: an uploaded file, or a link to one. */
export function audioSourceOf(episode: MediaEpisode): string | null {
  return episode.audio_file || episode.audio_url || null;
}

/** Links that are a video file or stream the app can play itself. */
const PLAYABLE = /\.(mp4|m4v|mov|webm|m3u8)(\?|#|$)/i;

/**
 * An episode's video, if the app can play it: an uploaded file, or a link
 * straight to a video file. Null for pages such as YouTube, which only play
 * in their own app or the browser.
 */
export function videoSourceOf(episode: MediaEpisode): string | null {
  if (episode.video_file) return episode.video_file;
  if (episode.video_url && PLAYABLE.test(episode.video_url)) return episode.video_url;
  return null;
}

/**
 * The one audio player, held above the navigator.
 *
 * It lives here rather than in the player screen so the sound carries on when
 * that screen closes: the Library's docked player and the full screen are two
 * views of this same object.
 *
 * Progress is deliberately not in this context. It changes several times a
 * second, and putting it here would re-render every screen that only wants to
 * know what is loaded. Screens that draw a scrubber subscribe to the player
 * themselves.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null);
  const [episode, setEpisode] = useState<MediaEpisode | null>(null);

  useEffect(() => {
    // A talk should be audible with the phone on silent, and keep going when
    // the screen locks. A failure here only costs those two niceties.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);

  const start = useCallback(
    (next: MediaEpisode) => {
      const source = audioSourceOf(next);
      if (!source) return;
      if (episode?.id !== next.id) {
        player.replace({ uri: source });
        setEpisode(next);
        // Counted once per load, and never worth failing playback over.
        api.post(`/media/episodes/${next.id}/play/`).catch(() => {});
      }
      player.play();
    },
    [player, episode],
  );

  const toggle = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const skip = useCallback(
    (seconds: number) => {
      const limit = player.duration || Number.MAX_SAFE_INTEGER;
      const target = Math.min(Math.max(0, player.currentTime + seconds), limit);
      player.seekTo(target).catch(() => {});
    },
    [player],
  );

  const value = useMemo<PlayerValue>(
    () => ({ episode, player, start, toggle, skip }),
    [episode, player, start, toggle, skip],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}

/** "5:56" or "1:02:07". */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
