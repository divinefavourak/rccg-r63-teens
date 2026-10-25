/**
 * Group registration — a coordinator registers a headcount and pays once.
 *
 * A group is so many boys and so many girls for one event. Each place is a
 * seat with a ticket number and a claim code; the coordinator hands those
 * out, and at the event each teen claims their seat in the app. Names are
 * optional and can be added later, here or from a spreadsheet.
 *
 * How the group is paid for is the event's choice (`EventEditor`): online,
 * through the gateway, or by transfer to the event's account with a receipt
 * that someone who reconciles payments checks (`Payments`). The seats are
 * confirmed only when the group is paid in full.
 *
 * Who sees what is the server's: coordinators get the groups of the part of
 * the church where they hold `events.manage`, reconcilers see them to check a
 * receipt, read-only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  CreditCard,
  Download,
  FileUp,
  Pencil,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  AlertBanner,
  Btn,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Modal,
  Pager,
  PaymentPill,
  RegistrationPill,
  Skeleton,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useHierarchy } from '../../hooks/useHierarchy';
import { useConsoleList, useConsolePage } from '../../hooks/useConsoleList';
import {
  batchStatus,
  dayOf,
  downloadNamesTemplate,
  downloadTicketsCsv,
  downloadTicketsPdf,
  errorDetail,
  naira,
  parseNamesCsv,
  receiptStatus,
  type BatchDetail,
  type BatchRow,
  type BatchStatus,
  type NameRow,
} from './groups';

type Tab = 'open' | 'under_review' | 'part_paid' | 'paid' | 'all';

const TAB_PARAMS: Record<Tab, Record<string, string>> = {
  open: { status: 'awaiting_payment' },
  under_review: { status: 'under_review' },
  part_paid: { status: 'part_paid' },
  paid: { status: 'paid' },
  all: {},
};

const PAGE_SIZE = 20;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD =
  'mt-1 w-full rounded-console-md border-2 border-transparent bg-console-tinted px-3.5 py-2.5 text-[16px] leading-6 text-console-text outline-none transition-colors focus:border-console-text';
const LABEL =
  'block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted';

const StatusPill = ({ status }: { status: BatchStatus }) => {
  const s = batchStatus(status);
  return (
    <span className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold leading-4 ${s.tone}`}>
      {s.label}
    </span>
  );
};

/** `EventListSerializer`, the fields the picker needs. */
interface EventOption {
  id: string;
  title: string;
  start_datetime: string;
  is_free: boolean;
  current_price: string | null;
  registration_status: string;
  group_registration_enabled: boolean;
  payment_method: 'online' | 'manual';
  spots_remaining: number | null;
}

interface Quote {
  headcount: number;
  unit_price: string;
  amount_due: string;
  group_discount_applied: boolean;
  regular_price: string;
}

// ─── New group ───────────────────────────────────────────────────────────────

