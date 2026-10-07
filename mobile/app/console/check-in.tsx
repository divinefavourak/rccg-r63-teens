import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  Vibration,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';

import { keys, scanTicket, useCheckInSearch, useCheckInToday } from '../../src/api/queries';
import type { CheckInAttendee, CheckInEvent, CheckInResult } from '../../src/api/types';
import { Icon } from '../../src/components/Icon';
import { useDebounced } from '../../src/data/debounce';
import { dayLabel, formatNaira, timeLabel } from '../../src/data/events';
import { isOffline, useCheckInQueue } from '../../src/state/checkinQueue';
import { useTeacherTools } from '../../src/state/teacher';
import { Object3D, type ObjectName } from '../../src/ui/art';
import { Avatar, colourFor, POP_BG } from '../../src/ui/cards';
import { SearchField } from '../../src/ui/inputs';
import { Press, Spinner } from '../../src/ui/Press';
import { HEADER_GAP, Sheet } from '../../src/ui/screen';
import { POP, type PopColour } from '../../src/theme/tokens';

/**
 * The scanner is a dark room in both themes: a viewfinder reads best on black,
 * and the volunteer is often outdoors in bright light.
 */
const INK = '#1C1916';
const ON_INK = '#FDFAF5';

/**
 * What the screen shows after a scan: the server's answer, or one of two things
 * only the phone can know. `queued` is a scan saved because there was no
 * signal; `failed` is a request the server turned down outright.
 */
type Result =
  | CheckInResult
  | { outcome: 'queued'; attendee: null }
  | { outcome: 'failed'; attendee: null; message: string };

/**
 * Check-in (Figma "Check-in · Scanner" and its result screens).
 *
 * Every scan ends on a full-colour screen that says what happened in one large
 * line, because the volunteer is looking at a teen, not at the phone. The
 * colour and the object change with the outcome; the words never rely on them.
 */
