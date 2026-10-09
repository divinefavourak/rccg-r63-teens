/**
 * Review queue — content waiting on a second pair of eyes.
 *
 * The two-person rule is one sentence: the person who approves may not be the
 * person who submitted. The server enforces it (`content/services/review.py`);
 * this screen's job is to say so before anyone presses a button that will be
 * refused.
 *
 * It reads `GET /content/<type>/review_queue/`, which is the only place the
 * API says who submitted an item. `is_mine` and `can_approve` are decided
 * there, so nothing here compares ids.
 *
 * Approve on your own submission is one of the Console's two deliberate
 * "present but unavailable" controls: it is about this item, not about your
 * authority, so it is shown with the reason beside it rather than removed.
 */
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Lock, Minus } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import DevotionalPreview from '../../components/console/DevotionalPreview';
import {
  AlertBanner,
  Avatar,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Table,
  TableSkeleton,
  Td,
  Th,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { parseAPIDate } from '../../utils/dates';

type Kind = 'devotional' | 'manual' | 'article';

/** One row of the `review_queue` action. */
interface QueueItem {
  id: string;
  kind: Kind;
  title: string;
  for_date: string | null;
  status: string;
  submitted_at: string | null;
  submitted_by: { id: string; display_name: string } | null;
  is_mine: boolean;
  can_approve: boolean;
  /** Present for devotionals only. */
  has_memory_verse?: boolean;
}

const COLLECTIONS: Record<Kind, string> = {
  devotional: 'devotionals',
  manual: 'manuals',
  article: 'articles',
};

const STEPS = ['Draft', 'In review', 'Approved', 'Scheduled', 'Published', 'Archived'];

const dayOf = (value: string | null) =>
  parseAPIDate(value)?.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) ?? 'Any time';

