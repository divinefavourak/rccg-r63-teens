import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { createURL } from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCheckPayment, useMyRegistrations, useStartPayment } from '../../src/api/queries';
import { Icon } from '../../src/components/Icon';
import {
  dayLabel,
  formatNaira,
  payHint,
  payLink,
  startOf,
  ticketStatus,
  timeLabel,
  whereLabel,
} from '../../src/data/events';
import { useAuth } from '../../src/state/auth';
import { useMyPhoto } from '../../src/state/photo';
import { Object3D } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import { BackHeader, EmptyState, Skeleton } from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';
import { ELEVATION } from '../../src/theme/tokens';

/**
 * How often an open ticket asks whether it has been scanned yet. Every teen in
 * the queue at a door has this screen open at once, and each ask returns all of
 * their registrations, so the interval is what the server feels.
 */
const POLL_MS = 15000;
/**
 * How long it keeps asking. Long enough for any queue at a door; short enough
 * that a ticket left open on a table does not ask 700 times an hour all day.
 */
const POLL_FOR_MS = 10 * 60 * 1000;
/** Doors open before the start time; watch from this long beforehand. */
const DOORS_MS = 6 * 60 * 60 * 1000;
/**
 * After someone has been sent to pay, how often and for how long the ticket
 * asks whether the payment has landed. A card is confirmed in seconds; a bank
 * transfer can take a few minutes.
 */
const PAID_POLL_MS = 10000;
const PAID_POLL_FOR_MS = 5 * 60 * 1000;