export default function CheckInScreen() {
  const params = useLocalSearchParams<{ event?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const tools = useTeacherTools();

  const today = useCheckInToday(tools.checkIn);
  const event = today.data?.find((e) => e.id === params.event) ?? today.data?.[0];

  const [counts, setCounts] = useState<CheckInResult['counts'] | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  // Where in the viewfinder the code was seen, so the frame can close on it.
  const [seen, setSeen] = useState<Box | null>(null);
  const [finder, setFinder] = useState({ width: 0, height: 0 });

  const queue = useCheckInQueue(event?.id, setCounts);

  // One camera frame holds the same code many times over. Until the result is
  // dismissed, nothing else is read.
  const locked = useRef(false);
  useEffect(() => {
    locked.current = busy || !!result || searching;
  }, [busy, result, searching]);

  const close = () => {
    // Teacher home shows these counts too; they have changed.
    qc.invalidateQueries({ queryKey: keys.checkInToday });
    if (router.canGoBack()) router.back();
    else router.replace('/console');
  };

  const submit = useCallback(
    async (code: string, method: 'qr_scan' | 'manual') => {
      if (!event || locked.current) return;
      locked.current = true;
      setBusy(true);
      setSearching(false);
      try {
        // A scanned code is held in the frame for a beat before the answer
        // takes over the screen. On a fast connection the reply lands before
        // the eye has seen the frame close, and the capture is what tells the
        // volunteer the ticket was read.
        const [answer] = await Promise.all([
          scanTicket(event.id, code, method),
          new Promise((done) => setTimeout(done, method === 'qr_scan' ? CAPTURE_MS : 0)),
        ]);
        setCounts(answer.counts);
        setResult(answer);
        // A request got through, so anything saved earlier can go now too.
        queue.flush();
      } catch (error) {
        if (isOffline(error)) {
          await queue.add(code, method);
          setResult({ outcome: 'queued', attendee: null });
        } else {
          // The server turned the request down. Say so where a result would
          // go, rather than leaving the scanner looking idle.
          setResult({
            outcome: 'failed',
            attendee: null,
            message: error instanceof Error ? error.message : '',
          });
        }
      } finally {
        setBusy(false);
      }
    },
    [event, queue],
  );

  const next = () => {
    setResult(null);
    setSeen(null);
  };

  const onFinderLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFinder({ width, height });
  }, []);

  const onCode = useCallback(
    (scan: BarcodeScanningResult) => {
      if (locked.current) return;
      setSeen(boxAround(scan, finder));
      // A short tick, so the volunteer feels the capture without looking.
      // Android only: iOS has one long buzz and nothing shorter here.
      if (Platform.OS === 'android') Vibration.vibrate(30);
      submit(scan.data, 'qr_scan');
    },
    [finder, submit],
  );

  if (!tools.checkIn || (!today.isPending && !event)) {
    return (
      <Room top={insets.top} bottom={insets.bottom} onClose={close} title="Check-in">
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name="calendar" size={40} color={ON_INK} />
          <Text className="text-center font-ui-b text-[20px] leading-7" style={{ color: ON_INK }}>
            {!tools.checkIn
              ? 'Check-in is for the people on the door'
              : today.isError
                ? 'We couldn’t check for events'
                : 'No event today'}
          </Text>
          <Text
            className="text-center font-ui text-[16px] leading-6"
            style={{ color: ON_INK, opacity: 0.7 }}
          >
            {!tools.checkIn
              ? 'Ask your coordinator if you should be helping here.'
              : today.isError
                ? 'Check your connection, then open check-in again.'
                : 'Check-in opens here on the day of an event.'}
          </Text>
        </View>
      </Room>
    );
  }

  const shown = counts ?? (event ? { registered: event.registered, checked_in: event.checked_in } : ZERO);

  return (
    <Room
      top={insets.top}
      bottom={0}
      onClose={close}
      title={event?.title ?? 'Check-in'}
      subtitle={event ? ['Check-in', event.venue].filter(Boolean).join(' · ') : undefined}
      counter={event ? shown : undefined}
    >
      {(queue.waiting > 0 || queue.refused > 0) && (
        <Pressable
          onPress={queue.refused > 0 ? queue.clearRefused : undefined}
          accessibilityRole="alert"
          className="w-full flex-row items-center gap-2 px-5 py-2"
          style={{ backgroundColor: POP.amber }}
        >
          <Icon name="cloudOffline" size={16} color={POP.on} />
          <Text className="flex-1 font-ui-sb text-[12px] leading-4 text-pop-on">
            {queue.waiting > 0
              ? `Offline. ${queue.waiting} ${
                  queue.waiting === 1 ? 'scan' : 'scans'
                } queued, they’ll sync by themselves.`
              : `${queue.refused} saved ${
                  queue.refused === 1 ? 'scan was' : 'scans were'
                } not good tickets. Search those names to see why. Tap to dismiss.`}
          </Text>
        </Pressable>
      )}

      {/* ── Viewfinder ─────────────────────────────────────────────────── */}
      <View className="flex-1 overflow-hidden" onLayout={onFinderLayout}>
        {/* Kept open under the result. Closing it for each answer meant
            starting the camera again for every ticket, which on a cheap phone
            is most of a second of black screen with a queue waiting. While a
            result is up it simply stops listening for codes. */}
        {permission?.granted && Platform.OS !== 'web' && (
          <CameraView
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={result ? undefined : onCode}
          />
        )}
        {finder.width > 0 && (
          <ScanFrame
            finder={finder}
            // Held on the code while the answer is fetched; a search by name
            // has no code to hold, so the frame closes in the middle instead.
            target={seen ?? (busy ? centred(finder, LOCKED_SIZE) : null)}
            busy={busy || today.isPending}
          />
        )}
      </View>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <View className="gap-3 px-5 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        {permission && !permission.granted ? (
          <>
            <Text className="text-center font-ui text-[16px] leading-6" style={{ color: ON_INK }}>
              {permission.canAskAgain
                ? 'Faith Tribe needs the camera to scan tickets.'
                : 'The camera is turned off for Faith Tribe. Turn it on in your phone’s settings, or search by name below.'}
            </Text>
            <Press
              onPress={() =>
                permission.canAskAgain ? requestPermission() : Linking.openSettings()
              }
              accessibilityLabel={permission.canAskAgain ? 'Allow camera' : 'Open phone settings'}
              className="h-14 w-full items-center justify-center rounded-full bg-pop-green"
            >
              <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">
                {permission.canAskAgain ? 'Allow camera' : 'Open phone settings'}
              </Text>
            </Press>
          </>
        ) : (
          <Text className="text-center font-ui text-[16px] leading-6" style={{ color: ON_INK }}>
            Point the camera at the ticket’s QR code
          </Text>
        )}

        <Press
          onPress={() => setSearching(true)}
          scaleTo={0.985}
          accessibilityLabel="Search name or ticket number"
          className="h-14 w-full flex-row items-center gap-2.5 rounded-full px-5"
          style={{ backgroundColor: ON_INK }}
        >
          <Icon name="search" size={20} color={INK} />
          <Text className="font-ui text-[16px] leading-6" style={{ color: INK }}>
            Search name or ticket number
          </Text>
        </Press>
      </View>

      <SearchSheet
        event={event}
        visible={searching}
        onClose={() => setSearching(false)}
        onPick={(attendee) => {
          // The sheet is leaving; let the lock go so this one submits.
          locked.current = false;
          submit(attendee.registration_id, 'manual');
        }}
      />

      {result && (
        <ResultScreen
          result={result}
          top={insets.top}
          bottom={insets.bottom}
          onNext={next}
          onSearch={() => {
            setResult(null);
            setSeen(null);
            setSearching(true);
          }}
        />
      )}
    </Room>
  );
}

