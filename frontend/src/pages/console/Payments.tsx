/**
 * Payments — check transfer receipts, and reconcile what each event expects
 * against what came in.
 *
 * On an event paid by bank transfer, a coordinator (or a teen) uploads the
 * receipt; whoever holds `payments.reconcile` over that part of the church
 * opens it here, checks it against the bank statement, and verifies it for
 * the amount that actually arrived, or rejects it with a reason the payer
 * sees. Verifying records the money as a payment, the same row the gateway
 * writes, so the ledger has online and manual money in one place.
 *
 * `payments.view` without `payments.reconcile` reads the same numbers and
 * changes nothing. Scoping is the server's: each list is already narrowed to
 * the part of the church the holder answers for.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, ExternalLink, FileText } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  AlertBanner,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  MetricTile,
  Modal,
  Pager,
  Skeleton,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList, useConsolePage } from '../../hooks/useConsoleList';
import { save } from './exportRegistrations';
import {
  batchStatus,
  dayOf,
  errorDetail,
  naira,
  receiptStatus,
  type BatchRow,
  type Receipt,
} from './groups';

type Tab = 'to_check' | 'receipts' | 'ledger' | 'owing';

const PAGE_SIZE = 20;

const FIELD =
  'mt-1 w-full rounded-console-md border-2 border-transparent bg-console-tinted px-3.5 py-2.5 text-[16px] leading-6 text-console-text outline-none transition-colors focus:border-console-text';
const LABEL =
  'block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted';

interface EventOption {
  id: string;
  title: string;
  start_datetime: string;
  is_free: boolean;
  payment_method: 'online' | 'manual';
}

/** `LedgerPaymentSerializer`. */
interface LedgerRow {
  id: string;
  reference: string;
  amount: string;
  kind: 'online' | 'manual';
  channel: string;
  payer_name: string;
  for_reference: string;
  node: string;
  bank_reference: string;
  completed_at: string;
}

interface Reconciliation {
  event: { id: string; title: string; payment_method: string };
  summary: {
    expected: string;
    received_online: string;
    received_manual: string;
    received: string;
    under_review: string;
    receipts_waiting: number;
    outstanding: string;
  };
  ledger: LedgerRow[];
  owing: BatchRow[];
  can_reconcile: boolean;
}

