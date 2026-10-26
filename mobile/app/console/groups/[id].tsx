import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createURL } from 'expo-linking';

import { useBatch, useBatchCheckout, useCheckBatchPayment } from '../../../src/api/queries';
import type { BatchDetail, Seat } from '../../../src/api/types';
import {
  BankDetails,
  batchStatus,
  naira,
  ReceiptList,
  ReceiptSheet,
  StatusChip,
} from '../../../src/components/PaymentPieces';
import { dayLabel } from '../../../src/data/events';
import { Button } from '../../../src/ui/Button';
import { StatTile } from '../../../src/ui/cards';
import { BackHeader, EmptyState, SectionTitle, Skeleton } from '../../../src/ui/screen';

/** After the coordinator is sent to pay, how often and how long to look for it. */
const PAID_POLL_MS = 10000;
const PAID_POLL_FOR_MS = 5 * 60 * 1000;

const genderWord = (g: string) => (g === 'male' ? 'Boy' : g === 'female' ? 'Girl' : '');

/** What goes out through the share sheet: every ticket and its code. */
function ticketSheet(group: BatchDetail): string {
  const lines = group.seats
    .filter((s) => s.status !== 'cancelled')
    .map((s, i) =>
      [`${i + 1}. ${s.registration_id}`, s.claim_code, genderWord(s.attendee_gender), s.attendee_name]
        .filter(Boolean)
        .join(' · '),
    );
  return [
    `${group.event_title}: tickets for ${group.node_detail?.name ?? 'our group'} (${group.reference})`,
    '',
    ...lines,
    '',
    'Each teen opens the Faith Tribe app, goes to My tickets, taps "Got a ticket from your coordinator?", and enters their ticket number and code.',
  ].join('\n');
}