const ZERO = { registered: 0, checked_in: 0 };
/** How long a captured code stays in the frame before its result shows. */
const CAPTURE_MS = 450;

/** The dark room: a close button, the event, and the running count. */
function Room({
  top,
  bottom,
  title,
  subtitle,
  counter,
  onClose,
  children,
}: {
  top: number;
  bottom: number;
  title: string;
  subtitle?: string;
  counter?: { registered: number; checked_in: number };
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-1" style={{ backgroundColor: INK, paddingBottom: bottom }}>
      <StatusBar style="light" />
      <View
        className="flex-row items-center gap-3 pb-2 pl-4 pr-5"
        style={{ paddingTop: top + HEADER_GAP }}
      >
        <Press
          onPress={onClose}
          accessibilityLabel="Close check-in"
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(253, 250, 245, 0.14)' }}
        >
          <Icon name="close" size={20} color={ON_INK} />
        </Press>
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            accessibilityRole="header"
            className="font-ui-b text-[20px] leading-7 tracking-[-0.2px]"
            style={{ color: ON_INK }}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text
              numberOfLines={1}
              className="font-ui-md text-[12px] leading-4"
              style={{ color: ON_INK, opacity: 0.7 }}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {counter && (
          <View
            accessible
            accessibilityLabel={`${counter.checked_in} of ${counter.registered} checked in`}
            className="items-center rounded-2xl bg-pop-green px-3.5 py-1.5"
          >
            <Text className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-pop-on">
              {counter.checked_in}
            </Text>
            <Text className="font-ui-md text-[12px] leading-4 text-pop-on">
              of {counter.registered}
            </Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

interface Box {
  x: number;
  y: number;
  size: number;
}

/** The frame at rest, as drawn. */
const IDLE_SIZE = 240;
/** The frame once it has something, when the camera did not say where. */
const LOCKED_SIZE = 190;
/** Never smaller than this: the corners are 64 long and must not cross. */
const MIN_SIZE = 136;

function centred(finder: { width: number; height: number }, size: number): Box {
  return { x: (finder.width - size) / 2, y: (finder.height - size) / 2, size };
}

/**
 * A square round the code the camera just read, in the viewfinder's own
 * points.
 *
 * The camera reports where the code is, but not dependably: the box can be
 * empty, or cover only part of the code (the library's own notes say so). If
 * what comes back is not a believable square inside the viewfinder, the frame
 * closes on the middle instead, which is where a ticket is held anyway.
 */
function boxAround(scan: BarcodeScanningResult, finder: { width: number; height: number }): Box {
  const fallback = centred(finder, LOCKED_SIZE);
  const origin = scan.bounds?.origin;
  const extent = scan.bounds?.size;
  if (!origin || !extent) return fallback;

  const side = Math.max(extent.width, extent.height);
  const cx = origin.x + extent.width / 2;
  const cy = origin.y + extent.height / 2;
  const believable =
    side >= 40 &&
    side <= Math.min(finder.width, finder.height) &&
    cx > 0 &&
    cx < finder.width &&
    cy > 0 &&
    cy < finder.height;
  if (!believable) return fallback;

  // A little air round the code, so the corners frame it instead of covering it.
  const size = Math.max(MIN_SIZE, Math.min(side + 36, Math.min(finder.width, finder.height) - 24));
  return {
    x: Math.max(8, Math.min(cx - size / 2, finder.width - size - 8)),
    y: Math.max(8, Math.min(cy - size / 2, finder.height - size - 8)),
    size,
  };
}

const CORNER = { position: 'absolute', width: 64, height: 64, borderColor: POP.green } as const;
const STROKE = 8;
const RADIUS = 28;
const EASE = Easing.out(Easing.cubic);

/**
 * Four green corners and a line (Figma "scan frame"), alive.
 *
 * Looking: the corners breathe in and out and a line sweeps down, so the
 * screen is plainly doing something. Found: the breathing stops and the frame
 * closes on the code and fills with a wash of green, the way a camera shows it
 * has focus. That moment matters at a door: the volunteer knows the ticket was
 * read before the answer has come back from the server.
 *
 * All of it is timed and eased, with no bounce, and none of it runs for
 * someone who has asked their phone for less motion: the frame then simply
 * steps to the code.
 */
function ScanFrame({
  finder,
  target,
  busy,
}: {
  finder: { width: number; height: number };
  /** Where to close in, or null to keep looking. */
  target: Box | null;
  busy: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const rest = centred(finder, IDLE_SIZE);
  const found = target !== null;
  const box = target ?? rest;

  const x = useSharedValue(rest.x);
  const y = useSharedValue(rest.y);
  const size = useSharedValue(rest.size);
  /** 0 while looking, 1 once held on a code. */
  const hold = useSharedValue(0);
  /** 0 to 1 and back, for as long as it is looking. */
  const pulse = useSharedValue(0);
  /** 0 at the top of the frame, 1 at the bottom. */
  const sweep = useSharedValue(0);

  useEffect(() => {
    // Closing in is quick, like a shutter; letting go is slower and calmer.
    const duration = reduceMotion ? 0 : found ? 180 : 320;
    x.value = withTiming(box.x, { duration, easing: EASE });
    y.value = withTiming(box.y, { duration, easing: EASE });
    size.value = withTiming(box.size, { duration, easing: EASE });
    hold.value = withTiming(found ? 1 : 0, { duration, easing: EASE });
  }, [box.x, box.y, box.size, found, reduceMotion, x, y, size, hold]);

  useEffect(() => {
    if (found || reduceMotion) {
      cancelAnimation(pulse);
      cancelAnimation(sweep);
      pulse.value = withTiming(0, { duration: 120 });
      return;
    }
    const slow = Easing.inOut(Easing.quad);
    pulse.value = withRepeat(withTiming(1, { duration: 750, easing: slow }), -1, true);
    sweep.value = withRepeat(withTiming(1, { duration: 1700, easing: slow }), -1, true);
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(sweep);
    };
  }, [found, reduceMotion, pulse, sweep]);

  const frame = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: size.value,
    height: size.value,
    transform: [{ scale: 1 + pulse.value * 0.035 }],
  }));
  // The corners dim as the frame swells and come back as it settles: the beat.
  const corners = useAnimatedStyle(() => ({ opacity: 1 - pulse.value * 0.45 }));
  const wash = useAnimatedStyle(() => ({ opacity: hold.value * 0.22 }));
  const line = useAnimatedStyle(() => ({
    opacity: (1 - hold.value) * 0.85,
    transform: [{ translateY: 20 + sweep.value * (size.value - 43) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, frame]}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: RADIUS, backgroundColor: POP.green },
          wash,
        ]}
      />
      <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, corners]}>
        <View
          style={{ ...CORNER, left: 0, top: 0, borderLeftWidth: STROKE, borderTopWidth: STROKE, borderTopLeftRadius: RADIUS }}
        />
        <View
          style={{ ...CORNER, right: 0, top: 0, borderRightWidth: STROKE, borderTopWidth: STROKE, borderTopRightRadius: RADIUS }}
        />
        <View
          style={{ ...CORNER, left: 0, bottom: 0, borderLeftWidth: STROKE, borderBottomWidth: STROKE, borderBottomLeftRadius: RADIUS }}
        />
        <View
          style={{ ...CORNER, right: 0, bottom: 0, borderRightWidth: STROKE, borderBottomWidth: STROKE, borderBottomRightRadius: RADIUS }}
        />
      </Animated.View>

      {!reduceMotion && (
        <Animated.View
          style={[
            { position: 'absolute', left: 38, right: 38, top: 0, height: 3, borderRadius: 2, backgroundColor: ON_INK },
            line,
          ]}
        />
      )}

      {busy && (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={28} color={ON_INK} />
        </View>
      )}
    </Animated.View>
  );
}

