import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

import { PlayerIcon, PlayerSpinner } from './PlayerIcons';

const SKIP_SECONDS = 10;
const SPEEDS = [1, 1.25, 1.5, 2] as const;
/** How long the controls stay up after the last movement while the video plays. */
const HIDE_AFTER_MS = 3000;
/** Two taps on one side closer together than this are a double tap. */
const DOUBLE_TAP_MS = 280;
/** One video plays at a time: starting one tells the others on the page. */
const PLAY_EVENT = 'ft:video-play';

type Side = 'back' | 'forward';
type Mode = 'inline' | 'browser' | 'page';

/**
 * Faith Tribe's own video player, in place of the browser's controls.
 *
 * The same controls as the app's player (`mobile/src/components/VideoPlayer`):
 * play and pause, ten-second skips (buttons, a double tap on either side on a
 * touch screen, or J and L), a seek bar to drag or click, playback speed and
 * full screen, plus sound and the usual keyboard keys for a computer. The
 * controls fade three seconds after the last movement while the video plays.
 *
 * Full screen is the browser's own where it has one. iPhone browsers do not,
 * so there the player fills the page instead, and a wide video held upright
 * is turned a quarter turn so the phone can be turned to match.
 *
 * The player fills its parent, which sets its size.
 */
export default function VideoPlayer({
    src,
    poster,
    title,
    className = '',
}: {
    src: string;
    poster?: string | null;
    title?: string;
    className?: string;
}) {
    const id = useId();
    const boxRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [playing, setPlaying] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [ended, setEnded] = useState(false);
    const [failed, setFailed] = useState(false);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [rate, setRate] = useState(1);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [aspect, setAspect] = useState(16 / 9);
    const [mode, setMode] = useState<Mode>('inline');
    const [box, setBox] = useState({ w: 0, h: 0 });
    const [viewport, setViewport] = useState(() => ({
        w: typeof window === 'undefined' ? 0 : window.innerWidth,
        h: typeof window === 'undefined' ? 0 : window.innerHeight,
    }));

    // ── The video's own events ──────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const sync = () => {
            setTime(v.currentTime);
            setDuration(Number.isFinite(v.duration) ? v.duration : 0);
            setBuffered(v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0);
        };
        const on: Record<string, () => void> = {
            play: () => {
                setPlaying(true);
                setEnded(false);
                window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: id }));
            },
            pause: () => setPlaying(false),
            playing: () => setWaiting(false),
            waiting: () => setWaiting(true),
            canplay: () => setWaiting(false),
            ended: () => {
                setPlaying(false);
                setEnded(true);
            },
            error: () => setFailed(true),
            loadedmetadata: () => {
                if (v.videoWidth > 0 && v.videoHeight > 0) setAspect(v.videoWidth / v.videoHeight);
                sync();
            },
            timeupdate: sync,
            progress: sync,
            durationchange: sync,
            ratechange: () => setRate(v.playbackRate),
            volumechange: () => {
                setMuted(v.muted);
                setVolume(v.volume);
            },
        };
        for (const [name, fn] of Object.entries(on)) v.addEventListener(name, fn);
        return () => {
            for (const [name, fn] of Object.entries(on)) v.removeEventListener(name, fn);
        };
    }, [id]);

    useEffect(() => {
        const onOtherPlay = (e: Event) => {
            if ((e as CustomEvent<string>).detail !== id) videoRef.current?.pause();
        };
        window.addEventListener(PLAY_EVENT, onOtherPlay);
        return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
    }, [id]);

    // ── Size ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const el = boxRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(([entry]) =>
            setBox({ w: entry.contentRect.width, h: entry.contentRect.height }),
        );
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // ── The blurred backdrop ────────────────────────────────────────────────
    // When the video's shape differs from the player's (an upright phone video
    // in a wide card), the empty sides show a soft, blurred copy of the
    // picture instead of black. A tiny canvas copies the frame a few times a
    // second; CSS does the blur. A second <video> would decode it all twice.
    const backdropRef = useRef<HTMLCanvasElement>(null);
    const [backdropReady, setBackdropReady] = useState(false);
    const boxAspect = box.h > 0 ? box.w / box.h : 16 / 9;
    const letterboxed = Math.abs(Math.log(aspect / boxAspect)) > 0.1;

    useEffect(() => {
        const v = videoRef.current;
        const canvas = backdropRef.current;
        const ctx = canvas?.getContext('2d');
        if (!letterboxed || !v || !canvas || !ctx) return;
        canvas.width = 64;
        canvas.height = Math.max(1, Math.round(64 / boxAspect));
        const draw = () => {
            if (v.readyState < 2 || !v.videoWidth) return;
            // Cover: crop the frame to the canvas's shape, centred.
            const target = canvas.width / canvas.height;
            let sw = v.videoWidth;
            let sh = v.videoHeight;
            if (sw / sh > target) sw = sh * target;
            else sh = sw / target;
            ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
            setBackdropReady(true);
        };
        const first = window.requestAnimationFrame(draw);
        const timer = window.setInterval(() => {
            if (!v.paused) draw();
        }, 200);
        v.addEventListener('loadeddata', draw);
        v.addEventListener('seeked', draw);
        return () => {
            window.cancelAnimationFrame(first);
            window.clearInterval(timer);
            v.removeEventListener('loadeddata', draw);
            v.removeEventListener('seeked', draw);
        };
    }, [letterboxed, boxAspect]);

    useEffect(() => {
        const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // ── Showing and hiding the controls ─────────────────────────────────────
    const [shown, setShown] = useState(true);
    const [scrub, setScrub] = useState<number | null>(null);
    const [touches, setTouches] = useState(0);
    const keepShown = !playing || ended || failed || scrub !== null;

    const poke = useCallback(() => {
        setShown(true);
        setTouches((n) => n + 1);
    }, []);

    // Up whenever something needs them, whatever `shown` says.
    const visible = shown || keepShown;

    useEffect(() => {
        if (keepShown || !shown) return;
        const t = window.setTimeout(() => setShown(false), HIDE_AFTER_MS);
        return () => window.clearTimeout(t);
    }, [keepShown, shown, touches]);

    // ── Actions ─────────────────────────────────────────────────────────────
    const togglePlay = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        poke();
        if (v.paused || v.ended) v.play().catch(() => {});
        else v.pause();
    }, [poke]);

    const seekTo = useCallback((seconds: number) => {
        const v = videoRef.current;
        if (!v) return;
        const end = Number.isFinite(v.duration) ? v.duration : seconds;
        v.currentTime = Math.max(0, Math.min(seconds, end - 0.25));
        setTime(v.currentTime);
    }, []);

    const skip = useCallback(
        (by: number) => {
            poke();
            seekTo((videoRef.current?.currentTime ?? 0) + by);
        },
        [poke, seekTo],
    );

    const nextSpeed = () => {
        const v = videoRef.current;
        if (!v) return;
        poke();
        const at = SPEEDS.findIndex((s) => Math.abs(s - v.playbackRate) < 0.01);
        v.playbackRate = SPEEDS[(at + 1) % SPEEDS.length];
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        poke();
        v.muted = !v.muted;
        if (!v.muted && v.volume === 0) v.volume = 0.6;
    };

    const retry = () => {
        const v = videoRef.current;
        if (!v) return;
        setFailed(false);
        v.load();
        v.play().catch(() => {});
    };

    // ── Full screen ─────────────────────────────────────────────────────────
    const enterFullscreen = useCallback(async () => {
        const box = boxRef.current;
        poke();
        if (box?.requestFullscreen && document.fullscreenEnabled) {
            try {
                await box.requestFullscreen({ navigationUI: 'hide' });
                setMode('browser');
                if (aspect > 1) {
                    const orientation = screen.orientation as ScreenOrientation & {
                        lock?: (to: string) => Promise<void>;
                    };
                    await orientation?.lock?.('landscape').catch(() => {});
                }
                return;
            } catch {
                // Refused: fill the page instead.
            }
        }
        setMode('page');
    }, [aspect, poke]);

    const exitFullscreen = useCallback(() => {
        poke();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        setMode('inline');
    }, [poke]);

    const toggleFullscreen = () => (mode === 'inline' ? enterFullscreen() : exitFullscreen());

    useEffect(() => {
        const onChange = () => {
            if (document.fullscreenElement !== boxRef.current) {
                setMode((m) => (m === 'browser' ? 'inline' : m));
            }
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    // Filling the page: the page behind must not scroll, and Escape leaves.
    useEffect(() => {
        if (mode !== 'page') return;
        const before = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') setMode('inline');
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = before;
            window.removeEventListener('keydown', onKey);
        };
    }, [mode]);

    const fullscreen = mode !== 'inline';
    const rotated = mode === 'page' && viewport.h > viewport.w && aspect > 1.05;

    // ── Taps and clicks on the video itself ─────────────────────────────────
    const lastTap = useRef<{ side: Side; at: number } | null>(null);
    const pendingTap = useRef<number | null>(null);
    const [burst, setBurst] = useState<{ side: Side; seconds: number; key: number } | null>(null);

    useEffect(() => () => {
        if (pendingTap.current) window.clearTimeout(pendingTap.current);
    }, []);
    useEffect(() => {
        if (!burst) return;
        const t = window.setTimeout(() => setBurst(null), 700);
        return () => window.clearTimeout(t);
    }, [burst]);

    const toggleShown = () => {
        if (visible && !keepShown) setShown(false);
        else poke();
    };

    const onSurfaceUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        // A mouse click plays or pauses, as on any video site; a double click
        // is full screen (`onDoubleClick`).
        if (e.pointerType === 'mouse') {
            togglePlay();
            return;
        }
        // A tap shows or hides the controls; two quick taps on the left or
        // right third skip, and each further quick tap skips ten more.
        const rect = e.currentTarget.getBoundingClientRect();
        const along = rotated ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
        const side: Side | null = along < 1 / 3 ? 'back' : along > 2 / 3 ? 'forward' : null;
        if (!side) {
            toggleShown();
            return;
        }
        const now = Date.now();
        const prev = lastTap.current;
        lastTap.current = { side, at: now };
        if (prev && prev.side === side && now - prev.at < DOUBLE_TAP_MS) {
            if (pendingTap.current) window.clearTimeout(pendingTap.current);
            pendingTap.current = null;
            seekTo((videoRef.current?.currentTime ?? 0) + (side === 'back' ? -SKIP_SECONDS : SKIP_SECONDS));
            setBurst((b) => ({
                side,
                seconds: (b && b.side === side ? b.seconds : 0) + SKIP_SECONDS,
                key: now,
            }));
            return;
        }
        if (pendingTap.current) window.clearTimeout(pendingTap.current);
        pendingTap.current = window.setTimeout(() => {
            pendingTap.current = null;
            toggleShown();
        }, DOUBLE_TAP_MS);
    };

    // ── Keyboard ────────────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        // Space and Enter on a focused button press that button. The seek
        // bar keeps its own arrow keys.
        const target = e.target as HTMLElement;
        if (target !== e.currentTarget && (e.key === ' ' || e.key === 'Enter')) return;
        const v = videoRef.current;
        let handled = true;
        switch (e.key.toLowerCase()) {
            case ' ':
            case 'k':
                togglePlay();
                break;
            case 'j':
            case 'arrowleft':
                skip(-SKIP_SECONDS);
                break;
            case 'l':
            case 'arrowright':
                skip(SKIP_SECONDS);
                break;
            case 'f':
                toggleFullscreen();
                break;
            case 'm':
                toggleMute();
                break;
            case 'home':
                if (v) seekTo(0);
                break;
            case 'end':
                if (v && Number.isFinite(v.duration)) seekTo(v.duration);
                break;
            default:
                handled = false;
        }
        if (handled) e.preventDefault();
    };

    // ── Layout ──────────────────────────────────────────────────────────────
    const size = sizesFor(box.w, box.h);
    const position = scrub !== null ? scrub * duration : time;
    const progress = duration > 0 ? Math.min(1, position / duration) : 0;
    const showSpinner = waiting && playing && !failed;

    let boxStyle: CSSProperties | undefined;
    if (rotated) {
        // A quarter turn clockwise about the top left, then moved back on
        // screen: the top of the video ends up along the right edge.
        boxStyle = {
            position: 'fixed',
            top: 0,
            left: 0,
            width: viewport.h,
            height: viewport.w,
            transform: `translateX(${viewport.w}px) rotate(90deg)`,
            transformOrigin: 'top left',
        };
    }

    return (
        <div
            ref={boxRef}
            tabIndex={0}
            role="region"
            aria-label={title ? `Video: ${title}` : 'Video player'}
            onKeyDown={onKeyDown}
            onPointerMove={(e) => {
                if (e.pointerType === 'mouse') poke();
            }}
            onMouseLeave={() => {
                if (!keepShown) setShown(false);
            }}
            // Tabbing onto a control brings the controls back.
            onFocus={poke}
            style={boxStyle}
            className={[
                'group/player relative overflow-hidden bg-black text-[#FDFAF5] outline-none select-none',
                'focus-visible:ring-2 focus-visible:ring-[#FFC857]',
                mode === 'page' ? 'z-[1000]' : '',
                mode === 'page' && !rotated ? 'fixed inset-0' : '',
                mode === 'inline' ? `h-full w-full ${className}` : '',
                mode === 'browser' ? 'h-full w-full' : '',
                fullscreen && !visible ? 'cursor-none' : '',
            ].join(' ')}
        >
            <canvas
                ref={backdropRef}
                aria-hidden
                className={`pointer-events-none absolute inset-0 h-full w-full scale-110 blur-2xl brightness-[0.55] saturate-150 transition-opacity duration-500 ${letterboxed && backdropReady ? 'opacity-100' : 'opacity-0'}`}
            />
            <video
                ref={videoRef}
                src={src}
                poster={poster || undefined}
                preload="metadata"
                playsInline
                className="absolute inset-0 h-full w-full object-contain"
            />

            {/* Taps and clicks on the picture. */}
            <div
                className="absolute inset-0"
                onPointerUp={onSurfaceUp}
                onDoubleClick={toggleFullscreen}
                aria-hidden
            />

            {burst && (
                <div
                    key={burst.key}
                    className={[
                        'pointer-events-none absolute inset-y-0 flex w-[34%] flex-col items-center justify-center gap-1.5',
                        'skip-flash bg-[#FDFAF5]/15 text-sm font-semibold',
                        burst.side === 'back' ? 'left-0 rounded-r-full' : 'right-0 rounded-l-full',
                    ].join(' ')}
                >
                    <PlayerIcon name={burst.side === 'back' ? 'rushBack' : 'rushForward'} size={26} />
                    {burst.seconds} seconds
                </div>
            )}

            {showSpinner && !visible && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <PlayerSpinner size={size.play * 0.5} />
                </div>
            )}

            {/* While the controls are hidden, a thin line still shows how far in. */}
            {!fullscreen && (
                <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-[#FDFAF5]/30 transition-opacity duration-200 ${visible ? 'opacity-0' : 'opacity-100'}`}
                >
                    <div className="h-full bg-[#FFC857]" style={{ width: `${progress * 100}%` }} />
                </div>
            )}

            {/* ── The controls ─────────────────────────────────────────── */}
            {/* Not a target itself, so clicks between the controls reach the
                picture; hidden, none of the controls are targets either. */}
            <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ease-out motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0 [&_*]:!pointer-events-none'}`}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/55 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" />

                {fullscreen && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-3 sm:px-5 sm:pt-4">
                        <GlassButton label="Leave full screen" size={size.small} onClick={exitFullscreen}>
                            <PlayerIcon name="close" size={size.small * 0.56} />
                        </GlassButton>
                        {title && <p className="min-w-0 flex-1 truncate text-base font-semibold">{title}</p>}
                    </div>
                )}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {failed ? (
                        <div className="pointer-events-auto flex flex-col items-center gap-3 px-6 text-center">
                            <p className="text-sm font-medium">
                                This video stopped loading. Check your connection, then try again.
                            </p>
                            <button
                                type="button"
                                onClick={retry}
                                className="h-11 rounded-full bg-[#FDFAF5] px-5 text-sm font-semibold text-[#1C1916] transition-transform active:scale-95"
                            >
                                Try again
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center" style={{ gap: size.gap }}>
                            <SkipButton side="back" size={size.skip} onClick={() => skip(-SKIP_SECONDS)} />
                            <button
                                type="button"
                                onClick={togglePlay}
                                aria-label={ended ? 'Play again' : playing ? 'Pause' : 'Play'}
                                className="pointer-events-auto flex items-center justify-center rounded-full bg-[#FDFAF5] text-[#1C1916] shadow-lg transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
                                style={{ width: size.play, height: size.play }}
                            >
                                {showSpinner ? (
                                    <PlayerSpinner size={size.play * 0.36} />
                                ) : (
                                    <PlayerIcon name={ended ? 'replay' : playing ? 'pause' : 'play'} size={size.play * 0.5} />
                                )}
                            </button>
                            <SkipButton side="forward" size={size.skip} onClick={() => skip(SKIP_SECONDS)} />
                        </div>
                    )}
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-3 pb-1.5 sm:px-4">
                    <div className="flex items-center gap-1">
                        <p
                            className="min-w-0 flex-1 truncate font-semibold tabular-nums"
                            style={{ fontSize: size.text }}
                        >
                            {clock(position)}
                            <span className="text-[#FDFAF5]/70"> / {clock(duration)}</span>
                        </p>
                        <VolumeControl
                            muted={muted}
                            volume={volume}
                            onToggle={toggleMute}
                            onChange={(value) => {
                                const v = videoRef.current;
                                if (!v) return;
                                poke();
                                v.volume = value;
                                v.muted = value === 0;
                            }}
                        />
                        <button
                            type="button"
                            onClick={nextSpeed}
                            aria-label={`Playback speed ${speedLabel(rate)}. Change the speed`}
                            className={`pointer-events-auto h-9 min-w-12 rounded-full bg-[#141210]/55 px-3 text-[13px] font-semibold backdrop-blur-sm transition-colors hover:bg-[#141210]/75 ${rate !== 1 ? 'text-[#FFC857]' : ''}`}
                        >
                            {speedLabel(rate)}
                        </button>
                        <GlassButton
                            label={fullscreen ? 'Leave full screen' : 'Full screen'}
                            size={36}
                            onClick={toggleFullscreen}
                        >
                            <PlayerIcon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} size={20} />
                        </GlassButton>
                    </div>
                    <SeekBar
                        position={position}
                        buffered={buffered}
                        duration={duration}
                        rotated={rotated}
                        scrub={scrub}
                        onScrub={(f) => {
                            setScrub(f);
                            poke();
                        }}
                        onCommit={(f) => {
                            setScrub(null);
                            if (duration > 0) seekTo(f * duration);
                            poke();
                        }}
                        onStep={(by) => skip(by)}
                    />
                </div>
            </div>
        </div>
    );
}

