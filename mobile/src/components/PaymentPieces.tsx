import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { useSendReceipt } from '../api/queries';
import type { BatchStatus, Receipt, ReceiptStatus } from '../api/types';
import { dayLabel, formatNaira } from '../data/events';
import { Icon } from './Icon';
import { FormError } from '../ui/AuthShell';
import { Button } from '../ui/Button';
import { TextField } from '../ui/inputs';
import { Press } from '../ui/Press';
import { Sheet } from '../ui/screen';
import { useTokens } from '../theme/ThemeProvider';

/**
 * Paying by bank transfer, shared by a teen's ticket and a coordinator's
 * group: where the money goes, the receipt sent afterwards, and the receipts
 * already sent. The words match the Console's, so a coordinator who uses both
 * reads the same thing in each.
 */

/** The server's file limit (`settings.MAX_RECEIPT_SIZE`). */
const MAX_BYTES = 5 * 1024 * 1024;

type Tone = 'calm' | 'good' | 'bad' | 'plain';

const TONE_BG: Record<Tone, string> = {
  calm: 'bg-amber-tonal',
  good: 'bg-green-tonal',
  bad: 'bg-surf-sunken',
  plain: 'bg-surf-sunken',
};
const TONE_TEXT: Record<Tone, string> = {
  calm: 'text-feedback-caution',
  good: 'text-green',
  bad: 'text-feedback-error',
  plain: 'text-ink-2',
};

const RECEIPT: Record<ReceiptStatus, { label: string; tone: Tone }> = {
  submitted: { label: 'Waiting to be checked', tone: 'calm' },
  verified: { label: 'Verified', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
};

const BATCH: Record<BatchStatus, { label: string; tone: Tone }> = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'calm' },
  under_review: { label: 'Receipt being checked', tone: 'calm' },
  part_paid: { label: 'Part paid', tone: 'calm' },
  paid: { label: 'Paid', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'plain' },
};

export function batchStatus(status: BatchStatus) {
  return BATCH[status] ?? { label: status, tone: 'plain' as Tone };
}

