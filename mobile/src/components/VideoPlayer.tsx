import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer as Player, type VideoSize } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { clock } from '../state/player';
import { POP } from '../theme/tokens';
import { Press, Spinner } from '../ui/Press';
import { PlayerIcon, type PlayerIconName } from './PlayerIcons';

const SKIP_SECONDS = 10;
const SPEEDS = [1, 1.25, 1.5, 2] as const;
/** How long the controls stay up after the last touch while the video plays. */
const HIDE_AFTER_MS = 3000;
/** Two taps on one side closer together than this are a double tap. */
const DOUBLE_TAP_MS = 280;

// Fixed colours, not theme tokens: the controls always sit on video, which is
// dark whatever the app's scheme is.
const CREAM = '#FDFAF5';
const ACCENT = POP.amber;
const GLASS = 'rgba(20, 18, 16, 0.55)';
const RAIL = 'rgba(253, 250, 245, 0.28)';
const LOADED = 'rgba(253, 250, 245, 0.5)';

const FADE = { duration: 220, easing: Easing.out(Easing.cubic) };
const INSTANT = { duration: 0 };

type Side = 'back' | 'forward';

/**
 * The app's own video player, in place of the phone's built-in controls.
 *
 * `expo-video` still does the playing; this draws everything on top of it:
 * play and pause, ten-second skips (buttons, or a double tap on either side),
 * a seek bar you can drag, playback speed, and full screen. The controls fade
 * out three seconds after the last touch while the video plays, and stay up
 * while it is paused, finished or being read by a screen reader.
 *
 * Full screen is a modal over the whole app. The app is locked to portrait,
 * so when the phone is upright and the video is wide, the modal turns the
 * video a quarter turn and the teen turns the phone to match.
 */
export function VideoPlayer({
  uri,
  title,
  durationHint = 0,
}: {
  uri: string;
  title?: string;
  /** Length from the API, shown until the player knows the real one. */
  durationHint?: number;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });
  const window = useWindowDimensions();
  const [fullscreen, setFullscreen] = useState(false);
  // The web build reports no video track, so it keeps the 16:9 default.
  const { videoTrack } = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack });
  const aspect = aspectOf(videoTrack?.size);

  // Whether the browser itself went full screen, so leaving knows to undo it.
  const inBrowserFullscreen = useRef(false);

  const enter = useCallback(() => {
    setFullscreen(true);
    if (Platform.OS === 'web') {
      browserFullscreen(true, aspect > 1).then((ok) => {
        inBrowserFullscreen.current = ok;
      });
    }
  }, [aspect]);

  const exit = useCallback(() => {
    setFullscreen(false);
    if (Platform.OS === 'web' && inBrowserFullscreen.current) {
      inBrowserFullscreen.current = false;
      browserFullscreen(false);
    }
  }, []);

  // Escape, or the browser's own "exit full screen", leaves ours too.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onChange = () => {
      if (!document.fullscreenElement && inBrowserFullscreen.current) {
        inBrowserFullscreen.current = false;
        setFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Tall videos get a taller frame, up to 4:5, and no frame is taller than
  // most of the screen; what is left over is letterboxed.
  const frameAspect = Math.min(Math.max(aspect, 4 / 5), 21 / 9);

  return (
    <>
      <View
        style={{
          width: '100%',
          aspectRatio: frameAspect,
          maxHeight: window.height * 0.7,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        {/* One view of the player at a time: in full screen it lives in the modal. */}
        {!fullscreen && (
          <Stage
            player={player}
            uri={uri}
            title={title}
            durationHint={durationHint}
            fullscreen={false}
            rotated={false}
            onFullscreen={enter}
          />
        )}
      </View>

      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={exit}
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        statusBarTranslucent
        navigationBarTranslucent
        hardwareAccelerated
      >
        <StatusBar hidden />
        <FullscreenFrame aspect={aspect}>
          {(rotated) => (
            <Stage
              player={player}
              uri={uri}
              title={title}
              durationHint={durationHint}
              fullscreen
              rotated={rotated}
              onFullscreen={exit}
            />
          )}
        </FullscreenFrame>
      </Modal>
    </>
  );
}

/**
 * Fills the screen with black and places the stage on it, turned a quarter
 * turn when the screen is upright and the video is wide.
 */
function FullscreenFrame({
  aspect,
  children,
}: {
  aspect: number;
  children: (rotated: boolean) => React.ReactNode;
}) {
  const window = useWindowDimensions();
  // The modal's own size, which on Android can differ from the window's by the
  // status and navigation bars it draws under.
  const [box, setBox] = useState({ width: window.width, height: window.height });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.width === width && b.height === height ? b : { width, height }));
  }, []);

  const rotated = box.height > box.width && aspect > 1.05;
  const width = rotated ? box.height : box.width;
  const height = rotated ? box.width : box.height;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={onLayout}>
      <View
        style={{
          position: 'absolute',
          width,
          height,
          left: (box.width - width) / 2,
          top: (box.height - height) / 2,
          // A quarter turn clockwise: the top of the video goes to the right
          // edge, so it reads upright with the phone turned to the left.
          transform: rotated ? [{ rotate: '90deg' }] : undefined,
        }}
      >
        {children(rotated)}
      </View>
    </View>
  );
}

