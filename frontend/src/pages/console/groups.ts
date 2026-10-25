/**
 * What the group registration and payments screens share: the shapes the
 * API sends (`events/serializers.py` and `payments/serializers.py`), money,
 * the ticket sheet a coordinator hands out, and reading the names CSV.
 */
import { parseAPIDate } from '../../utils/dates';
import { cell, plain, save } from './exportRegistrations';

export type BatchStatus =
  | 'awaiting_payment'
  | 'under_review'
  | 'part_paid'
  | 'paid'
  | 'cancelled';

export type ReceiptStatus = 'submitted' | 'verified' | 'rejected';

/** `RegistrationBatchSerializer`. */
export interface BatchRow {
  id: string;
  reference: string;
  event: string;
  event_title: string;
  event_start: string;
  payment_method: 'online' | 'manual';
  node: string;
  node_detail: { id: string; name: string; node_type: string } | null;
  created_by_name: string;
  /** Where to reach the coordinator about this group; asked for on every group. */
  contact_email: string;
  contact_phone: string;
  male_count: number;
  female_count: number;
  headcount: number;
  unit_price: string;
  amount_due: string;
  amount_paid: string;
  balance: string;
  status: BatchStatus;
  receipts_waiting: number;
  paid_at: string | null;
  created_at: string;
}

/** `BatchSeatSerializer`. */
export interface Seat {
  id: string;
  registration_id: string;
  claim_code: string;
  attendee_gender: string;
  attendee_name: string;
  attendee_phone: string;
  status: string;
  payment_status: string;
  claimed: boolean;
  claimed_at: string | null;
  checked_in_at: string | null;
  bed: { code: string; hostel: string } | null;
}

/** `PaymentReceiptSerializer`. */
export interface Receipt {
  id: string;
  batch: string | null;
  registration: string | null;
  target: {
    kind: 'batch' | 'registration';
    id: string;
    reference: string;
    event: string;
    event_title: string;
    node: string;
    headcount?: number;
    attendee_name?: string;
    amount_due: string;
    amount_paid: string;
    balance?: string;
    status: string;
    contact_email?: string;
    contact_phone?: string;
  };
  submitted_by_name: string;
  amount_claimed: string;
  paid_on: string;
  payer_name: string;
  bank_reference: string;
  file_name: string;
  file_type: string;
  status: ReceiptStatus;
  amount_verified: string | null;
  reviewed_by_name: string;
  reviewed_at: string | null;
  review_note: string;
  duplicates: { id: string; status: ReceiptStatus; same_file: boolean; created_at: string }[];
  created_at: string;
}

/** `RegistrationBatchDetailSerializer`. */
export interface BatchDetail extends BatchRow {
  notes: string;
  consent_attested: boolean;
  seats: Seat[];
  receipts: Receipt[];
  bank_details: {
    bank_name: string;
    account_number: string;
    account_name: string;
    instructions: string;
  } | null;
  can_resize: boolean;
  can_cancel: boolean;
  can_pay_online: boolean;
  can_send_receipt: boolean;
}

export const naira = (value: string | number | null | undefined) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export const dayOf = (value: string | null | undefined) => {
  const d = parseAPIDate(value ?? undefined);
  return d
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
};

export const errorDetail = (err: unknown, fallback: string) => {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === 'string') return record.detail;
    const first = Object.entries(record)[0];
    if (first) {
      const [field, value] = first;
      const message = Array.isArray(value) ? String(value[0]) : String(value);
      return field === 'non_field_errors' ? message : `${field.replace(/_/g, ' ')}: ${message}`;
    }
  }
  return fallback;
};

const BATCH_STATUS: Record<BatchStatus, { label: string; tone: string }> = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'bg-pop-amber text-pop-on' },
  under_review: { label: 'Receipt being checked', tone: 'bg-pop-sky text-pop-on' },
  part_paid: { label: 'Part paid', tone: 'bg-pop-violet text-pop-on' },
  paid: { label: 'Paid', tone: 'bg-pop-green text-pop-on' },
  cancelled: { label: 'Cancelled', tone: 'bg-console-tinted text-console-muted' },
};

export const batchStatus = (status: BatchStatus) =>
  BATCH_STATUS[status] ?? { label: status, tone: 'bg-console-tinted text-console-muted' };

const RECEIPT_STATUS: Record<ReceiptStatus, { label: string; tone: string }> = {
  submitted: { label: 'Waiting to be checked', tone: 'bg-pop-amber text-pop-on' },
  verified: { label: 'Verified', tone: 'bg-pop-green text-pop-on' },
  rejected: { label: 'Rejected', tone: 'bg-console-danger-bg text-console-danger' },
};

export const receiptStatus = (status: ReceiptStatus) =>
  RECEIPT_STATUS[status] ?? { label: status, tone: 'bg-console-tinted text-console-muted' };

// ─── The ticket sheet ────────────────────────────────────────────────────────

const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'group';

const gender = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : '');