// ── The seek bar ─────────────────────────────────────────────────────────────

/**
 * Drag or click along it. It previews while held and seeks once on release,
 * so a slow connection is not asked for every frame in between. With a mouse
 * it also shows the time under the pointer.
 */
function SeekBar({
    position,
    buffered,
    duration,
    rotated,
    scrub,
    onScrub,
    onCommit,
    onStep,
}: {
    position: number;
    buffered: number;
    duration: number;
    rotated: boolean;
    scrub: number | null;
    onScrub: (fraction: number) => void;
    onCommit: (fraction: number) => void;
    onStep: (by: number) => void;
}) {
    const [hover, setHover] = useState<number | null>(null);

    const fractionAt = (e: ReactPointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Turned a quarter turn, the bar runs down the screen.
        const f = rotated ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
        return Math.min(1, Math.max(0, f));
    };

    const shown = scrub ?? (duration > 0 ? Math.min(1, position / duration) : 0);
    const loaded = duration > 0 ? Math.min(1, buffered / duration) : 0;
    const label = scrub ?? hover;

    return (
        <div
            role="slider"
            tabIndex={0}
            aria-label="Position"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(position)}
            aria-valuetext={`${clock(position)} of ${clock(duration)}`}
            onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onStep(-SKIP_SECONDS);
                else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onStep(SKIP_SECONDS);
                else return;
                e.preventDefault();
                e.stopPropagation();
            }}
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onScrub(fractionAt(e));
            }}
            onPointerMove={(e) => {
                if (scrub !== null) onScrub(fractionAt(e));
                else if (e.pointerType === 'mouse') setHover(fractionAt(e));
            }}
            onPointerUp={(e) => {
                if (scrub !== null) onCommit(fractionAt(e));
            }}
            onPointerCancel={() => {
                if (scrub !== null) onCommit(scrub);
            }}
            onPointerLeave={() => setHover(null)}
            className="group/seek pointer-events-auto relative flex h-7 cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#FFC857]"
        >
            {label !== null && duration > 0 && (
                <div
                    className="pointer-events-none absolute bottom-7 -translate-x-1/2 rounded-full bg-[#FDFAF5] px-2.5 py-1 text-[13px] font-semibold tabular-nums text-[#1C1916] shadow"
                    style={{ left: `${label * 100}%` }}
                >
                    {clock(label * duration)}
                </div>
            )}
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-[#FDFAF5]/30 transition-[height] duration-150 group-hover/seek:h-1.5">
                <div className="absolute inset-y-0 left-0 bg-[#FDFAF5]/50" style={{ width: `${loaded * 100}%` }} />
                <div className="absolute inset-y-0 left-0 bg-[#FFC857]" style={{ width: `${shown * 100}%` }} />
            </div>
            <div
                className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FDFAF5] shadow transition-transform duration-150 ease-out ${scrub !== null ? 'scale-[1.45]' : 'group-hover/seek:scale-110'}`}
                style={{ left: `${shown * 100}%` }}
            />
        </div>
    );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function GlassButton({
    label,
    size,
    onClick,
    children,
}: {
    label: string;
    size: number;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="pointer-events-auto flex shrink-0 items-center justify-center rounded-full bg-[#141210]/55 backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-[#141210]/75 active:scale-95"
            style={{ width: size, height: size }}
        >
            {children}
        </button>
    );
}

function SkipButton({ side, size, onClick }: { side: Side; size: number; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={side === 'back' ? 'Back 10 seconds' : 'Forward 10 seconds'}
            className="pointer-events-auto relative flex items-center justify-center rounded-full bg-[#141210]/55 backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-[#141210]/75 active:scale-95"
            style={{ width: size, height: size }}
        >
            <PlayerIcon name={side === 'back' ? 'skipBack' : 'skipForward'} size={size * 0.7} />
        </button>
    );
}

/** Sound on and off, with a slider beside it on a computer. Phones use their own buttons. */
function VolumeControl({
    muted,
    volume,
    onToggle,
    onChange,
}: {
    muted: boolean;
    volume: number;
    onToggle: () => void;
    onChange: (value: number) => void;
}) {
    const silent = muted || volume === 0;
    return (
        <div className="group/volume pointer-events-auto flex items-center">
            <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={silent ? 0 : volume}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label="Volume"
                className="hidden w-0 accent-[#FFC857] opacity-0 transition-all duration-200 [@media(hover:hover)]:block group-hover/volume:w-20 group-hover/volume:opacity-100 focus-visible:w-20 focus-visible:opacity-100"
            />
            <GlassButton label={silent ? 'Turn the sound on' : 'Mute'} size={36} onClick={onToggle}>
                <PlayerIcon name={silent ? 'muted' : 'sound'} size={20} />
            </GlassButton>
        </div>
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function speedLabel(rate: number): string {
    return `${Number(rate.toFixed(2))}×`;
}

/**
 * Button and text sizes for the player's size: a card, a wide column, full
 * screen. A short player counts as narrower, so a wide, low card does not get
 * buttons that crowd it from top to bottom.
 */
function sizesFor(w: number, h: number) {
    const width = h > 0 ? Math.min(w, h * 1.4) : w;
    if (width >= 700) return { play: 76, skip: 56, small: 44, gap: 40, text: 15 };
    if (width >= 380) return { play: 64, skip: 48, small: 40, gap: 28, text: 13 };
    return { play: 54, skip: 42, small: 36, gap: 20, text: 12 };
}