// ─── Results ───────────────────────────────────────────────────────────────

interface Look {
  colour: PopColour;
  object: ObjectName;
  title: string;
  body: string;
  /** Offer "Search by name" as the main way forward. */
  search?: boolean;
}

function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}

function lookFor(result: Result): Look {
  switch (result.outcome) {
    case 'checked_in': {
      const name = firstName(result.attendee?.name);
      return {
        colour: 'green',
        object: 'thumb-up',
        title: 'Checked in',
        body: name ? `Welcome, ${name}!` : 'Welcome!',
      };
    }
    case 'already_checked_in': {
      const at = result.checked_in_at ? timeLabel(new Date(result.checked_in_at)) : null;
      const by = result.checked_in_by ? ` by ${result.checked_in_by}` : '';
      return {
        colour: 'amber',
        object: 'bell',
        title: 'Already checked in',
        body: at
          ? `This ticket was scanned at ${at}${by}.`
          : `This ticket has already been scanned${by}.`,
      };
    }
    case 'wrong_event': {
      const other = result.other_event;
      return {
        colour: 'sky',
        object: 'calendar',
        title: 'Different event',
        body: other
          ? `This ticket is for ${other.title} on ${dayLabel(new Date(other.start_datetime))}.`
          : 'This ticket is for another event.',
      };
    }
    case 'not_paid': {
      const amount = formatNaira(result.amount_due);
      return {
        colour: 'amber',
        object: 'lock',
        title: 'Not paid yet',
        body: `The place is held, but ${
          amount ? `the ${amount}` : 'the payment'
        } hasn’t come in. Send them to the registration desk.`,
      };
    }
    case 'cancelled': {
      const on = result.cancelled_at ? ` on ${dayLabel(new Date(result.cancelled_at))}` : '';
      return {
        colour: 'violet',
        object: 'bell',
        title: 'Registration cancelled',
        body: `This ticket was cancelled${on}${result.refunded ? ' and refunded' : ''}.`,
      };
    }
    case 'waitlisted':
      return {
        colour: 'amber',
        object: 'calendar',
        title: 'On the waiting list',
        body: 'This place has not been confirmed yet. Send them to the registration desk.',
      };
    case 'queued':
      return {
        colour: 'lime',
        object: 'notebook',
        title: 'Saved',
        body: 'You’re offline, so we’ve kept this ticket. It will be checked in as soon as you’re back online.',
      };
    case 'failed':
      return {
        colour: 'pink',
        object: 'target',
        title: 'That didn’t go through',
        body: result.message || 'Something went wrong on our side. Scan the ticket again.',
      };
    default:
      return {
        colour: 'pink',
        object: 'target',
        title: 'Ticket not found',
        body: 'This code isn’t one of ours. Try searching by name.',
        search: true,
      };
  }
}