const ReceiptPill = ({ status }: { status: Receipt['status'] }) => {
  const s = receiptStatus(status);
  return (
    <span className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold leading-4 ${s.tone}`}>
      {s.label}
    </span>
  );
};

/** The receipt itself, fetched with the session: it is never at a public address. */
const ReceiptFile = ({ receipt }: { receipt: Receipt }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    api
      .get(`/payments/receipts/${receipt.id}/file/`, { responseType: 'blob' })
      .then(({ data }) => {
        if (!alive) return;
        made = URL.createObjectURL(data as Blob);
        setUrl(made);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [receipt.id]);

  if (failed) return <AlertBanner kind="error">We couldn't open the receipt file.</AlertBanner>;
  if (!url) return <Skeleton className="h-64 w-full rounded-console-lg" />;
  const isPdf = receipt.file_type === 'application/pdf' || receipt.file_name.toLowerCase().endsWith('.pdf');
  return (
    <div className="space-y-2">
      {isPdf ? (
        <iframe title="Receipt" src={url} className="h-[420px] w-full rounded-console-lg border border-console-border" />
      ) : (
        <img src={url} alt="The transfer receipt" className="max-h-[420px] w-full rounded-console-lg bg-console-tinted object-contain" />
      )}
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-console-action hover:underline">
        <ExternalLink size={14} /> Open full size
      </a>
    </div>
  );
};

const Review = ({
  receipt,
  canReconcile,
  onClose,
  onDone,
}: {
  receipt: Receipt;
  canReconcile: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) => {
  const [amount, setAmount] = useState(String(Number(receipt.amount_claimed)));
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = receipt.target;
  const due = Number(t.balance ?? Number(t.amount_due) - Number(t.amount_paid));
  const open = receipt.status === 'submitted' && canReconcile;

  const act = async (kind: 'verify' | 'reject') => {
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/payments/receipts/${receipt.id}/${kind}/`,
        kind === 'verify' ? { amount, note } : { reason: note },
      );
      onDone(
        kind === 'verify'
          ? `${naira(amount)} recorded for ${t.reference}.`
          : `The receipt for ${t.reference} was rejected. The coordinator has been told why.`,
      );
    } catch (err) {
      setError(errorDetail(err, "That didn't go through. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Receipt for ${t.reference}`}
      subtitle={`${t.event_title} · ${t.node || 'No part of the church'} · sent by ${receipt.submitted_by_name || 'someone'} on ${dayOf(receipt.created_at)}`}
      onClose={onClose}
      width={760}
      footer={
        open ? (
          rejecting ? (
            <>
              <Btn variant="ghost" onClick={() => setRejecting(false)}>
                Back
              </Btn>
              <Btn variant="danger" size="md" disabled={busy || !note.trim()} onClick={() => act('reject')}>
                {busy ? 'Rejecting…' : 'Reject the receipt'}
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="danger" size="md" onClick={() => setRejecting(true)}>
                Reject
              </Btn>
              <Btn variant="go" size="md" disabled={busy || !(Number(amount) > 0)} onClick={() => act('verify')}>
                {busy ? 'Recording…' : `Verify ${naira(amount)}`}
              </Btn>
            </>
          )
        ) : (
          <Btn variant="ghost" onClick={onClose}>
            Close
          </Btn>
        )
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <ReceiptFile receipt={receipt} />
        <div className="space-y-3">
          {error && <AlertBanner kind="error">{error}</AlertBanner>}
          {receipt.duplicates.length > 0 && (
            <AlertBanner kind="caution">
              {receipt.duplicates.some((d) => d.same_file)
                ? 'The same file was sent before'
                : 'Another receipt has the same bank reference'}
              {' '}({receipt.duplicates.length}). Make sure this is a different transfer.
            </AlertBanner>
          )}
          <dl className="rounded-console-lg bg-console-tinted px-4 py-1.5 text-[14px]">
            {[
              ['Claimed', naira(receipt.amount_claimed)],
              ['Still owed', naira(due)],
              ['Paid on', dayOf(receipt.paid_on)],
              ['From', receipt.payer_name || '—'],
              ['Reference', receipt.bank_reference || '—'],
              ...(t.kind === 'batch' ? [['Seats', String(t.headcount ?? '')]] : [['Attendee', t.attendee_name ?? '']]),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-t border-console-border py-2 first:border-t-0">
                <dt className="text-console-muted">{label}</dt>
                <dd className="text-right font-semibold text-console-text">{value}</dd>
              </div>
            ))}
          </dl>
          {Number(receipt.amount_claimed) !== due && receipt.status === 'submitted' && (
            <p className="flex items-start gap-1.5 text-[13px] leading-5 text-console-caution">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              The amount claimed is not what is owed. Record what the statement shows.
            </p>
          )}
          {open && !rejecting && (
            <>
              <label className="block">
                <span className={LABEL}>Amount that arrived (₦)</span>
                <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD} />
              </label>
              <label className="block">
                <span className={LABEL}>Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} placeholder="e.g. statement line 14" />
              </label>
            </>
          )}
          {open && rejecting && (
            <label className="block">
              <span className={LABEL}>Why it is rejected</span>
              <textarea
                rows={3}
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={FIELD}
                placeholder="The coordinator sees this. Say what to fix."
              />
            </label>
          )}
          {receipt.status !== 'submitted' && (
            <div className="space-y-1">
              <ReceiptPill status={receipt.status} />
              <p className="text-[13px] leading-5 text-console-body">
                {receipt.status === 'verified'
                  ? `${naira(receipt.amount_verified)} recorded`
                  : 'Rejected'}{' '}
                by {receipt.reviewed_by_name || 'a reviewer'} on {dayOf(receipt.reviewed_at)}
                {receipt.review_note ? `: ${receipt.review_note}` : '.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

const ReceiptTable = ({
  items,
  onOpen,
}: {
  items: Receipt[];
  onOpen: (r: Receipt) => void;
}) => (
  <Table>
    <thead>
      <tr>
        <Th>For</Th>
        <Th>Where</Th>
        <Th>Claimed</Th>
        <Th>Paid on</Th>
        <Th>Sent by</Th>
        <Th>Status</Th>
        <Th />
      </tr>
    </thead>
    <tbody>
      {items.map((r) => (
        <tr key={r.id} className="cursor-pointer hover:bg-console-tinted" onClick={() => onOpen(r)}>
          <Td>
            <span className="font-mono text-[13px] font-semibold text-console-text">{r.target.reference}</span>
            <span className="block text-[12px] text-console-muted">{r.target.event_title}</span>
          </Td>
          <Td>{r.target.node || '—'}</Td>
          <Td className="tabular-nums">
            {naira(r.amount_claimed)}
            {r.duplicates.length > 0 && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-console-caution">
                <AlertTriangle size={12} /> Possible duplicate
              </span>
            )}
          </Td>
          <Td>{dayOf(r.paid_on)}</Td>
          <Td>{r.submitted_by_name || '—'}</Td>
          <Td>
            <ReceiptPill status={r.status} />
          </Td>
          <Td>
            <FileText size={16} className="text-console-muted" />
          </Td>
        </tr>
      ))}
    </tbody>
  </Table>
);

export const Payments = () => {
  const { can } = useConsoleAuth();
  const canReconcile = can('payments.reconcile');
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('to_check');
  const [page, setPage] = useState(1);
  const [eventId, setEventId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const events = useConsoleList<EventOption>('/events/events/', {
    params: { ordering: '-start_datetime', page_size: 100 },
    errorMessage: "We couldn't load the events.",
  });
  const paid = useMemo(() => events.items.filter((e) => !e.is_free), [events.items]);
  useEffect(() => {
    if (!eventId && paid.length) setEventId(paid[0].id);
  }, [eventId, paid]);

  const receiptParams = {
    ...(tab === 'to_check' ? { status: 'submitted' } : {}),
    ...(eventId ? { event: eventId } : {}),
    page,
    page_size: PAGE_SIZE,
  };
  const receipts = useConsolePage<Receipt>('/payments/receipts/', {
    enabled: tab === 'to_check' || tab === 'receipts',
    params: receiptParams,
    errorMessage: "We couldn't load the receipts. Try again.",
  });

  const reconciliation = useQuery({
    queryKey: ['reconciliation', eventId],
    queryFn: async () =>
      (await api.get<Reconciliation>('/payments/reconciliation/', { params: { event: eventId } })).data,
    enabled: Boolean(eventId),
  });

  // Straight to one receipt, from the email that asked for it to be checked.
  const linked = params.get('receipt');
  const linkedReceipt = useQuery({
    queryKey: ['receipt', linked],
    queryFn: async () => (await api.get<Receipt>(`/payments/receipts/${linked}/`)).data,
    enabled: Boolean(linked),
  });
  const [opened, setOpened] = useState<Receipt | null>(null);
  const reviewing = opened ?? linkedReceipt.data ?? null;

  const close = () => {
    setOpened(null);
    if (linked) setParams({});
  };
  const done = (message: string) => {
    close();
    setNotice(message);
    receipts.reload();
    queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
  };

  const exportLedger = async () => {
    if (!eventId) return;
    setExporting(true);
    try {
      const { data } = await api.get('/payments/reconciliation/', {
        params: { event: eventId, export: 'csv' },
        responseType: 'blob',
      });
      const title = paid.find((e) => e.id === eventId)?.title ?? 'event';
      save(data as Blob, `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-payments.csv`);
    } finally {
      setExporting(false);
    }
  };

  const s = reconciliation.data?.summary;
  const loadingSummary = reconciliation.isLoading && Boolean(eventId);

  return (
    <ScreenShell
      title="Payments"
      subtitle="Check bank-transfer receipts against the statement, and see what each event expects against what has come in."
      readOnly={!canReconcile}
      actions={
        <Btn variant="soft" size="md" disabled={!eventId || exporting} onClick={exportLedger}>
          <Download size={16} /> {exporting ? 'Exporting…' : 'Ledger CSV'}
        </Btn>
      }
    >
      <div className="mb-4 max-w-md">
        <label className="block">
          <span className={LABEL}>Event</span>
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setPage(1);
            }}
            className={FIELD}
          >
            {paid.length === 0 && <option value="">No paid events</option>}
            {paid.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {dayOf(e.start_datetime)} · {e.payment_method === 'manual' ? 'transfer' : 'online'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && (
        <AlertBanner kind="success" className="mb-4">
          {notice}
        </AlertBanner>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricTile label="Expected" value={s && naira(s.expected)} loading={loadingSummary} />
        <MetricTile label="Received online" value={s && naira(s.received_online)} loading={loadingSummary} />
        <MetricTile label="Received by transfer" value={s && naira(s.received_manual)} loading={loadingSummary} />
        <MetricTile
          label="Being checked"
          value={s && naira(s.under_review)}
          change={s ? `${s.receipts_waiting} receipt${s.receipts_waiting === 1 ? '' : 's'}` : undefined}
          loading={loadingSummary}
        />
        <MetricTile label="Outstanding" value={s && naira(s.outstanding)} loading={loadingSummary} />
      </div>

      <Tabs
        tabs={[
          { id: 'to_check', label: 'To check', count: s?.receipts_waiting },
          { id: 'receipts', label: 'All receipts' },
          { id: 'ledger', label: 'Ledger' },
          { id: 'owing', label: 'Groups still owing', count: reconciliation.data?.owing.length },
        ]}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
      />

      <Card>
        {tab === 'to_check' || tab === 'receipts' ? (
          receipts.error ? (
            <ErrorState message={receipts.error} onRetry={receipts.reload} />
          ) : receipts.isLoading ? (
            <TableSkeleton />
          ) : receipts.items.length === 0 ? (
            <EmptyState
              title={tab === 'to_check' ? 'Nothing to check' : 'No receipts yet'}
              message={
                tab === 'to_check'
                  ? 'Every receipt sent for this event has been checked.'
                  : 'Receipts appear here when someone pays by transfer and uploads one.'
              }
            />
          ) : (
            <>
              <ReceiptTable items={receipts.items} onOpen={setOpened} />
              <Pager
                page={page}
                pageSize={PAGE_SIZE}
                count={receipts.count}
                shown={receipts.items.length}
                noun="receipts"
                onPage={setPage}
              />
            </>
          )
        ) : reconciliation.error ? (
          <ErrorState message="We couldn't load the payments." onRetry={() => reconciliation.refetch()} />
        ) : reconciliation.isLoading ? (
          <TableSkeleton />
        ) : tab === 'ledger' ? (
          !reconciliation.data?.ledger.length ? (
            <EmptyState message="No money has been recorded for this event yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>For</Th>
                  <Th>Where</Th>
                  <Th>How</Th>
                  <Th>Amount</Th>
                  <Th>Reference</Th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.data.ledger.map((p) => (
                  <tr key={p.id}>
                    <Td>{dayOf(p.completed_at)}</Td>
                    <Td className="font-mono text-[13px]">{p.for_reference}</Td>
                    <Td>{p.node || '—'}</Td>
                    <Td>{p.kind === 'manual' ? 'Bank transfer' : `Online${p.channel ? ` (${p.channel})` : ''}`}</Td>
                    <Td className="tabular-nums font-semibold">{naira(p.amount)}</Td>
                    <Td className="font-mono text-[12px] text-console-body">{p.bank_reference || p.reference}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        ) : !reconciliation.data?.owing.length ? (
          <EmptyState message="No group owes anything for this event." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Group</Th>
                <Th>Where</Th>
                <Th>Coordinator</Th>
                <Th>Owes</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.data.owing.map((b) => {
                const st = batchStatus(b.status);
                return (
                  <tr key={b.id}>
                    <Td className="font-mono text-[13px] font-semibold">
                      <Link className="hover:underline" to={`/admin/groups?batch=${b.id}`}>
                        {b.reference}
                      </Link>
                    </Td>
                    <Td>{b.node_detail?.name}</Td>
                    <Td>
                      {b.created_by_name}
                      {b.contact_phone && <span className="block text-[12px] text-console-muted">{b.contact_phone}</span>}
                    </Td>
                    <Td className="tabular-nums">
                      {naira(b.balance)}
                      <span className="block text-[12px] text-console-muted">of {naira(b.amount_due)}</span>
                    </Td>
                    <Td>
                      <span className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold ${st.tone}`}>
                        {st.label}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {reviewing && (
        <Review
          key={reviewing.id}
          receipt={reviewing}
          canReconcile={canReconcile}
          onClose={close}
          onDone={done}
        />
      )}
    </ScreenShell>
  );
};

export default Payments;