/** "20 min", "3 hours", "2 days": how long something has been waiting. */
function waited(since: string | null, now: number): string {
  const at = since ? new Date(since).getTime() : NaN;
  if (Number.isNaN(at)) return '—';
  const minutes = Math.max(1, Math.round((now - at) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

const keyOf = (item: QueueItem) => `${item.kind}:${item.id}`;

const OwnWorkChip = () => (
  <span className="mt-1.5 inline-flex min-h-[30px] items-center gap-1.5 rounded-full bg-console-tinted px-2.5 py-1 text-[12px] font-semibold leading-4 text-console-body">
    <Lock size={14} className="shrink-0" />
    You submitted this, so someone else must approve it
  </span>
);

const CheckLine = ({
  state,
  children,
}: {
  state: 'done' | 'blocked' | 'optional';
  children: string;
}) => (
  <li className="flex items-center gap-2.5 text-[14px] leading-5 text-console-text">
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
        state === 'done'
          ? 'bg-console-go text-console-on-go'
          : state === 'blocked'
            ? 'bg-console-caution-bg text-console-caution'
            : 'bg-console-tinted text-console-muted'
      }`}
    >
      {state === 'done' ? (
        <Check size={14} strokeWidth={3} />
      ) : state === 'blocked' ? (
        <AlertCircle size={14} strokeWidth={2.5} />
      ) : (
        <Minus size={14} strokeWidth={2.5} />
      )}
    </span>
    <span className={state === 'optional' ? 'text-console-muted' : ''}>{children}</span>
  </li>
);

export const Review = () => {
  const { can } = useConsoleAuth();
  const canPublish = can('content.publish');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [sendingBack, setSendingBack] = useState(false);
  const [notes, setNotes] = useState('');
  const [previewing, setPreviewing] = useState<QueueItem | null>(null);
  // Fixed while the screen is open, so "waiting" does not tick during a read.
  const [now] = useState(() => Date.now());

  const queue = useQuery({
    queryKey: ['review-queue'],
    enabled: can('content.view'),
    queryFn: async () => {
      const kinds = Object.keys(COLLECTIONS) as Kind[];
      // Settled, not all-or-nothing: one collection failing must not hide the
      // devotionals someone is waiting on.
      const pages = await Promise.allSettled(
        kinds.map((kind) =>
          api.get<{ count: number; results: QueueItem[] }>(
            `/content/${COLLECTIONS[kind]}/review_queue/`,
          ),
        ),
      );
      const failed = kinds.filter((_, i) => pages[i].status === 'rejected');
      if (failed.length === kinds.length) {
        throw (pages[0] as PromiseRejectedResult).reason;
      }
      const loaded = pages.flatMap((page) => (page.status === 'fulfilled' ? [page.value.data] : []));
      return {
        items: loaded
          .flatMap((page) => page.results)
          .sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? '')),
        // The server sends at most 200 rows of each kind and the true count
        // beside them; the count is the number that is waiting.
        total: loaded.reduce((sum, page) => sum + (page.count ?? page.results.length), 0),
        failed,
      };
    },
  });

  const items = queue.data?.items ?? [];
  const total = Math.max(queue.data?.total ?? 0, items.length);
  const failed = queue.data?.failed ?? [];
  const selected = items.find((item) => keyOf(item) === selectedKey) ?? items[0] ?? null;

  const select = (item: QueueItem) => {
    setSelectedKey(keyOf(item));
    setSendingBack(false);
    setNotes('');
  };

  const act = useCallback(
    async (item: QueueItem, verb: 'approve' | 'reject', body?: object) => {
      setBusy(true);
      setNotice(null);
      try {
        await api.post(`/content/${COLLECTIONS[item.kind]}/${item.id}/${verb}/`, body ?? {});
        setNotice({
          kind: 'success',
          text:
            verb === 'approve'
              ? `“${item.title}” is approved. It can now be scheduled or published.`
              : `“${item.title}” went back to ${item.submitted_by?.display_name ?? 'its author'} with your note.`,
        });
        setSendingBack(false);
        setNotes('');
        setSelectedKey(null);
        await queue.refetch();
      } catch (err: unknown) {
        // The server's message is the useful one — it distinguishes "you
        // submitted this" from "wrong state". A generic failure would discard
        // exactly the information that helps.
        const detail = (err as { response?: { data?: { detail?: string } } })?.response
          ?.data?.detail;
        setNotice({ kind: 'error', text: detail ?? "That didn't go through. Try again." });
      } finally {
        setBusy(false);
      }
    },
    [queue],
  );

  return (
    <ScreenShell
      crumb="Content  /  Review"
      title="Review queue"
      subtitle="Two people touch everything that goes region-wide. You can never approve your own work."
      readOnly={!canPublish}
      hideScope
      actions={
        items.length > 0 ? (
          <span className="inline-flex h-[26px] items-center gap-1 rounded-full bg-pop-amber pl-1.5 pr-2.5 text-[12px] font-semibold leading-4 text-pop-on">
            <AlertCircle size={14} strokeWidth={2.5} /> {total.toLocaleString()} waiting
          </span>
        ) : undefined
      }
    >
      {previewing && (
        <DevotionalPreview
          id={previewing.id}
          date={previewing.for_date ?? ''}
          onClose={() => setPreviewing(null)}
          onChanged={() => queue.refetch()}
          onEdit={() => setPreviewing(null)}
        />
      )}

      {failed.length > 0 && (
        <AlertBanner
          kind="error"
          action={
            <Btn variant="soft" size="md" onClick={() => queue.refetch()}>
              Try again
            </Btn>
          }
        >
          We couldn't load the {failed.map((kind) => COLLECTIONS[kind]).join(' or ')} waiting
          for review, so this list is incomplete.
        </AlertBanner>
      )}

      {total > items.length && (
        <AlertBanner kind="info">
          Showing the {items.length.toLocaleString()} that have waited longest, of{' '}
          {total.toLocaleString()}. The rest appear as these are dealt with.
        </AlertBanner>
      )}

      {notice && (
        <AlertBanner
          kind={notice.kind}
          className="mb-4"
          action={
            <Btn variant="soft" size="md" onClick={() => setNotice(null)}>
              Dismiss
            </Btn>
          }
        >
          {notice.text}
        </AlertBanner>
      )}

      {queue.isPending ? (
        <Card>
          <TableSkeleton rows={5} />
        </Card>
      ) : queue.isError ? (
        <Card>
          <ErrorState
            message="We couldn't load the review queue. Try again."
            onRetry={() => queue.refetch()}
          />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing is waiting for review"
            message="When an author submits a devotional, manual or article, it appears here for a second person to approve."
          />
        </Card>
      ) : (
        <div className="flex flex-col items-start gap-4 xl:flex-row">
          <Card className="w-full min-w-0 flex-1">
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>For</Th>
                  <Th>Submitted by</Th>
                  <Th>Waiting</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelected = selected !== null && keyOf(item) === keyOf(selected);
                  const author = item.is_mine
                    ? 'You'
                    : (item.submitted_by?.display_name ?? 'Unknown');
                  return (
                    <tr
                      key={keyOf(item)}
                      className={isSelected ? 'bg-console-action-light' : 'hover:bg-console-tinted'}
                    >
                      <Td>
                        <button
                          type="button"
                          onClick={() => select(item)}
                          aria-pressed={isSelected}
                          className="block w-full rounded-console-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text"
                        >
                          <span className="block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted">
                            {item.kind}
                          </span>
                          <span className="block font-semibold leading-5 text-console-text">
                            {item.title}
                          </span>
                        </button>
                        {canPublish && item.is_mine && <OwnWorkChip />}
                      </Td>
                      <Td className="whitespace-nowrap text-console-text">
                        {dayOf(item.for_date)}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Avatar name={item.submitted_by?.display_name ?? '?'} size={28} />
                          <span className="text-console-text">{author}</span>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-console-body">
                        {waited(item.submitted_at, now)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          {selected && (
            <Card className="flex w-full shrink-0 flex-col gap-4 p-5 xl:w-[400px]">
              <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted">
                {selected.kind} · {dayOf(selected.for_date)}
              </p>
              <h2 className="text-[28px] font-extrabold leading-9 tracking-[-0.02em] text-console-text">
                {selected.title}
              </h2>
              <div className="flex items-center gap-2 text-[14px] leading-5 text-console-body">
                <Avatar name={selected.submitted_by?.display_name ?? '?'} size={28} />
                Submitted by{' '}
                {selected.is_mine ? 'you' : (selected.submitted_by?.display_name ?? 'someone unknown')}{' '}
                · {waited(selected.submitted_at, now)} ago
              </div>

              <ol className="grid grid-cols-6 gap-1" aria-label="Where this is in the pipeline: In review">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex flex-col gap-1">
                    <span
                      className={`h-1 rounded-full ${i <= 1 ? 'bg-console-text' : 'bg-console-tinted'}`}
                    />
                    <span
                      className={`truncate text-[12px] leading-4 ${
                        i === 1 ? 'font-semibold text-console-text' : 'font-medium text-console-muted'
                      }`}
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <div>
                <h3 className="mb-2.5 text-[17px] font-bold leading-6 text-console-text">
                  Ready to publish?
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {selected.has_memory_verse !== undefined && (
                    <CheckLine state={selected.has_memory_verse ? 'done' : 'blocked'}>
                      {selected.has_memory_verse
                        ? 'Memory verse set'
                        : 'No memory verse. It cannot publish until one is set.'}
                    </CheckLine>
                  )}
                  <CheckLine state={selected.can_approve ? 'done' : 'blocked'}>
                    {selected.can_approve
                      ? 'Submitted by someone other than you'
                      : 'You submitted this, so someone else must approve it'}
                  </CheckLine>
                </ul>
              </div>

              {sendingBack ? (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="send-back-note"
                    className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted"
                  >
                    What needs to change
                  </label>
                  <textarea
                    id="send-back-note"
                    autoFocus
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-console-md bg-console-tinted px-3.5 py-3 text-[16px] leading-6 text-console-text outline-none placeholder:text-console-muted focus:outline focus:outline-2 focus:outline-console-text"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Btn
                      variant="primary"
                      size="md"
                      disabled={busy || !notes.trim()}
                      onClick={() => act(selected, 'reject', { notes: notes.trim() })}
                    >
                      {busy ? 'Sending…' : 'Send back'}
                    </Btn>
                    <Btn size="md" onClick={() => setSendingBack(false)}>
                      Cancel
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {/* Absent for anyone without content.publish. */}
                  {canPublish && (
                    <>
                      <Btn
                        variant="primary"
                        size="md"
                        disabled={busy || !selected.can_approve}
                        onClick={() => act(selected, 'approve')}
                      >
                        <Check size={16} /> {busy ? 'Approving…' : 'Approve'}
                      </Btn>
                      <Btn size="md" disabled={busy} onClick={() => setSendingBack(true)}>
                        Send back
                      </Btn>
                    </>
                  )}
                  {selected.kind === 'devotional' && (
                    <Btn variant="soft" size="md" onClick={() => setPreviewing(selected)}>
                      Preview
                    </Btn>
                  )}
                </div>
              )}

              {canPublish && !sendingBack && (
                <p className="text-[12px] font-medium leading-4 text-console-muted">
                  Sending back needs a note. The author sees it and can resubmit.
                </p>
              )}
            </Card>
          )}
        </div>
      )}
    </ScreenShell>
  );
};

export default Review;