const NewGroup = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (batch: BatchDetail) => void;
}) => {
  const { me, scopeNode, permissionsAt } = useConsoleAuth();
  const { nodes, ancestorIdsOf } = useHierarchy();
  const events = useConsoleList<EventOption>('/events/events/', {
    params: { upcoming: 'true', ordering: 'start_datetime', page_size: 100 },
    errorMessage: "We couldn't load the events.",
  });
  const open = events.items.filter(
    (e) => e.group_registration_enabled && e.registration_status === 'open',
  );

  // The nodes you could register a group for: where you manage events.
  const places = useMemo(
    () =>
      nodes.filter(
        (n) => n.selectable && permissionsAt(n.id, ancestorIdsOf(n.id)).has('events.manage'),
      ),
    [nodes, permissionsAt, ancestorIdsOf],
  );

  const [eventId, setEventId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [male, setMale] = useState('');
  const [female, setFemale] = useState('');
  // Started from the account, but asked for every time: the email on some
  // coordinators' accounts is not one they read.
  const [email, setEmail] = useState(me?.email ?? '');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId && open.length === 1) setEventId(open[0].id);
  }, [eventId, open]);
  useEffect(() => {
    if (nodeId || places.length === 0) return;
    const preferred = places.find((p) => p.id === scopeNode?.id) ?? places[0];
    setNodeId(preferred.id);
  }, [nodeId, places, scopeNode]);

  const counts = { male: Number(male) || 0, female: Number(female) || 0 };
  const headcount = counts.male + counts.female;
  const event = open.find((e) => e.id === eventId);
  const contactReady = EMAIL.test(email.trim()) && phone.trim().length >= 7;

  const quote = useQuery({
    queryKey: ['batch-quote', eventId, counts.male, counts.female],
    queryFn: async () =>
      (
        await api.post<Quote>('/events/batches/quote/', {
          event: eventId,
          male_count: counts.male,
          female_count: counts.female,
        })
      ).data,
    enabled: Boolean(eventId) && headcount > 0,
  });

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<BatchDetail>('/events/batches/', {
        event: eventId,
        node: nodeId,
        male_count: counts.male,
        female_count: counts.female,
        contact_email: email.trim(),
        contact_phone: phone.trim(),
        consent_attested: consent,
      });
      onCreated(data);
    } catch (err) {
      setError(errorDetail(err, "We couldn't register the group. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Register a group"
      subtitle="Say how many are coming. Each person gets a ticket number and a code to claim it in the app."
      onClose={onClose}
      width={560}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            size="md"
            disabled={busy || !eventId || !nodeId || headcount < 1 || !contactReady}
            onClick={create}
          >
            {busy ? 'Registering…' : `Register ${headcount || ''} ${headcount === 1 ? 'person' : 'people'}`}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        {error && <AlertBanner kind="error">{error}</AlertBanner>}

        {events.isLoading ? (
          <Skeleton className="h-11 w-full" />
        ) : open.length === 0 ? (
          <AlertBanner kind="info">
            No event is taking group registrations right now. The organiser turns it on in
            the event's settings.
          </AlertBanner>
        ) : (
          <label className="block">
            <span className={LABEL}>Event</span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={FIELD}>
              <option value="">Choose an event</option>
              {open.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {dayOf(e.start_datetime)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className={LABEL}>Where they are from</span>
          <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={FIELD}>
            {places.map((n) => (
              <option key={n.id} value={n.id}>
                {'  '.repeat(Math.max(0, n.depth - 1))}
                {n.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={LABEL}>Boys</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={male}
              onChange={(e) => setMale(e.target.value)}
              className={FIELD}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className={LABEL}>Girls</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={female}
              onChange={(e) => setFemale(e.target.value)}
              className={FIELD}
              placeholder="0"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Your email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD}
              placeholder="you@example.com"
            />
            <span className="mt-0.5 block text-[12px] leading-4 text-console-subtle">
              One you check: the tickets and payment updates are sent here.
            </span>
          </label>
          <label className="block">
            <span className={LABEL}>Your phone number</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={FIELD}
              placeholder="0803 000 0000"
              maxLength={20}
            />
            <span className="mt-0.5 block text-[12px] leading-4 text-console-subtle">
              So the organisers can reach you about this group.
            </span>
          </label>
        </div>

        <label className="flex items-start gap-2 text-[14px] leading-5 text-console-body">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Each teen's parent or guardian has agreed to them coming.
        </label>

        {event && headcount > 0 && (
          <div className="rounded-console-lg bg-console-tinted p-4">
            {quote.isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : quote.data ? (
              <>
                <p className="text-[24px] font-extrabold leading-8 tabular-nums text-console-text">
                  {event.is_free ? 'Free' : naira(quote.data.amount_due)}
                </p>
                {!event.is_free && (
                  <p className="text-[14px] leading-5 text-console-body">
                    {headcount} × {naira(quote.data.unit_price)}
                    {quote.data.group_discount_applied &&
                      ` (group price; ${naira(quote.data.regular_price)} each on its own)`}
                    {' · '}
                    {event.payment_method === 'manual'
                      ? 'paid by bank transfer'
                      : 'paid online'}
                  </p>
                )}
                {event.spots_remaining != null && event.spots_remaining < headcount && (
                  <p className="mt-1 text-[14px] font-semibold text-console-danger">
                    Only {event.spots_remaining} places are left.
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Changing the size ───────────────────────────────────────────────────────

const Resize = ({
  batch,
  onClose,
  onSaved,
}: {
  batch: BatchDetail;
  onClose: () => void;
  onSaved: (batch: BatchDetail) => void;
}) => {
  const [male, setMale] = useState(String(batch.male_count));
  const [female, setFemale] = useState(String(batch.female_count));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch<BatchDetail>(`/events/batches/${batch.id}/`, {
        male_count: Number(male) || 0,
        female_count: Number(female) || 0,
      });
      onSaved(data);
    } catch (err) {
      setError(errorDetail(err, "We couldn't change the group. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Change ${batch.reference}`}
      subtitle="Seats are taken away newest first. A seat a teen has claimed is never removed."
      onClose={onClose}
      width={440}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" size="md" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </Btn>
        </>
      }
    >
      {error && <AlertBanner kind="error" className="mb-3">{error}</AlertBanner>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={LABEL}>Boys</span>
          <input type="number" min="0" value={male} onChange={(e) => setMale(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>Girls</span>
          <input type="number" min="0" value={female} onChange={(e) => setFemale(e.target.value)} className={FIELD} />
        </label>
      </div>
    </Modal>
  );
};

// ─── Who to reach ────────────────────────────────────────────────────────────

const ContactEditor = ({
  batch,
  onClose,
  onSaved,
}: {
  batch: BatchDetail;
  onClose: () => void;
  onSaved: (batch: BatchDetail) => void;
}) => {
  const [email, setEmail] = useState(batch.contact_email);
  const [phone, setPhone] = useState(batch.contact_phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch<BatchDetail>(`/events/batches/${batch.id}/`, {
        contact_email: email.trim(),
        contact_phone: phone.trim(),
      });
      onSaved(data);
    } catch (err) {
      setError(errorDetail(err, "We couldn't save the contact details. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Contact for this group"
      subtitle="The tickets and every payment update for this group go to this email."
      onClose={onClose}
      width={480}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            size="md"
            disabled={busy || !EMAIL.test(email.trim()) || phone.trim().length < 7}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save'}
          </Btn>
        </>
      }
    >
      {error && <AlertBanner kind="error" className="mb-3">{error}</AlertBanner>}
      <div className="space-y-3">
        <label className="block">
          <span className={LABEL}>Email</span>
          <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>Phone number</span>
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} maxLength={20} />
        </label>
      </div>
    </Modal>
  );
};

// ─── Naming seats from a spreadsheet ─────────────────────────────────────────

const NamesUpload = ({
  batch,
  onClose,
  onSaved,
  onRefresh,
}: {
  batch: BatchDetail;
  onClose: () => void;
  /** Every row was used: the modal closes. */
  onSaved: (batch: BatchDetail, updated: number) => void;
  /** Some rows were not: the modal stays open to say which. */
  onRefresh: (batch: BatchDetail) => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<NameRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ row: number; registration_id: string; error: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const known = new Set(batch.seats.map((s) => s.registration_id.toUpperCase()));

  const read = async (file: File) => {
    setProblem(null);
    setErrors([]);
    const parsed = parseNamesCsv(await file.text());
    if (parsed.error) {
      setProblem(parsed.error);
      setRows(null);
      return;
    }
    setRows(parsed.rows);
  };

  const apply = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const { data } = await api.patch<{
        updated: number;
        errors: typeof errors;
        batch: BatchDetail;
      }>(`/events/batches/${batch.id}/seats/`, { seats: rows });
      if (data.errors.length) {
        setErrors(data.errors);
        onRefresh(data.batch);
      } else {
        onSaved(data.batch, data.updated);
      }
    } catch (err) {
      setProblem(errorDetail(err, "We couldn't save the names. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add names from a spreadsheet"
      subtitle="Download the template, type a name beside each ticket number, and upload it back. Names are optional; a teen's own name replaces it when they claim the seat."
      onClose={onClose}
      width={620}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Close
          </Btn>
          <Btn variant="primary" size="md" disabled={!rows?.length || busy} onClick={apply}>
            {busy ? 'Saving…' : `Save ${rows?.length ?? 0} names`}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Btn variant="soft" size="md" onClick={() => downloadNamesTemplate(batch)}>
            <Download size={16} /> Template
          </Btn>
          <Btn variant="secondary" size="md" onClick={() => input.current?.click()}>
            <FileUp size={16} /> Choose CSV file
          </Btn>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) read(file);
              e.target.value = '';
            }}
          />
        </div>
        {problem && <AlertBanner kind="error">{problem}</AlertBanner>}
        {errors.length > 0 && (
          <AlertBanner kind="caution">
            {errors.length} row{errors.length === 1 ? '' : 's'} not used:{' '}
            {errors.slice(0, 4).map((e) => `row ${e.row} (${e.error})`).join('; ')}
            {errors.length > 4 ? '…' : ''}
          </AlertBanner>
        )}
        {rows && (
          <Table>
            <thead>
              <tr>
                <Th>Ticket</Th>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r, i) => (
                <tr key={`${r.registration_id}-${i}`}>
                  <Td className="font-mono text-[13px]">{r.registration_id}</Td>
                  <Td>{r.name}</Td>
                  <Td>{r.phone}</Td>
                  <Td>
                    {!known.has(r.registration_id.toUpperCase()) && (
                      <span className="text-[12px] font-semibold text-console-danger">
                        Not in this group
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </Modal>
  );
};

// ─── Paying ──────────────────────────────────────────────────────────────────

const CopyLine = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-console-border py-2.5 first:border-t-0">
      <span className="text-[14px] text-console-muted">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-semibold text-console-text">{value}</span>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-console-muted hover:bg-console-tinted hover:text-console-text"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* The value is on screen to copy by hand. */
            }
          }}
        >
          {copied ? <span className="text-[12px] font-semibold">Copied</span> : <Copy size={16} />}
        </button>
      </span>
    </div>
  );
};

const ReceiptForm = ({
  batch,
  onSent,
}: {
  batch: BatchDetail;
  onSent: () => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(String(Number(batch.balance)));
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [payer, setPayer] = useState('');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const send = async () => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('The file is larger than 5 MB. Take a screenshot of the receipt instead.');
      return;
    }
    setError(null);
    setProgress(0);
    const body = new FormData();
    body.append('batch', batch.id);
    body.append('amount', amount);
    body.append('paid_on', paidOn);
    body.append('payer_name', payer);
    body.append('bank_reference', reference);
    body.append('file', file);
    try {
      await api.post('/payments/receipts/', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setFile(null);
      setReference('');
      onSent();
    } catch (err) {
      setError(errorDetail(err, "We couldn't send the receipt. Try again."));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && <AlertBanner kind="error">{error}</AlertBanner>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Amount transferred (₦)</span>
          <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>Date of the transfer</span>
          <input type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>Paid from (account name)</span>
          <input value={payer} onChange={(e) => setPayer(e.target.value)} className={FIELD} maxLength={255} />
        </label>
        <label className="block">
          <span className={LABEL}>Transfer reference or narration</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={FIELD} maxLength={100} placeholder={batch.reference} />
        </label>
      </div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex w-full items-center gap-3 rounded-console-lg border-2 border-dashed border-console-border-strong p-4 text-left hover:bg-console-tinted"
      >
        {preview ? (
          <img src={preview} alt="" className="h-16 w-16 rounded-console-md object-cover" />
        ) : (
          <Upload size={24} className="text-console-muted" />
        )}
        <span className="text-[14px] leading-5 text-console-body">
          {file ? file.name : 'Choose a photo, screenshot or PDF of the receipt (up to 5 MB)'}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-console-tinted">
          <div className="h-full rounded-full bg-console-go" style={{ width: `${progress}%` }} />
        </div>
      )}
      <Btn variant="primary" size="md" disabled={!file || progress !== null || !Number(amount)} onClick={send}>
        {progress !== null ? 'Sending…' : 'Send the receipt'}
      </Btn>
    </div>
  );
};

const PaymentCard = ({
  batch,
  readOnly,
  onChanged,
}: {
  batch: BatchDetail;
  readOnly: boolean;
  onChanged: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const payOnline = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ authorization_url: string }>(
        `/payments/batches/${batch.id}/checkout/`,
      );
      window.location.assign(data.authorization_url);
    } catch (err) {
      setError(errorDetail(err, "We couldn't open the payment page. Try again."));
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <p className="text-[16px] font-bold text-console-text">Payment</p>
        <StatusPill status={batch.status} />
      </CardHeader>
      <div className="space-y-4 p-5">
        {error && <AlertBanner kind="error">{error}</AlertBanner>}
        {sent && (
          <AlertBanner kind="success">
            Receipt sent. You'll get an email once it has been checked.
          </AlertBanner>
        )}
        {batch.status === 'paid' && (
          <AlertBanner kind="success">
            Paid in full. Every seat is confirmed. Hand out the ticket numbers and codes.
          </AlertBanner>
        )}
        {batch.status === 'under_review' && (
          <AlertBanner kind="info">
            A receipt is being checked against the bank statement. Nothing more is needed from you
            for now.
          </AlertBanner>
        )}

        {!readOnly && batch.can_pay_online && (
          <div>
            <p className="text-[14px] leading-5 text-console-body">
              {naira(batch.balance)} to pay by card, transfer or USSD. The seats are confirmed as
              soon as it goes through.
            </p>
            <Btn variant="primary" size="md" className="mt-3" disabled={busy} onClick={payOnline}>
              <CreditCard size={16} /> {busy ? 'Opening…' : `Pay ${naira(batch.balance)}`}
            </Btn>
          </div>
        )}

        {batch.bank_details && batch.status !== 'paid' && batch.status !== 'cancelled' && (
          <div>
            <p className="text-[14px] leading-5 text-console-body">
              Transfer <strong>{naira(batch.balance)}</strong> to this account, then send the
              receipt below.
            </p>
            <div className="mt-2 rounded-console-lg bg-console-tinted px-4 py-1.5">
              <CopyLine label="Bank" value={batch.bank_details.bank_name} />
              <CopyLine label="Account number" value={batch.bank_details.account_number} />
              <CopyLine label="Account name" value={batch.bank_details.account_name} />
              <CopyLine label="Narration" value={batch.reference} />
            </div>
            {batch.bank_details.instructions && (
              <p className="mt-2 whitespace-pre-line text-[14px] leading-5 text-console-body">
                {batch.bank_details.instructions}
              </p>
            )}
          </div>
        )}

        {!readOnly && batch.can_send_receipt && (
          <ReceiptForm
            key={batch.receipts.length}
            batch={batch}
            onSent={() => {
              setSent(true);
              onChanged();
            }}
          />
        )}

        {batch.receipts.length > 0 && (
          <div>
            <p className="mb-1 text-[14px] font-semibold text-console-text">Receipts sent</p>
            <Table>
              <thead>
                <tr>
                  <Th>Sent</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {batch.receipts.map((r) => {
                  const s = receiptStatus(r.status);
                  return (
                    <tr key={r.id}>
                      <Td>{dayOf(r.created_at)}</Td>
                      <Td className="tabular-nums">
                        {naira(r.amount_verified ?? r.amount_claimed)}
                        {r.amount_verified && r.amount_verified !== r.amount_claimed && (
                          <span className="block text-[12px] text-console-muted">
                            {naira(r.amount_claimed)} claimed
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold ${s.tone}`}>
                          {s.label}
                        </span>
                      </Td>
                      <Td className="text-[13px] text-console-body">{r.review_note || '—'}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </Card>
  );
};

// ─── One group ───────────────────────────────────────────────────────────────

const GroupDetail = ({
  id,
  readOnly,
  justPaid,
  onBack,
}: {
  id: string;
  readOnly: boolean;
  justPaid: boolean;
  onBack: () => void;
}) => {
  const queryClient = useQueryClient();
  const key = ['batch', id];
  const batch = useQuery({
    queryKey: key,
    queryFn: async () => {
      // Back from the gateway: ask it, in case the webhook is not here yet.
      if (justPaid) {
        try {
          return (await api.post<BatchDetail>(`/payments/batches/${id}/check/`)).data;
        } catch {
          /* Fall through to the plain read. */
        }
      }
      return (await api.get<BatchDetail>(`/events/batches/${id}/`)).data;
    },
  });
  const set = (data: BatchDetail) => {
    queryClient.setQueryData(key, data);
    queryClient.invalidateQueries({ queryKey: ['console-page', '/events/batches/'] });
  };
  const reload = () => {
    batch.refetch();
    queryClient.invalidateQueries({ queryKey: ['console-page', '/events/batches/'] });
  };

  const [resizing, setResizing] = useState(false);
  const [contact, setContact] = useState(false);
  const [naming, setNaming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  if (batch.isLoading) {
    return (
      <Card>
        <TableSkeleton rows={6} />
      </Card>
    );
  }
  if (batch.error || !batch.data) {
    return <ErrorState message="We couldn't open this group." onRetry={() => batch.refetch()} />;
  }
  const b = batch.data;
  const canChange = !readOnly && b.status !== 'cancelled';
  // The server sends the codes only to the group's coordinators. Without them
  // there is no ticket sheet to hand out, so neither is offered.
  const showCodes = b.seats.some((s) => s.claim_code);

  const saveNames = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const seats = Object.entries(editing)
        .filter(([, name]) => name.trim())
        .map(([registration_id, name]) => ({ registration_id, name }));
      const { data } = await api.patch<{ updated: number; batch: BatchDetail }>(
        `/events/batches/${b.id}/seats/`,
        { seats },
      );
      set(data.batch);
      setEditing(null);
      setNotice(`${data.updated} name${data.updated === 1 ? '' : 's'} saved.`);
    } catch (err) {
      setError(errorDetail(err, "We couldn't save the names. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setError(null);
    try {
      const { data } = await api.post<BatchDetail>(`/events/batches/${b.id}/cancel/`);
      set(data);
      setCancelling(false);
      setNotice(`${b.reference} is cancelled and its seats are released.`);
    } catch (err) {
      setCancelling(false);
      setError(errorDetail(err, "We couldn't cancel the group. Try again."));
    }
  };

  return (
    <ScreenShell
      crumb={`Group registration / ${b.reference}`}
      title={b.reference}
      subtitle={`${b.event_title} · ${b.node_detail?.name ?? ''} · registered by ${b.created_by_name || 'a coordinator'} on ${dayOf(b.created_at)}`}
      readOnly={readOnly}
      hideScope
    >
      <div className="space-y-4">
        {/* In the page rather than the header's action row, which does not
            wrap: on a phone the third button fell off the edge. */}
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" size="md" onClick={onBack}>
            <ArrowLeft size={16} /> All groups
          </Btn>
          {showCodes && (
            <>
              <Btn variant="soft" size="md" onClick={() => downloadTicketsCsv(b)}>
                <Download size={16} /> Tickets CSV
              </Btn>
              <Btn variant="soft" size="md" onClick={() => downloadTicketsPdf(b)}>
                <Download size={16} /> Tickets PDF
              </Btn>
            </>
          )}
        </div>
        {notice && (
          <AlertBanner
            kind="success"
            action={
              <Btn variant="ghost" onClick={() => setNotice(null)} aria-label="Dismiss">
                <X size={16} />
              </Btn>
            }
          >
            {notice}
          </AlertBanner>
        )}
        {error && <AlertBanner kind="error">{error}</AlertBanner>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['bg-pop-sky', `${b.headcount}`, `${b.male_count} boys · ${b.female_count} girls`],
            ['bg-pop-violet', naira(b.amount_due), `${naira(b.unit_price)} each`],
            ['bg-pop-green', naira(b.amount_paid), 'Received'],
            ['bg-pop-amber', naira(b.balance), 'Still to pay'],
          ].map(([tone, value, label]) => (
            <div key={label} className={`min-w-0 rounded-console-lg px-4 py-3 text-pop-on ${tone}`}>
              <p className="break-words text-[22px] font-extrabold leading-8 tabular-nums sm:text-[28px] sm:leading-9">
                {value}
              </p>
              <p className="text-[14px] leading-5">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-console-lg bg-console-surface px-4 py-3 text-[14px] leading-5 shadow-console-card">
          <span className="text-console-muted">Contact</span>
          <span className="min-w-0 break-all font-semibold text-console-text">
            {b.contact_email || 'No email given'}
          </span>
          <span className="font-semibold text-console-text">{b.contact_phone || 'No phone given'}</span>
          {canChange && (
            <Btn variant="ghost" className="ml-auto" onClick={() => setContact(true)}>
              <Pencil size={14} /> Change
            </Btn>
          )}
        </div>

        <PaymentCard batch={b} readOnly={readOnly} onChanged={reload} />

        <Card>
          <CardHeader>
            <p className="text-[16px] font-bold text-console-text">Seats</p>
            {canChange && (
              <div className="flex flex-wrap gap-2">
                {b.can_resize && (
                  <Btn variant="soft" onClick={() => setResizing(true)}>
                    Change size
                  </Btn>
                )}
                {editing ? (
                  <>
                    <Btn variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Btn>
                    <Btn variant="primary" disabled={saving} onClick={saveNames}>
                      {saving ? 'Saving…' : 'Save names'}
                    </Btn>
                  </>
                ) : (
                  <>
                    <Btn variant="soft" onClick={() => setEditing({})}>
                      <Pencil size={14} /> Edit names
                    </Btn>
                    <Btn variant="soft" onClick={() => setNaming(true)}>
                      <FileUp size={14} /> Names from CSV
                    </Btn>
                  </>
                )}
                {b.can_cancel && (
                  <Btn variant="danger" onClick={() => setCancelling(true)}>
                    Cancel group
                  </Btn>
                )}
              </div>
            )}
          </CardHeader>
          {b.seats.length === 0 ? (
            <EmptyState art={null} message="This group has no seats." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Ticket</Th>
                  {showCodes && <Th>Code</Th>}
                  <Th>Gender</Th>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th>Claimed</Th>
                </tr>
              </thead>
              <tbody>
                {b.seats.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-mono text-[13px] font-semibold">{s.registration_id}</Td>
                    {showCodes && (
                      <Td className="font-mono text-[13px] font-bold tracking-[0.08em]">{s.claim_code}</Td>
                    )}
                    <Td className="capitalize">{s.attendee_gender}</Td>
                    <Td>
                      {editing && !s.claimed ? (
                        <input
                          aria-label={`Name for ${s.registration_id}`}
                          defaultValue={s.attendee_name.includes(' · seat ') ? '' : s.attendee_name}
                          onChange={(e) =>
                            setEditing((m) => ({ ...(m ?? {}), [s.registration_id]: e.target.value }))
                          }
                          className="w-full min-w-[160px] rounded-console-md bg-console-tinted px-2.5 py-1.5 text-[14px] outline-none focus:ring-2 focus:ring-console-text"
                        />
                      ) : (
                        s.attendee_name
                      )}
                    </Td>
                    <Td>
                      <RegistrationPill status={s.status} />
                    </Td>
                    <Td>
                      <PaymentPill status={s.payment_status} />
                    </Td>
                    <Td className="text-[13px] text-console-body">
                      {s.claimed ? dayOf(s.claimed_at) : 'Not yet'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {resizing && (
        <Resize
          batch={b}
          onClose={() => setResizing(false)}
          onSaved={(data) => {
            set(data);
            setResizing(false);
            setNotice(`${data.reference} now has ${data.headcount} seats.`);
          }}
        />
      )}
      {contact && (
        <ContactEditor
          batch={b}
          onClose={() => setContact(false)}
          onSaved={(data) => {
            set(data);
            setContact(false);
            setNotice('Contact details saved.');
          }}
        />
      )}
      {naming && (
        <NamesUpload
          batch={b}
          onClose={() => setNaming(false)}
          onSaved={(data, updated) => {
            set(data);
            setNaming(false);
            setNotice(`${updated} name${updated === 1 ? '' : 's'} saved.`);
          }}
          onRefresh={set}
        />
      )}
      {cancelling && (
        <Modal
          title={`Cancel ${b.reference}?`}
          subtitle={`All ${b.headcount} seats are released and their ticket numbers stop working.`}
          onClose={() => setCancelling(false)}
          width={440}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setCancelling(false)}>
                Keep it
              </Btn>
              <Btn variant="danger" size="md" onClick={cancel}>
                Cancel the group
              </Btn>
            </>
          }
        >
          <p className="text-[14px] leading-5 text-console-body">
            This cannot be undone. Register a new group if you need the places again.
          </p>
        </Modal>
      )}
    </ScreenShell>
  );
};

// ─── The list ────────────────────────────────────────────────────────────────

export const GroupRegistration = () => {
  const { can } = useConsoleAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('open');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const canManage = can('events.manage');

  const batches = useConsolePage<BatchRow>('/events/batches/', {
    params: { ...TAB_PARAMS[tab], page, page_size: PAGE_SIZE },
    errorMessage: "We couldn't load the groups. Try again.",
  });

  const openId = params.get('batch');
  if (openId) {
    return (
      <GroupDetail
        id={openId}
        readOnly={!canManage}
        justPaid={params.get('paid') === '1'}
        onBack={() => setParams({})}
      />
    );
  }

  return (
    <ScreenShell
      title="Group registration"
      subtitle="Register the teens from your part of the church by headcount, pay once, and hand out ticket numbers. Each teen claims their seat in the app."
      readOnly={!canManage}
      actions={
        canManage && (
          <Btn variant="primary" size="md" onClick={() => setCreating(true)}>
            <Plus size={16} /> Register a group
          </Btn>
        )
      }
    >
      <Tabs
        tabs={[
          { id: 'open', label: 'Awaiting payment' },
          { id: 'under_review', label: 'Being checked' },
          { id: 'part_paid', label: 'Part paid' },
          { id: 'paid', label: 'Paid' },
          { id: 'all', label: 'All' },
        ]}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
      />
      <Card>
        {batches.error ? (
          <ErrorState message={batches.error} onRetry={batches.reload} />
        ) : batches.isLoading ? (
          <TableSkeleton />
        ) : batches.items.length === 0 ? (
          <EmptyState
            title={tab === 'all' ? 'No groups yet' : 'Nothing here'}
            message={
              canManage
                ? 'Register a group to get ticket numbers for everyone you are bringing.'
                : 'Groups registered in your part of the church show here.'
            }
            action={
              canManage && tab === 'all' ? (
                <Btn variant="primary" size="md" onClick={() => setCreating(true)}>
                  <Plus size={16} /> Register a group
                </Btn>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Group</Th>
                  <Th>Event</Th>
                  <Th>Seats</Th>
                  <Th>Total</Th>
                  <Th>Paid</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {batches.items.map((b) => (
                  <tr
                    key={b.id}
                    className="cursor-pointer hover:bg-console-tinted"
                    onClick={() => setParams({ batch: b.id })}
                  >
                    <Td>
                      {/* A real button, so the row opens from the keyboard too. */}
                      <button
                        type="button"
                        className="font-mono text-[13px] font-semibold text-console-text hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setParams({ batch: b.id });
                        }}
                      >
                        {b.reference}
                      </button>
                      <span className="block text-[12px] text-console-muted">{b.node_detail?.name}</span>
                    </Td>
                    <Td>
                      {b.event_title}
                      <span className="block text-[12px] text-console-muted">{dayOf(b.event_start)}</span>
                    </Td>
                    <Td className="tabular-nums">
                      {b.headcount}
                      <span className="block text-[12px] text-console-muted">
                        {b.male_count} M · {b.female_count} F
                      </span>
                    </Td>
                    <Td className="tabular-nums">{naira(b.amount_due)}</Td>
                    <Td className="tabular-nums">{naira(b.amount_paid)}</Td>
                    <Td>
                      <StatusPill status={b.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              count={batches.count}
              shown={batches.items.length}
              noun="groups"
              onPage={setPage}
            />
          </>
        )}
      </Card>

      {creating && (
        <NewGroup
          onClose={() => setCreating(false)}
          onCreated={(batch) => {
            setCreating(false);
            batches.reload();
            setParams({ batch: batch.id });
          }}
        />
      )}
    </ScreenShell>
  );
};

export default GroupRegistration;