export function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${TONE_BG[tone]}`}>
      <Text numberOfLines={1} className={`font-ui-sb text-[12px] leading-4 ${TONE_TEXT[tone]}`}>
        {label}
      </Text>
    </View>
  );
}

/** "₦12,000", or "₦0" rather than nothing. */
export function naira(value: string | null | undefined): string {
  return formatNaira(value) ?? '₦0';
}

/** A server date ("2026-10-26") as "Mon 26 Oct", read as a local day. */
function dayOf(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return y && m && d ? dayLabel(new Date(y, m - 1, d)) : value;
}

// ─── Where the money goes ──────────────────────────────────────────────────

export interface BankAccount {
  bank_name: string;
  account_number: string;
  account_name: string;
  instructions?: string;
}

/**
 * The account to pay into, each line copyable. `narration` is what to write
 * on the transfer so whoever checks it can match it to the right place.
 */
export function BankDetails({ account, narration }: { account: BankAccount; narration?: string }) {
  return (
    <View className="w-full gap-2 rounded-xl bg-surf-raised p-3">
      <CopyLine label="Bank" value={account.bank_name} />
      <CopyLine label="Account number" value={account.account_number} big />
      <CopyLine label="Account name" value={account.account_name} />
      {!!narration && <CopyLine label="Narration" value={narration} />}
      {!!account.instructions && (
        <Text className="font-ui text-[14px] leading-5 text-ink-2">{account.instructions}</Text>
      )}
    </View>
  );
}

function CopyLine({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  const tokens = useTokens();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!value) return null;
  return (
    <View className="flex-row items-center gap-2">
      <View className="min-w-0 flex-1">
        <Text className="font-ui-md text-[12px] leading-4 text-ink-3">{label}</Text>
        <Text
          selectable
          className={`text-ink-1 ${
            big ? 'font-ui-b text-[20px] leading-7 tracking-[1px]' : 'font-ui-sb text-[16px] leading-6'
          }`}
        >
          {value}
        </Text>
      </View>
      <Press
        onPress={() => {
          Clipboard.setStringAsync(value).then(() => setCopied(true), () => {});
        }}
        accessibilityLabel={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        className="h-10 flex-row items-center gap-1 rounded-full bg-surf-sunken px-3"
      >
        <Icon name={copied ? 'check' : 'copy'} size={16} color={tokens.text1} />
        <Text className="font-ui-sb text-[12px] leading-4 text-ink-1">
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </Press>
    </View>
  );
}

// ─── Receipts already sent ─────────────────────────────────────────────────

export function ReceiptList({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return null;
  return (
    <View className="w-full gap-2">
      <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[1.92px] text-ink-3">
        Receipts sent
      </Text>
      {receipts.map((r) => {
        const status = RECEIPT[r.status] ?? { label: r.status, tone: 'plain' as Tone };
        return (
          <View key={r.id} className="w-full gap-1.5 rounded-xl bg-surf-raised p-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-ui-sb text-[16px] leading-6 text-ink-1">
                {naira(r.status === 'verified' ? (r.amount_verified ?? r.amount_claimed) : r.amount_claimed)}
              </Text>
              <StatusChip {...status} />
            </View>
            <Text className="font-ui text-[14px] leading-5 text-ink-2">
              Paid {dayOf(r.paid_on)}
              {r.bank_reference ? ` · Ref ${r.bank_reference}` : ''}
            </Text>
            {!!r.review_note && (
              <Text
                className={`font-ui text-[14px] leading-5 ${
                  r.status === 'rejected' ? 'text-feedback-error' : 'text-ink-2'
                }`}
              >
                {r.review_note}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Sending one ───────────────────────────────────────────────────────────

/** What is owed, as typed: "15000" for 15000.00, the exact figure otherwise. */
function amountText(amount: string | null | undefined): string {
  if (!amount) return '';
  const value = Number(amount);
  return Number.isInteger(value) ? String(value) : amount;
}

/**
 * A name for the upload that matches what is in it. The picker's own name can
 * be "IMG_0042.HEIC" for an image it has already turned into a JPEG, and the
 * server goes by the extension before it looks inside.
 */
function uploadName(uri: string, mimeType: string | undefined): string {
  const type = (mimeType ?? '').toLowerCase();
  const fromUri = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const ext = type.includes('png') || fromUri === 'png'
    ? 'png'
    : type.includes('webp') || fromUri === 'webp'
      ? 'webp'
      : 'jpg';
  return `receipt.${ext}`;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Picked {
  uri: string;
  mimeType?: string;
  fileName?: string;
}

/**
 * The form for a transfer receipt: how much, when, who paid, the bank's
 * reference, and a photo or screenshot of it. Sent for a ticket or a group;
 * someone who verifies payments checks it against the account.
 */
export function ReceiptSheet({
  visible,
  onClose,
  target,
  amount,
  payer,
}: {
  visible: boolean;
  onClose: () => void;
  target: { registration: string } | { batch: string };
  /** What is still owed; the amount starts here. */
  amount: string | null | undefined;
  payer?: string;
}) {
  const send = useSendReceipt();
  const [value, setValue] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [name, setName] = useState(payer ?? '');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<Picked | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start fresh each time it opens.
  useEffect(() => {
    if (!visible) return;
    setValue(amountText(amount));
    setPaidOn(today());
    setName(payer ?? '');
    setReference('');
    setFile(null);
    setError(null);
    send.reset();
    // Only on opening: `send` changes as it runs, and resetting on that would
    // clear an error as it lands.
  }, [visible]);

  /** A field's setter that also takes away an error the user is now fixing. */
  const edit = (set: (value: string) => void) => (text: string) => {
    set(text);
    setError(null);
  };

  const pick = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Below 1, and the compatible form, so the system hands back a JPEG
      // and never a HEIC the server would refuse.
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    if (asset.fileSize && asset.fileSize > MAX_BYTES) {
      setError('That picture is bigger than 5MB. Try a screenshot of the receipt instead.');
      return;
    }
    setFile({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: uploadName(asset.uri, asset.mimeType),
    });
  };

  const submit = async () => {
    const number = Number(value.replace(/[^\d.]/g, ''));
    if (!number || number < 1) return setError('Enter the amount you transferred.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
      return setError('Enter the day you paid as year-month-day, like 2026-10-26.');
    }
    if (!file) return setError('Add a photo or screenshot of the receipt.');
    setError(null);
    try {
      await send.mutateAsync({
        ...target,
        amount: String(number),
        paid_on: paidOn,
        payer_name: name.trim(),
        bank_reference: reference.trim(),
        file,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not send. Please try again.');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView
        className="w-full"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingTop: 8, paddingBottom: 8 }}
      >
        <View className="gap-1">
          <Text accessibilityRole="header" className="font-ui-b text-[20px] leading-7 text-ink-1">
            Send your receipt
          </Text>
          <Text className="font-ui text-[14px] leading-5 text-ink-2">
            Someone checks it against the account, usually within a day. You can send another if
            you paid in parts.
          </Text>
        </View>
        <TextField
          label="Amount transferred (₦)"
          value={value}
          onChange={edit(setValue)}
          keyboardType="decimal-pad"
        />
        <TextField
          label="Day you paid"
          value={paidOn}
          onChange={edit(setPaidOn)}
          hint="Year-month-day"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <TextField
          label="Name on the transfer"
          value={name}
          onChange={edit(setName)}
          autoCapitalize="words"
        />
        <TextField
          label="Bank reference (optional)"
          value={reference}
          onChange={edit(setReference)}
          autoCapitalize="characters"
        />
        {file ? (
          <View className="flex-row items-center gap-3 rounded-xl bg-surf-sunken p-2">
            <Image
              source={{ uri: file.uri }}
              contentFit="cover"
              accessible={false}
              style={{ width: 56, height: 56, borderRadius: 8 }}
            />
            <Text numberOfLines={1} className="flex-1 font-ui-sb text-[14px] leading-5 text-ink-1">
              {file.fileName ?? 'Receipt photo'}
            </Text>
            <Button label="Change" variant="tertiary" onPress={pick} className="h-10" />
          </View>
        ) : (
          <Button label="Choose a photo of the receipt" variant="secondary" onPress={pick} />
        )}
        <View>
          <FormError>{error}</FormError>
          <Button label="Send receipt" onPress={submit} loading={send.isPending} className="w-full" />
        </View>
      </ScrollView>
    </Sheet>
  );
}