const PAYMENT: Record<string, string> = {
  paid: 'Paid',
  not_required: 'Free',
  pending: 'Pending payment',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

/** The outcome, filling the screen (Figma "Check-in · Success" and its siblings). */
function ResultScreen({
  result,
  top,
  bottom,
  onNext,
  onSearch,
}: {
  result: Result;
  top: number;
  bottom: number;
  onNext: () => void;
  onSearch: () => void;
}) {
  const look = lookFor(result);
  const attendee = result.attendee;

  return (
    <View
      accessibilityViewIsModal
      accessibilityLiveRegion="assertive"
      className={`absolute inset-0 ${POP_BG[look.colour]}`}
      style={{ paddingTop: top }}
    >
      <StatusBar style="dark" />
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Object3D name={look.object} size={140} />
        <Text
          accessibilityRole="header"
          className="text-center font-ui-xb text-[40px] leading-[48px] tracking-[-1.2px] text-pop-on"
        >
          {look.title}
        </Text>
        <Text className="text-center font-ui text-[18px] leading-[30px] text-pop-on">{look.body}</Text>

        {attendee && (
          <View
            className="w-full flex-row items-center gap-3 rounded-2xl py-3 pl-3 pr-4"
            // Cream in both themes: it sits on a colour that does not change.
            style={{ backgroundColor: ON_INK }}
          >
            <Avatar name={attendee.name} photo={attendee.photo} size={56} colour={colourFor(attendee.name)} />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-ui-b text-[17px] leading-6" style={{ color: INK }}>
                {attendee.name}
              </Text>
              <Text className="font-ui-md text-[12px] leading-4" style={{ color: '#4B4540' }}>
                {[attendee.registration_id, PAYMENT[attendee.payment_status], attendee.parish]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View className="gap-1 px-5 pt-3" style={{ paddingBottom: Math.max(bottom, 24) }}>
        {/* Always dark with light text: it sits on a colour in both themes. */}
        <Press
          onPress={look.search ? onSearch : onNext}
          accessibilityLabel={look.search ? 'Search by name' : 'Scan next ticket'}
          className="h-14 w-full items-center justify-center rounded-full bg-pop-on"
        >
          <Text className="font-ui-sb text-[16px] leading-6" style={{ color: ON_INK }}>
            {look.search ? 'Search by name' : 'Scan next ticket'}
          </Text>
        </Press>
        {look.search && (
          <Press
            onPress={onNext}
            accessibilityLabel="Scan again"
            className="h-[52px] w-full items-center justify-center rounded-full"
          >
            <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">Scan again</Text>
          </Press>
        )}
      </View>
    </View>
  );
}

// ─── Search ────────────────────────────────────────────────────────────────

/** Find a ticket by name or number, for the teen whose phone is dead. */
function SearchSheet({
  event,
  visible,
  onClose,
  onPick,
}: {
  event: CheckInEvent | undefined;
  visible: boolean;
  onClose: () => void;
  onPick: (attendee: CheckInAttendee) => void;
}) {
  const [text, setText] = useState('');
  // Ask once typing has paused, not on every letter: this is a slow connection.
  const asked = useDebounced(text);
  useEffect(() => {
    if (!visible) setText('');
  }, [visible]);

  const search = useCheckInSearch(visible ? event?.id : undefined, asked);
  const ready = asked.trim().length >= 2;

  return (
    <Sheet visible={visible} onClose={onClose}>
      {/* `shrink` lets the sheet's height limit reach the list below. */}
      <View className="w-full shrink gap-3 pt-2">
        <Text
          accessibilityRole="header"
          className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
        >
          Find a ticket
        </Text>
        <SearchField label="Name or ticket number" value={text} onChange={setText} autoFocus />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          // Shrinks when the keyboard is up, so the search box stays on screen.
          style={{ maxHeight: 320, flexShrink: 1 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {!ready ? (
            <Text className="py-3 font-ui text-[14px] leading-5 text-ink-2">
              Type at least two letters.
            </Text>
          ) : search.isPending ? (
            <Text className="py-3 font-ui text-[14px] leading-5 text-ink-2">Looking…</Text>
          ) : search.isError ? (
            <Text className="py-3 font-ui text-[14px] leading-5 text-feedback-error">
              We couldn’t search just now. Check your connection and try again.
            </Text>
          ) : search.data?.length === 0 ? (
            <Text className="py-3 font-ui text-[14px] leading-5 text-ink-2">
              Nobody registered for this event matches “{asked.trim()}”.
            </Text>
          ) : (
            search.data?.map((attendee) => (
              <Press
                key={attendee.registration_id}
                onPress={() => onPick(attendee)}
                scaleTo={0.985}
                accessibilityLabel={`Check in ${attendee.name}, ticket ${attendee.registration_id}`}
                className="w-full flex-row items-center gap-3 rounded-xl bg-surf-sunken py-2 pl-2 pr-4"
              >
                <Avatar name={attendee.name} photo={attendee.photo} size={44} colour={colourFor(attendee.name)} />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-ink-1">
                    {attendee.name}
                  </Text>
                  <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-ink-3">
                    {[attendee.registration_id, attendee.parish].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Press>
            ))
          )}
        </ScrollView>
      </View>
    </Sheet>
  );
}