// ── The stage: the video and everything drawn over it ────────────────────────

function Stage({
  player,
  uri,
  title,
  durationHint,
  fullscreen,
  rotated,
  onFullscreen,
}: {
  player: Player;
  uri: string;
  title?: string;
  durationHint: number;
  fullscreen: boolean;
  rotated: boolean;
  onFullscreen: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const insets = useSafeAreaInsets();

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { currentTime, bufferedPosition } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const { playbackRate } = useEvent(player, 'playbackRateChange', {
    playbackRate: player.playbackRate,
    oldPlaybackRate: player.playbackRate,
  });

  const duration = finite(player.duration) || durationHint || 0;

  // Read from the player as well as the event: going full screen makes a new
  // stage, which must still know a finished video is finished.
  const [ended, setEnded] = useState(
    () => !player.playing && duration > 0 && player.currentTime >= duration - 0.5,
  );
  useEventListener(player, 'playToEnd', () => setEnded(true));
  useEventListener(player, 'playingChange', ({ isPlaying: now }) => {
    if (now) setEnded(false);
  });

  // After a seek, the player's reported time catches up a beat later; until
  // it does, show where the teen asked to go rather than a jump back. A paused
  // player may report nothing more, so the time is only let go of unprompted
  // while playing.
  const [heldTime, setHeldTime] = useState<number | null>(null);
  useEffect(() => {
    if (heldTime === null) return;
    if (Math.abs(currentTime - heldTime) < 1) {
      setHeldTime(null);
      return;
    }
    if (!isPlaying) return;
    const t = setTimeout(() => setHeldTime(null), 1500);
    return () => clearTimeout(t);
  }, [currentTime, heldTime, isPlaying]);

  const seekTo = useCallback(
    (seconds: number) => {
      const target = Math.max(0, duration > 0 ? Math.min(seconds, duration - 0.25) : seconds);
      player.currentTime = target;
      setHeldTime(target);
      if (ended) {
        setEnded(false);
        player.play();
      }
    },
    [player, duration, ended],
  );
  const skip = useCallback(
    (by: number) => seekTo((heldTime ?? player.currentTime) + by),
    [seekTo, heldTime, player],
  );

  // ── Showing and hiding the controls ────────────────────────────────────────
  const [shown, setShown] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [touches, setTouches] = useState(0);
  const failed = status === 'error';
  const keepShown = !isPlaying || ended || scrubbing || screenReader || failed;

  /** Shows the controls and restarts the count to hiding them. */
  const poke = useCallback(() => {
    setShown(true);
    setTouches((n) => n + 1);
  }, []);

  // Up whenever something needs them, whatever `shown` says.
  const visible = shown || keepShown;

  useEffect(() => {
    if (keepShown || !shown) return;
    const t = setTimeout(() => setShown(false), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [keepShown, shown, touches]);

  const visibility = useSharedValue(1);
  useEffect(() => {
    visibility.value = withTiming(visible ? 1 : 0, reduceMotion ? INSTANT : FADE);
  }, [visible, visibility, reduceMotion]);
  const controlsStyle = useAnimatedStyle(() => ({ opacity: visibility.value }));
  const hairlineStyle = useAnimatedStyle(() => ({ opacity: 1 - visibility.value }));

  // ── Taps on the video itself ───────────────────────────────────────────────
  const lastTap = useRef<{ side: Side; at: number } | null>(null);
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [burst, setBurst] = useState<{ side: Side; seconds: number; at: number } | null>(null);

  useEffect(() => () => {
    if (pendingTap.current) clearTimeout(pendingTap.current);
  }, []);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 700);
    return () => clearTimeout(t);
  }, [burst]);

  const toggleShown = useCallback(() => {
    if (visible && !keepShown) setShown(false);
    else poke();
  }, [visible, keepShown, poke]);

  // A single tap shows or hides the controls; two quick taps on the left or
  // right skip, and each further quick tap skips ten seconds more. On the sides
  // the single tap waits a moment to see whether a second one follows.
  const onSideTap = (side: Side) => {
    const now = Date.now();
    const prev = lastTap.current;
    lastTap.current = { side, at: now };
    if (prev && prev.side === side && now - prev.at < DOUBLE_TAP_MS) {
      if (pendingTap.current) clearTimeout(pendingTap.current);
      pendingTap.current = null;
      skip(side === 'back' ? -SKIP_SECONDS : SKIP_SECONDS);
      setBurst((b) => ({
        side,
        seconds: (b && b.side === side ? b.seconds : 0) + SKIP_SECONDS,
        at: now,
      }));
      return;
    }
    if (pendingTap.current) clearTimeout(pendingTap.current);
    pendingTap.current = setTimeout(() => {
      pendingTap.current = null;
      toggleShown();
    }, DOUBLE_TAP_MS);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    poke();
    if (ended) {
      setEnded(false);
      player.replay();
      player.play();
    } else if (isPlaying) player.pause();
    else player.play();
  };

  const nextSpeed = () => {
    poke();
    const at = SPEEDS.findIndex((s) => Math.abs(s - playbackRate) < 0.01);
    player.playbackRate = SPEEDS[(at + 1) % SPEEDS.length];
  };

  const retry = () => {
    player
      .replaceAsync(uri)
      .then(() => player.play())
      .catch(() => {});
  };

  // ── Sizes that follow the stage ────────────────────────────────────────────
  const [stageWidth, setStageWidth] = useState(0);
  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    setStageWidth(e.nativeEvent.layout.width);
  }, []);
  const size = sizesFor(stageWidth);

  // Clear of the notch and the home bar in full screen. When turned, the
  // phone's top edge is the stage's left.
  const pad = fullscreen ? edgesFor(insets, rotated) : { top: 0, right: 0, bottom: 0, left: 0 };

  const waiting = !failed && !ended && (status === 'loading' || status === 'idle');
  const position = heldTime ?? currentTime;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onStageLayout}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="contain"
        allowsPictureInPicture
        // A texture, not a separate surface: a surface ignores the quarter
        // turn in full screen and the rounded corners inline.
        surfaceType="textureView"
        style={StyleSheet.absoluteFill}
      />

      {/* Where the taps land: the left third skips back, the right third
          forward, and the middle only shows and hides the controls. */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => onSideTap('back')}
          accessible={false}
        />
        <Pressable style={{ flex: 1 }} onPress={toggleShown} accessible={false} />
        <Pressable
          style={{ flex: 1 }}
          onPress={() => onSideTap('forward')}
          accessible={false}
        />
      </View>

      {burst && <SkipBurst side={burst.side} seconds={burst.seconds} key={burst.side} />}

      {waiting && !visible && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
          <Spinner size={size.play * 0.5} color={CREAM} />
        </View>
      )}

      {/* While the controls are hidden, a thin line still shows how far in. */}
      {!fullscreen && (
        <Animated.View pointerEvents="none" style={[styles.hairline, hairlineStyle]}>
          <View style={{ height: 3, width: `${progress * 100}%`, backgroundColor: ACCENT }} />
        </Animated.View>
      )}

      {/* ── The controls ─────────────────────────────────────────────────── */}
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[StyleSheet.absoluteFill, controlsStyle]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
          style={[styles.scrimTop, { height: fullscreen ? '35%' : '30%' }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
          style={styles.scrimBottom}
        />

        {fullscreen && (
          <View
            pointerEvents="box-none"
            style={[
              styles.topBar,
              { paddingTop: pad.top + 12, paddingLeft: pad.left + 12, paddingRight: pad.right + 16 },
            ]}
          >
            <RoundButton
              icon="close"
              label="Leave full screen"
              size={size.small}
              onPress={onFullscreen}
            />
            {!!title && (
              <Text
                numberOfLines={1}
                className="min-w-0 flex-1 font-ui-sb text-[16px] leading-6"
                style={{ color: CREAM }}
              >
                {title}
              </Text>
            )}
          </View>
        )}

        {/* Middle: back, play or pause, forward. */}
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.centre]}>
          {failed ? (
            <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 24 }}>
              <Text className="text-center font-ui-md text-[14px] leading-5" style={{ color: CREAM }}>
                This video stopped loading. Check your connection, then try again.
              </Text>
              <Press
                onPress={retry}
                accessibilityLabel="Try again"
                className="h-11 items-center justify-center rounded-full px-5"
                style={{ backgroundColor: CREAM }}
              >
                <Text className="font-ui-sb text-[14px] leading-5" style={{ color: POP.on }}>
                  Try again
                </Text>
              </Press>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: size.gap }}>
              <SkipButton
                side="back"
                size={size.skip}
                onPress={() => {
                  poke();
                  skip(-SKIP_SECONDS);
                }}
              />
              <Press
                onPress={togglePlay}
                accessibilityLabel={ended ? 'Play again' : isPlaying ? 'Pause' : 'Play'}
                style={{
                  width: size.play,
                  height: size.play,
                  borderRadius: size.play / 2,
                  backgroundColor: CREAM,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {waiting ? (
                  <Spinner size={size.play * 0.36} color={POP.on} />
                ) : (
                  <PlayerIcon
                    name={ended ? 'replay' : isPlaying ? 'pause' : 'play'}
                    size={size.play * 0.5}
                    color={POP.on}
                  />
                )}
              </Press>
              <SkipButton
                side="forward"
                size={size.skip}
                onPress={() => {
                  poke();
                  skip(SKIP_SECONDS);
                }}
              />
            </View>
          )}
        </View>

        {/* Bottom: time, speed, full screen, and the seek bar. */}
        <View
          pointerEvents="box-none"
          style={[
            styles.bottomBar,
            {
              paddingLeft: pad.left + 16,
              paddingRight: pad.right + 12,
              paddingBottom: pad.bottom + (fullscreen ? 14 : 6),
            },
          ]}
        >
          <View style={styles.bottomRow} pointerEvents="box-none">
            <Text
              className="min-w-0 flex-1 font-ui-sb leading-5"
              style={{ color: CREAM, fontSize: size.text, fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
            >
              {clock(position)}
              <Text style={{ color: 'rgba(253, 250, 245, 0.7)' }}> / {clock(duration)}</Text>
            </Text>
            <Press
              onPress={nextSpeed}
              accessibilityLabel={`Playback speed ${speedLabel(playbackRate)}. Change the speed`}
              className="h-9 min-w-[48px] items-center justify-center rounded-full px-3"
              style={{ backgroundColor: GLASS }}
            >
              <Text
                className="font-ui-sb text-[13px] leading-4"
                style={{ color: playbackRate !== 1 ? ACCENT : CREAM }}
              >
                {speedLabel(playbackRate)}
              </Text>
            </Press>
            <RoundButton
              icon={fullscreen ? 'exitFullscreen' : 'fullscreen'}
              label={fullscreen ? 'Leave full screen' : 'Full screen'}
              size={36}
              onPress={onFullscreen}
            />
          </View>
          <SeekBar
            position={position}
            buffered={bufferedPosition}
            duration={duration}
            rotated={rotated}
            onScrubStart={() => {
              setScrubbing(true);
              poke();
            }}
            onScrubEnd={(seconds) => {
              setScrubbing(false);
              if (seconds !== null) seekTo(seconds);
              poke();
            }}
            onStep={(by) => {
              poke();
              skip(by);
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

// ── The seek bar ──────────────────────────────────────────────────────────────

/**
 * A bar to drag or tap along. It only previews while held and seeks once on
 * release, so a slow connection is not asked for every frame in between.
 */
function SeekBar({
  position,
  buffered,
  duration,
  rotated,
  onScrubStart,
  onScrubEnd,
  onStep,
}: {
  position: number;
  buffered: number;
  duration: number;
  rotated: boolean;
  onScrubStart: () => void;
  /** With where to seek to, or null when there was nothing to seek. */
  onScrubEnd: (seconds: number | null) => void;
  onStep: (by: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);

  // The responder is made once; it reads everything that changes from here.
  const live = useRef({ width, duration, rotated, onScrubStart, onScrubEnd });
  useEffect(() => {
    live.current = { width, duration, rotated, onScrubStart, onScrubEnd };
  });
  const start = useRef(0);
  const fraction = useRef<number | null>(null);

  const responder = useMemo(() => {
    const at = (x: number) => {
      const w = live.current.width;
      const f = w > 0 ? Math.min(1, Math.max(0, x / w)) : 0;
      fraction.current = f;
      setDrag(f);
    };
    const finish = () => {
      const f = fraction.current;
      fraction.current = null;
      setDrag(null);
      const d = live.current.duration;
      live.current.onScrubEnd(f !== null && d > 0 ? f * d : null);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Holding on to the touch keeps a scroll view behind from taking it.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        start.current = alongTrack(e, trackRef.current, live.current.rotated);
        live.current.onScrubStart();
        at(start.current);
      },
      // Turned a quarter turn, the bar runs down the screen.
      onPanResponderMove: (_e, g) => at(start.current + (live.current.rotated ? g.dy : g.dx)),
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  }, []);

  const shown = drag ?? (duration > 0 ? Math.min(1, position / duration) : 0);
  const loaded = duration > 0 ? Math.min(1, buffered / duration) : 0;

  const knob = useSharedValue(1);
  useEffect(() => {
    knob.value = withTiming(drag !== null ? 1.45 : 1, reduceMotion ? INSTANT : FADE);
  }, [drag, knob, reduceMotion]);
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ scale: knob.value }] }));

  return (
    <View
      ref={trackRef}
      {...responder.panHandlers}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Position"
      accessibilityValue={{ text: `${clock(position)} of ${clock(duration)}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onStep(e.nativeEvent.actionName === 'increment' ? SKIP_SECONDS : -SKIP_SECONDS)
      }
      // Tall enough to catch a thumb, with the bar drawn in the middle.
      style={{ height: 28, justifyContent: 'center' }}
    >
      {drag !== null && duration > 0 && (
        <View
          pointerEvents="none"
          style={[styles.bubble, { left: `${shown * 100}%` }]}
        >
          <View style={styles.bubbleInner}>
            <Text
              className="font-ui-sb text-[13px] leading-4"
              style={{ color: POP.on, fontVariant: ['tabular-nums'] }}
            >
              {clock(shown * duration)}
            </Text>
          </View>
        </View>
      )}
      <View pointerEvents="none" style={styles.rail}>
        <View style={[styles.fill, { width: `${loaded * 100}%`, backgroundColor: LOADED }]} />
        <View style={[styles.fill, { width: `${shown * 100}%`, backgroundColor: ACCENT }]} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.knob, { left: `${shown * 100}%` }, knobStyle]}
      />
    </View>
  );
}

/** Where along the track a touch landed, in points from its start. */
function alongTrack(e: GestureResponderEvent, track: View | null, rotated: boolean): number {
  // On the web the touch's own `locationX` is measured against the bar's
  // bounding box, which a quarter turn makes tall and thin; measure from the
  // box ourselves instead.
  if (Platform.OS === 'web' && track) {
    const node = track as unknown as HTMLElement;
    const rect = node.getBoundingClientRect?.();
    if (rect) {
      const x = e.nativeEvent.pageX - (typeof window !== 'undefined' ? window.scrollX : 0);
      const y = e.nativeEvent.pageY - (typeof window !== 'undefined' ? window.scrollY : 0);
      return rotated ? y - rect.top : x - rect.left;
    }
  }
  return e.nativeEvent.locationX;
}

// ── Small pieces ──────────────────────────────────────────────────────────────

function RoundButton({
  icon,
  label,
  size,
  onPress,
}: {
  icon: PlayerIconName;
  label: string;
  size: number;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: Math.max(size, 44),
        height: Math.max(size, 44),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: GLASS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlayerIcon name={icon} size={size * 0.56} color={CREAM} />
      </View>
    </Press>
  );
}

function SkipButton({ side, size, onPress }: { side: Side; size: number; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={side === 'back' ? 'Back 10 seconds' : 'Forward 10 seconds'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: GLASS,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PlayerIcon name={side === 'back' ? 'skipBack' : 'skipForward'} size={size * 0.7} color={CREAM} />
    </Press>
  );
}

/** What a double tap did, shown on the side it happened on. */
function SkipBurst({ side, seconds }: { side: Side; seconds: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(220)}
      style={[
        styles.burst,
        side === 'back'
          ? { left: 0, borderTopRightRadius: 999, borderBottomRightRadius: 999 }
          : { right: 0, borderTopLeftRadius: 999, borderBottomLeftRadius: 999 },
      ]}
    >
      <PlayerIcon name={side === 'back' ? 'rushBack' : 'rushForward'} size={26} color={CREAM} />
      <Text className="font-ui-sb text-[13px] leading-4" style={{ color: CREAM }}>
        {seconds} seconds
      </Text>
    </Animated.View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => alive && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

function aspectOf(size: VideoSize | undefined): number {
  return size && size.width > 0 && size.height > 0 ? size.width / size.height : 16 / 9;
}

function finite(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function speedLabel(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}

/** Button and text sizes for the stage's width: a phone inline, a tablet, full screen. */
function sizesFor(width: number) {
  if (width >= 700) return { play: 76, skip: 56, small: 44, gap: 40, text: 15 };
  if (width >= 380) return { play: 64, skip: 48, small: 40, gap: 28, text: 13 };
  return { play: 54, skip: 42, small: 36, gap: 20, text: 12 };
}

function edgesFor(insets: EdgeInsets, rotated: boolean) {
  if (!rotated) return insets;
  // A quarter turn clockwise: the stage's left is the phone's top, its right
  // the phone's bottom, its top the phone's right, its bottom the phone's left.
  return { top: insets.right, right: insets.bottom, bottom: insets.left, left: insets.top };
}

/**
 * The browser's own full screen, on the web build only. iPhone browsers have
 * none for a page, so this resolves false there and the modal alone fills the
 * window. Where it works, a wide video also asks for landscape.
 */
async function browserFullscreen(on: boolean, landscape = false): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  try {
    if (!on) {
      if (document.fullscreenElement) await document.exitFullscreen();
      return false;
    }
    const root = document.documentElement;
    if (!root.requestFullscreen) return false;
    await root.requestFullscreen();
    if (landscape) {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (to: string) => Promise<void>;
      };
      await orientation?.lock?.('landscape').catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 2 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: RAIL },
  rail: { height: 4, borderRadius: 2, backgroundColor: RAIL, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 2 },
  knob: {
    position: 'absolute',
    // Centred in the 28-high touch area.
    top: 7,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: CREAM,
  },
  bubble: { position: 'absolute', bottom: 30, width: 0, alignItems: 'center' },
  bubbleInner: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: CREAM,
  },
  burst: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '34%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(253, 250, 245, 0.14)',
  },
});