/** Every seat with its ticket number and code, to share or print. */
export function downloadTicketsCsv(batch: BatchDetail) {
  const rows = [
    ['Ticket', 'Claim code', 'Gender', 'Name', 'Phone', 'Claimed'],
    ...batch.seats.map((s) => [
      s.registration_id,
      s.claim_code,
      gender(s.attendee_gender),
      s.attendee_name,
      s.attendee_phone ?? '',
      s.claimed ? 'Yes' : 'No',
    ]),
  ];
  const text = rows.map((r) => r.map((v) => cell(String(v))).join(',')).join('\r\n');
  save(
    new Blob(['\uFEFF', text, '\r\n'], { type: 'text/csv;charset=utf-8' }),
    `${slug(batch.event_title)}-${batch.reference}-tickets.csv`,
  );
}

/**
 * The template for naming seats: the ticket numbers already filled in, so the
 * coordinator only types names. Uploaded back through `parseNamesCsv`.
 */
export function downloadNamesTemplate(batch: BatchDetail) {
  const rows = [
    ['Ticket', 'Gender', 'Name', 'Phone'],
    ...batch.seats
      .filter((s) => !s.claimed)
      .map((s) => [s.registration_id, gender(s.attendee_gender), '', '']),
  ];
  const text = rows.map((r) => r.map((v) => cell(String(v))).join(',')).join('\r\n');
  save(
    new Blob(['\uFEFF', text, '\r\n'], { type: 'text/csv;charset=utf-8' }),
    `${batch.reference}-names.csv`,
  );
}

export async function downloadTicketsPdf(batch: BatchDetail) {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const MARGIN = 14;
  const WIDTH = doc.internal.pageSize.getWidth();
  const HEIGHT = doc.internal.pageSize.getHeight();
  const ROW = 8;
  const cols = [
    { heading: '#', width: 10 },
    { heading: 'Ticket', width: 50 },
    { heading: 'Code', width: 28 },
    { heading: 'Gender', width: 22 },
    { heading: 'Name', width: WIDTH - 2 * MARGIN - 110 },
  ];

  let y = MARGIN;
  const header = (first: boolean) => {
    y = MARGIN;
    if (first) {
      doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(28, 25, 22);
      doc.text(plain(batch.event_title), MARGIN, y + 5);
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(111, 104, 98);
      doc.text(
        plain(
          `${batch.reference} · ${batch.node_detail?.name ?? ''} · ${batch.headcount} seats · ` +
            `${batch.status === 'paid' ? 'Paid' : 'Not paid yet: seats are confirmed once it is'}`,
        ),
        MARGIN,
        y + 11,
      );
      doc.text(
        'Each teen opens the Faith Tribe app, taps Claim a ticket, and enters the ticket number and code.',
        MARGIN,
        y + 16,
      );
      y += 22;
    }
    doc.setFillColor(242, 234, 224).rect(MARGIN, y, WIDTH - 2 * MARGIN, ROW, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(28, 25, 22);
    let x = MARGIN;
    for (const col of cols) {
      doc.text(col.heading, x + 1.5, y + 5.5);
      x += col.width;
    }
    y += ROW;
    doc.setFont('helvetica', 'normal');
  };

  header(true);
  batch.seats.forEach((seat, index) => {
    if (y + ROW > HEIGHT - MARGIN) {
      doc.addPage();
      header(false);
    }
    const values = [
      String(index + 1),
      seat.registration_id,
      seat.claim_code,
      gender(seat.attendee_gender),
      seat.claimed ? `${seat.attendee_name} (claimed)` : seat.attendee_name,
    ];
    let x = MARGIN;
    doc.setFontSize(10);
    values.forEach((value, i) => {
      doc.setFont(i === 1 || i === 2 ? 'courier' : 'helvetica', i === 2 ? 'bold' : 'normal');
      doc.text(plain(value).slice(0, 48), x + 1.5, y + 5.5);
      x += cols[i].width;
    });
    doc.setDrawColor(234, 227, 218).line(MARGIN, y + ROW, WIDTH - MARGIN, y + ROW);
    y += ROW;
  });
  doc.save(`${slug(batch.event_title)}-${batch.reference}-tickets.pdf`);
}

// ─── Reading the names CSV ───────────────────────────────────────────────────

/** RFC 4180-ish: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const body = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
}

export interface NameRow {
  registration_id: string;
  name: string;
  phone: string;
}

/**
 * The rows of a names CSV, by its headings rather than column order, so a
 * coordinator who rearranged the template is not punished for it.
 */
export function parseNamesCsv(text: string): { rows: NameRow[]; error?: string } {
  const [head, ...body] = parseCsv(text);
  if (!head) return { rows: [], error: 'The file is empty.' };
  const find = (...names: string[]) =>
    head.findIndex((h) => names.includes(h.trim().toLowerCase()));
  const ticket = find('ticket', 'ticket number', 'registration_id');
  const name = find('name', 'full name');
  const phone = find('phone', 'phone number');
  if (ticket < 0 || name < 0) {
    return { rows: [], error: 'The file needs a Ticket column and a Name column. Use the template.' };
  }
  const rows = body
    .map((r) => ({
      registration_id: (r[ticket] ?? '').trim(),
      name: (r[name] ?? '').trim(),
      phone: phone >= 0 ? (r[phone] ?? '').trim() : '',
    }))
    .filter((r) => r.registration_id && r.name);
  return { rows };
}