/**
 * One group: its seats with their ticket numbers and codes, sharing them, and
 * paying for the group, on Squad or by transfer and a receipt. Naming seats
 * and changing the numbers stay on the web Console.
 */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const group = useBatch(id);
  const checkout = useBatchCheckout(id);
  const check = useCheckBatchPayment(id);
  const [sending, setSending] = useState(false);
  const [sentToPay, setSentToPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const back = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/console/groups')),
    [router],
  );

  // Back from Squad: ask straight away, then keep looking for a while, as the
  // ticket screen does for one place.
  const { mutate: askSquad } = check;
  const { refetch } = group;
  useEffect(() => {
    if (!sentToPay) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') askSquad();
    });
    const until = Date.now() + PAID_POLL_FOR_MS;
    const timer = setInterval(() => {
      if (Date.now() > until) return clearInterval(timer);
      if (AppState.currentState === 'active') refetch();
    }, PAID_POLL_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [sentToPay, askSquad, refetch]);

  const data = group.data;

  const onPay = useCallback(async () => {
    setPayError(null);
    try {
      const page = await checkout.mutateAsync(createURL('/console/groups/' + id));
      setSentToPay(true);
      if (Platform.OS === 'web') window.location.assign(page.authorization_url);
      else await Linking.openURL(page.authorization_url);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'That did not go through. Please try again.');
    }
  }, [checkout, id]);

  const onShare = useCallback(() => {
    if (!data) return;
    Share.share({ message: ticketSheet(data) }).catch(() => {});
  }, [data]);

  if (group.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Group" onBack={back} />
        <View className="gap-4 px-5 pt-4">
          <Skeleton height={120} />
          <Skeleton height={96} />
          <Skeleton height={240} />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Group" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message={
              group.isError
                ? 'We couldn’t load this group. Check your connection, then try again.'
                : 'This group is not one you can see.'
            }
            actionLabel="Try again"
            onAction={() => group.refetch()}
          />
        </View>
      </View>
    );
  }

  const status = batchStatus(data.status);
  const free = Number(data.amount_due) === 0;
  const seats = data.seats.filter((s) => s.status !== 'cancelled');
  const claimed = seats.filter((s) => s.claimed).length;
  const hasCodes = seats.some((s) => !!s.claim_code);
  const owes = !free && Number(data.balance) > 0 && data.status !== 'cancelled';

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader
        title={data.reference}
        onBack={back}
        action={hasCodes ? { icon: 'shareUp', label: 'Share tickets', onPress: onShare } : undefined}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={group.isRefetching} onRefresh={group.refetch} />}
      >
        <View className="gap-1">
          <Text accessibilityRole="header" className="font-ui-b text-[24px] leading-8 text-ink-1">
            {data.event_title}
          </Text>
          <Text className="font-ui text-[14px] leading-5 text-ink-2">
            {[data.node_detail?.name, dayLabel(new Date(data.event_start))].filter(Boolean).join(' · ')}
          </Text>
          <View className="pt-1">
            <StatusChip {...status} />
          </View>
        </View>

        <View className="flex-row gap-3 pt-3">
          <StatTile value={String(data.headcount)} label={`${data.male_count} boys · ${data.female_count} girls`} colour="sky" object="target" />
          <StatTile value={`${claimed}/${seats.length}`} label="Claimed in the app" colour="lime" object="star" />
        </View>

        {!free && (
          <View className="w-full gap-1 rounded-2xl bg-surf-raised p-4">
            <Row label="Total" value={naira(data.amount_due)} />
            <Row label="Paid" value={naira(data.amount_paid)} />
            <Row label="Still to pay" value={naira(data.balance)} strong />
            <Text className="pt-1 font-ui text-[12px] leading-4 text-ink-3">
              {seats.length} × {naira(data.unit_price)}
            </Text>
          </View>
        )}

        {/* ── Paying ─────────────────────────────────────────────────── */}
        {owes && data.can_pay_online && (
          <View className="w-full gap-3 rounded-2xl bg-surf-sunken p-4">
            <Text className="font-ui-b text-[17px] leading-6 text-ink-1">
              Pay {naira(data.balance)} for the group
            </Text>
            <Text className="font-ui text-[14px] leading-5 text-ink-2">
              On Squad by card, bank transfer or USSD. Every seat is confirmed once it is paid.
            </Text>
            {!!payError && (
              <Text accessibilityLiveRegion="polite" className="font-ui-md text-[14px] leading-5 text-feedback-error">
                {payError}
              </Text>
            )}
            <Button label="Pay now" onPress={onPay} loading={checkout.isPending} className="w-full" />
            {sentToPay && (
              <Text className="text-center font-ui text-[12px] leading-4 text-ink-3">
                This page updates by itself once the payment arrives.
              </Text>
            )}
          </View>
        )}

        {data.payment_method === 'manual' && !free && data.status !== 'cancelled' && (
          <View className="w-full gap-3 rounded-2xl bg-surf-sunken p-4">
            {owes && (
              <>
                <Text className="font-ui-b text-[17px] leading-6 text-ink-1">
                  {data.status === 'under_review'
                    ? 'Your receipt is being checked'
                    : `Transfer ${naira(data.balance)}`}
                </Text>
                {data.bank_details && (
                  <BankDetails
                    account={data.bank_details}
                    narration={data.reference}
                  />
                )}
                {data.can_send_receipt && (
                  <Button
                    label={data.receipts.length ? 'Send another receipt' : 'Send your receipt'}
                    onPress={() => setSending(true)}
                    className="w-full"
                  />
                )}
              </>
            )}
            <ReceiptList receipts={data.receipts} />
            <ReceiptSheet
              visible={sending}
              onClose={() => setSending(false)}
              target={{ batch: data.id }}
              amount={data.balance}
            />
          </View>
        )}

        {/* ── Seats ──────────────────────────────────────────────────── */}
        <SectionTitle
          actionLabel={hasCodes ? 'Share' : undefined}
          onAction={hasCodes ? onShare : undefined}
        >
          Tickets
        </SectionTitle>
        <Text className="-mt-2 font-ui text-[14px] leading-5 text-ink-2">
          Give each teen a ticket number and its code. At the event they claim it in the app.
        </Text>
        <View className="w-full rounded-2xl bg-surf-raised px-4 py-1">
          {seats.map((seat, i) => (
            <SeatRow key={seat.id} seat={seat} last={i === seats.length - 1} />
          ))}
        </View>

        <View className="w-full gap-1 rounded-2xl bg-surf-sunken p-4">
          <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[1.92px] text-ink-3">
            Contact for this group
          </Text>
          <Text selectable className="font-ui-sb text-[16px] leading-6 text-ink-1">
            {data.contact_email || '—'}
          </Text>
          <Text selectable className="font-ui text-[14px] leading-5 text-ink-2">
            {data.contact_phone}
          </Text>
        </View>

        <Text className="text-center font-ui text-[12px] leading-4 text-ink-3">
          To add names or change the numbers, use the Console on the website.
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center">
      <Text className="flex-1 font-ui text-[14px] leading-5 text-ink-2">{label}</Text>
      <Text className={`text-ink-1 ${strong ? 'font-ui-b text-[17px] leading-6' : 'font-ui-sb text-[14px] leading-5'}`}>
        {value}
      </Text>
    </View>
  );
}

function SeatRow({ seat, last }: { seat: Seat; last: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-line'}`}>
      <View className="min-w-0 flex-1">
        <Text selectable className="font-ui-sb text-[15px] leading-5 tracking-[0.6px] text-ink-1">
          {seat.registration_id}
        </Text>
        <Text numberOfLines={1} className="font-ui text-[13px] leading-5 text-ink-2">
          {[genderWord(seat.attendee_gender), seat.claimed ? seat.attendee_name : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      {seat.claimed ? (
        <StatusChip label="Claimed" tone="good" />
      ) : seat.claim_code ? (
        <Text selectable className="font-ui-b text-[16px] leading-6 tracking-[2px] text-ink-1">
          {seat.claim_code}
        </Text>
      ) : null}
    </View>
  );
}