/**
 * One ticket (Figma "Ticket").
 *
 * The QR holds the registration's own code — a bare identifier, not a link,
 * because the scanner at the door is looking a registration up, not opening a
 * page. It is drawn on the phone, on white whatever the theme: scanners need
 * the contrast, and a dark-mode QR does not read.
 */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { isGuest } = useAuth();
  const photo = useMyPhoto();

  const mine = useMyRegistrations(!isGuest);
  const ticket = (mine.data ?? []).find((r) => r.id === id);
  const event = ticket?.event_detail ?? null;

  const arrived = ticket?.status === 'checked_in' || ticket?.status === 'attended';
  // A ticket that could be scanned any moment now: still good, not yet used,
  // and its event is on or about to be.
  const startsAt = event ? new Date(event.start_datetime).getTime() : null;
  const endsAt = event?.end_datetime ? new Date(event.end_datetime).getTime() : null;
  const atTheDoor =
    !!ticket &&
    !arrived &&
    (ticket.status === 'confirmed' || ticket.status === 'pending') &&
    startsAt !== null &&
    Date.now() > startsAt - DOORS_MS &&
    Date.now() < (endsAt ?? startsAt + DOORS_MS);

  // While the teen is holding this screen up to a scanner, keep asking the
  // server whether the scan went through, so the ticket answers in front of
  // them. A push does the same job faster, but only for those who allowed
  // notifications; this works for everyone, and stops once they are in.
  const { refetch } = mine;
  useEffect(() => {
    if (!atTheDoor) return;
    const until = Date.now() + POLL_FOR_MS;
    const timer = setInterval(() => {
      if (Date.now() > until) {
        clearInterval(timer);
        return;
      }
      // Nobody is being scanned while the phone is in a pocket.
      if (AppState.currentState === 'active') refetch();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [atTheDoor, refetch]);

  // ── Paying ────────────────────────────────────────────────────────────
  // The paying itself happens on Squad's page, in the browser. This screen
  // sends the teen there, and notices when they come back. What marks the
  // ticket paid is Squad telling the server; nothing here decides it.
  const startPayment = useStartPayment(id);
  const checkPayment = useCheckPayment(id);
  const { mutateAsync: openCheckout } = startPayment;
  const { mutate: askSquad } = checkPayment;
  /** True once this screen has sent someone to pay. */
  const [sentToPay, setSentToPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const canPay = !!ticket?.can_pay;
  const justPaid = sentToPay && ticket?.payment_status === 'paid';

  useEffect(() => {
    if (!sentToPay || !canPay) return;
    // Coming back from the browser: ask Squad straight away, for the times
    // its own message to the server has not arrived yet.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') askSquad();
    });
    // Then keep looking for a while, for a transfer that lands a minute later.
    const until = Date.now() + PAID_POLL_FOR_MS;
    const timer = setInterval(() => {
      if (Date.now() > until) {
        clearInterval(timer);
        return;
      }
      if (AppState.currentState === 'active') refetch();
    }, PAID_POLL_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [sentToPay, canPay, askSquad, refetch]);

  const onPay = useCallback(async () => {
    if (!id) return;
    setPayError(null);
    try {
      const checkout = await openCheckout(createURL('/ticket/' + id));
      setSentToPay(true);
      if (Platform.OS === 'web') {
        // The same tab: a new one opened after a network call is a pop-up to
        // Safari, and blocked. Squad's last page links back here.
        window.location.assign(checkout.authorization_url);
      } else {
        await Linking.openURL(checkout.authorization_url);
      }
    } catch (err) {
      setPayError(
        err instanceof Error ? err.message : 'That did not go through. Please try again.',
      );
    }
  }, [id, openCheckout]);

  const onSendToParent = useCallback(() => {
    const link = ticket ? payLink(ticket) : null;
    if (!ticket || !link) return;
    const amount = formatNaira(ticket.amount_due);
    const what = event?.title ?? 'an event';
    // Whoever it is sent to may pay at any time, so start watching for it.
    setSentToPay(true);
    Share.share({
      message: `Please pay for my place at ${what}${amount ? ` (${amount})` : ''}: ${link}`,
    }).catch(() => {});
  }, [ticket, event]);

  const back = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/tribe')),
    [router],
  );

  const onShare = useCallback(() => {
    if (!event) return;
    const start = startOf(event);
    Share.share({
      message: `I’m going to ${event.title}, ${dayLabel(start)} at ${timeLabel(start)}.`,
    }).catch(() => {});
  }, [event]);

  if (mine.isPending && !isGuest) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Your ticket" onBack={back} />
        <View className="px-5 pt-6">
          <Skeleton height={520} radius={28} />
        </View>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Your ticket" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message={
              isGuest
                ? 'Log in to see your tickets.'
                : mine.isError
                  ? 'We couldn’t load your ticket. Check your connection, then try again.'
                  : 'That ticket is not on this account.'
            }
            actionLabel={isGuest ? 'Log in' : mine.isError ? 'Try again' : 'See events'}
            onAction={() =>
              isGuest ? router.push('/log-in') : mine.isError ? mine.refetch() : router.replace('/tribe')
            }
          />
        </View>
      </View>
    );
  }

  const status = ticketStatus(ticket);
  const start = event ? startOf(event) : null;
  const where = event ? whereLabel(event) : null;
  const line = [start ? dayLabel(start) : null, start ? timeLabel(start) : null, where]
    .filter(Boolean)
    .join(' · ');
  const holder = ticket.attendee_name;

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader
        title="Your ticket"
        onBack={back}
        action={event ? { icon: 'shareUp', label: 'Tell a friend', onPress: onShare } : undefined}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: 20,
          // Room for the star that breaks out of the ticket's corner.
          paddingTop: 30,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
      >
        {/* Rounded and filled so the shadow takes the ticket's shape; a bare
            wrapper casts a square one. */}
        <View className="w-full rounded-3xl bg-surf-raised" style={ELEVATION.sheet}>
          {/* ── Stub ──────────────────────────────────────────────────── */}
          <View className="w-full gap-2 rounded-t-3xl bg-pop-green p-5">
            <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[1.92px] text-pop-on">
              Admit one
            </Text>
            <Text
              accessibilityRole="header"
              className="pr-14 font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-pop-on"
            >
              {event?.title ?? 'Your event'}
            </Text>
            {!!line && <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">{line}</Text>}
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-pop-on bg-pop-amber">
                {photo ? (
                  <Image
                    source={photo}
                    contentFit="cover"
                    accessible={false}
                    style={{ width: 36, height: 36 }}
                  />
                ) : (
                  <Text className="font-ui-b text-[14px] leading-5 text-pop-on">
                    {holder.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text numberOfLines={1} className="flex-1 font-ui-sb text-[16px] leading-6 text-pop-on">
                {holder}
              </Text>
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', right: 4, top: -26 }}>
              <Object3D name="star" size={80} />
            </View>
          </View>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <View className="w-full items-center gap-3 rounded-b-3xl bg-surf-raised p-5">
            {/* The perforation. Drawn as dashes rather than a dashed border,
                which Android only honours when all four sides match. */}
            <View accessible={false} className="w-full flex-row justify-between">
              {Array.from({ length: 24 }, (_, i) => (
                <View key={i} className="h-0.5 w-1.5 rounded-full bg-line-strong" />
              ))}
            </View>

            <View className="rounded-lg bg-white p-3">
              <QRCode
                value={ticket.registration_id}
                size={175}
                color="#1C1916"
                backgroundColor="#FFFFFF"
                // Medium correction survives a scuffed or half-lit screen
                // without making the squares too small to scan.
                ecl="M"
              />
            </View>

            <Text
              selectable
              className="text-center font-ui-b text-[17px] leading-6 tracking-[1.36px] text-ink-1"
            >
              {ticket.registration_id}
            </Text>

            <View
              className={`flex-row items-center gap-1 rounded-full py-1.5 pl-2.5 pr-3.5 ${
                status.settled ? 'bg-green-tonal' : 'bg-amber-tonal'
              }`}
            >
              <Icon
                name={status.settled ? 'check' : 'info'}
                size={16}
                color={status.settled ? tokens.green : tokens.caution}
              />
              <Text
                className={`font-ui-sb text-[12px] leading-4 ${
                  status.settled ? 'text-green' : 'text-feedback-caution'
                }`}
              >
                {status.label}
              </Text>
            </View>
          </View>
        </View>

        {!!ticket.bed && (
          <View className="w-full gap-1 rounded-2xl bg-surf-sunken p-4">
            <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[1.92px] text-ink-3">
              Bedspace
            </Text>
            <Text selectable className="font-ui-b text-[17px] leading-6 text-ink-1">
              {ticket.bed.code}, {ticket.bed.hostel}
            </Text>
            {!ticket.bed.is_firm && (
              <Text className="font-ui text-[14px] leading-5 text-ink-2">
                Held for you until the payment is confirmed.
              </Text>
            )}
          </View>
        )}

        {canPay && (
          <View className="w-full gap-3 rounded-2xl bg-surf-sunken p-4">
            <View className="gap-1">
              <Text
                accessibilityRole="header"
                className="font-ui-b text-[17px] leading-6 text-ink-1"
              >
                {formatNaira(ticket.amount_due) ?? 'Payment'} to pay
              </Text>
              <Text className="font-ui text-[14px] leading-5 text-ink-2">{payHint(ticket)}</Text>
            </View>
            {!!payError && (
              <Text
                accessibilityLiveRegion="polite"
                className="font-ui-md text-[14px] leading-5 text-feedback-error"
              >
                {payError}
              </Text>
            )}
            <Button
              label="Pay now"
              onPress={onPay}
              loading={startPayment.isPending}
              className="w-full"
            />
            {!!ticket.pay_token && (
              <Button
                label="Send to a parent to pay"
                variant="secondary"
                onPress={onSendToParent}
                className="w-full"
              />
            )}
            <Text className="text-center font-ui text-[12px] leading-4 text-ink-3">
              {sentToPay
                ? 'This ticket updates by itself once the payment arrives. A transfer can take a few minutes.'
                : 'You pay on Squad by card, bank transfer or USSD.'}
            </Text>
          </View>
        )}

        {justPaid && !arrived && (
          <Animated.View entering={FadeIn.duration(250)}>
            <View
              accessibilityLiveRegion="polite"
              className="w-full flex-row items-center gap-3 rounded-2xl bg-pop-lime py-3 pl-3 pr-4"
            >
              <Object3D name="thumb-up" size={56} />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-ui-b text-[17px] leading-6 text-pop-on">Payment received</Text>
                <Text className="font-ui text-[14px] leading-5 text-pop-on">
                  Your place at {event?.title ?? 'the event'} is confirmed.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {arrived ? (
          // Fades in when the scan lands. The classes sit on the inner view:
          // an animated view drops them on the web preview.
          <Animated.View entering={FadeIn.duration(250)}>
            <View
              accessibilityLiveRegion="polite"
              className="w-full flex-row items-center gap-3 rounded-2xl bg-pop-lime py-3 pl-3 pr-4"
            >
              <Object3D name="thumb-up" size={56} />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-ui-b text-[17px] leading-6 text-pop-on">You’re in</Text>
                <Text className="font-ui text-[14px] leading-5 text-pop-on">
                  Welcome, {holder.trim().split(/\s+/)[0]}. Enjoy {event?.title ?? 'the event'}.
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Text className="text-center font-ui text-[14px] leading-5 text-ink-3">
            Turn your brightness up at the door so the code scans easily.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
