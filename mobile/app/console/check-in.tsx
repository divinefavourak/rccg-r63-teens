import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useQueryClient } from '@tanstack/react-query';

import { keys, scanTicket, useCheckInSearch, useCheckInToday } from '../../src/api/queries';
import type { CheckInAttendee, CheckInEvent, CheckInResult } from '../../src/api/types';
import { Icon } from '../../src/components/Icon';
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
        const answer = await scanTicket(event.id, code, method);
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

  const next = () => setResult(null);

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
      <View className="flex-1 items-center justify-center overflow-hidden">
        {permission?.granted && Platform.OS !== 'web' && !result && (
          <CameraView
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => submit(data, 'qr_scan')}
          />
        )}
        <ScanFrame busy={busy || today.isPending} />
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
            setSearching(true);
          }}
        />
      )}
    </Room>
  );
}

const ZERO = { registered: 0, checked_in: 0 };

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

/** Four green corners and a line (Figma "scan frame"). */
function ScanFrame({ busy }: { busy: boolean }) {
  const corner = { position: 'absolute', width: 64, height: 64, borderColor: POP.green } as const;
  const WIDTH = 8;
  const RADIUS = 28;

  return (
    <View pointerEvents="none" style={{ width: 240, height: 240 }} className="items-center justify-center">
      <View
        style={{ ...corner, left: 0, top: 0, borderLeftWidth: WIDTH, borderTopWidth: WIDTH, borderTopLeftRadius: RADIUS }}
      />
      <View
        style={{ ...corner, right: 0, top: 0, borderRightWidth: WIDTH, borderTopWidth: WIDTH, borderTopRightRadius: RADIUS }}
      />
      <View
        style={{ ...corner, left: 0, bottom: 0, borderLeftWidth: WIDTH, borderBottomWidth: WIDTH, borderBottomLeftRadius: RADIUS }}
      />
      <View
        style={{ ...corner, right: 0, bottom: 0, borderRightWidth: WIDTH, borderBottomWidth: WIDTH, borderBottomRightRadius: RADIUS }}
      />
      {busy ? (
        <Spinner size={28} color={ON_INK} />
      ) : (
        <View style={{ width: 164, height: 3, borderRadius: 2, backgroundColor: ON_INK, opacity: 0.8 }} />
      )}
    </View>
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
  const [asked, setAsked] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setAsked(text), 350);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(() => {
    if (!visible) setText('');
  }, [visible]);

  const search = useCheckInSearch(visible ? event?.id : undefined, asked);
  const ready = asked.trim().length >= 2;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="w-full gap-3 pt-2">
        <Text
          accessibilityRole="header"
          className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
        >
          Find a ticket
        </Text>
        <SearchField label="Name or ticket number" value={text} onChange={setText} autoFocus />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 320 }}
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
