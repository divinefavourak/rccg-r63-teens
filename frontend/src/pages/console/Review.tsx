/**
 * Review queue — content waiting on a second pair of eyes.
 *
 * The two-person rule, made visible: **the person who submitted may not be the
 * person who approves.** `content/services/review.py:94` refuses it, and
 * `ReviewWorkflowMixin` returns 403 rather than 400 for that case, because the
 * request is well-formed and the caller may publish in general — they simply may
 * not be both halves of a two-person check.
 *
 * So Approve is **rendered but blocked** on your own submission, with the reason
 * stated. This is one of exactly two places in the Console where a control is
 * shown-but-unusable, and it earns the exception: the block is a fact about the
 * item, not about the person. Someone else's submission, one row down, is
 * approvable by the same user.
 */
import { useCallback, useMemo, useState } from 'react';
import { Check, Clock, Send, X } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '../../components/console/primitives';
import { ExplanatoryChip } from '../../components/console/PermissionGate';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';

/** The fields the queue needs from DevotionalListSerializer. */
interface ReviewItem {
  id: string;
  title: string;
  date: string;
  status: string;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  review_notes?: string;
  memory_verses?: unknown[];
  has_memory_verse?: boolean;
}

export const Review = () => {
  const { me, can } = useConsoleAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { items, isLoading, error, reload } = useConsoleList<ReviewItem>(
    '/content/devotionals/',
    {
      params: { status: 'in_review', ordering: 'date' },
      enabled: can('content.view'),
      errorMessage: 'Could not load the review queue.',
    },
  );

  const canPublish = can('content.publish');

  const act = useCallback(
    async (id: string, verb: 'approve' | 'reject' | 'publish', body?: object) => {
      setBusyId(id);
      setActionError(null);
      try {
        await api.post(`/content/devotionals/${id}/${verb}/`, body ?? {});
        setRejecting(null);
        setNotes('');
        await reload();
      } catch (err: unknown) {
        // The server's message is the useful one — it distinguishes "you
        // submitted this" from "no memory verse" from "wrong state". Echoing a
        // generic failure would discard exactly the information that helps.
        const detail = (
          err as { response?: { data?: { detail?: string } } }
        )?.response?.data?.detail;
        setActionError(detail ?? 'That action did not go through.');
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  const rows = useMemo(
    () =>
      items.map((item) => {
        const mine = Boolean(
          item.submitted_by && me?.id && item.submitted_by === me.id,
        );
        const verseCount = Array.isArray(item.memory_verses)
          ? item.memory_verses.length
          : undefined;
        const noVerse =
          item.has_memory_verse === false ||
          (verseCount !== undefined && verseCount === 0);
        return { item, mine, noVerse };
      }),
    [items, me],
  );

  return (
    <ScreenShell
      title="Review queue"
      subtitle="Content waiting on a second pair of eyes before it reaches anyone."
    >
      {actionError && (
        <div className="mb-3 rounded-console-md border border-console-border bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {actionError}
        </div>
      )}

      <Card>
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            message="No content is in review. Items appear here when an author submits them, and leave when someone other than the author approves them."
          />
        ) : (
          <ul className="divide-y divide-console-border">
            {rows.map(({ item, mine, noVerse }) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-console-text">
                        {item.title}
                      </span>
                      <Badge tone="info">
                        <Clock size={11} /> In review
                      </Badge>
                      {mine && <Badge tone="neutral">You submitted this</Badge>}
                    </div>
                    <p className="mt-0.5 text-[12px] text-console-subtle">
                      For {formatDate(item.date)}
                      {item.submitted_at &&
                        ` · submitted ${formatDate(item.submitted_at)}`}
                    </p>

                    {item.review_notes && (
                      <p className="mt-1.5 text-[12px] italic text-console-muted">
                        Previous notes: {item.review_notes}
                      </p>
                    )}

                    {/* Both exceptions, stated rather than hidden. */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {canPublish && mine && (
                        <ExplanatoryChip message="You submitted this — someone else has to approve it." />
                      )}
                      {canPublish && noVerse && (
                        <ExplanatoryChip
                          variant="caution"
                          message="No memory verse — this cannot publish until one is set."
                        />
                      )}
                    </div>
                  </div>

                  {/* Absent for anyone without content.publish. */}
                  {canPublish && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Btn
                        variant="ghost"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() =>
                          setRejecting(rejecting === item.id ? null : item.id)
                        }
                      >
                        <X size={13} /> Send back
                      </Btn>
                      <Btn
                        variant="primary"
                        size="sm"
                        // Blocked by the item, not by authority — hence shown.
                        disabled={mine || busyId === item.id}
                        title={
                          mine
                            ? 'The two-person rule: someone other than the submitter must approve.'
                            : undefined
                        }
                        onClick={() => act(item.id, 'approve')}
                      >
                        <Check size={13} /> Approve
                      </Btn>
                    </div>
                  )}
                </div>

                {rejecting === item.id && (
                  <div className="mt-3 rounded-console-md bg-console-tinted p-3">
                    <label className="block text-[11px] font-medium text-console-body">
                      Why is this going back? The author sees this.
                    </label>
                    <textarea
                      autoFocus
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="mt-1.5 w-full rounded-console-sm border border-console-border bg-console-surface px-2.5 py-1.5 text-[13px] text-console-text outline-none focus:border-console-action"
                      placeholder="The anchor scripture doesn't match the theme…"
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Btn variant="ghost" onClick={() => setRejecting(null)}>
                        Cancel
                      </Btn>
                      <Btn
                        variant="secondary"
                        disabled={busyId === item.id}
                        onClick={() => act(item.id, 'reject', { notes })}
                      >
                        <Send size={13} /> Send back to draft
                      </Btn>
                    </div>
                    <p className="mt-2 text-[11px] text-console-subtle">
                      Rejection returns it to the author's drafts with your notes.
                      Re-submitting is the normal next step, not a failure.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </ScreenShell>
  );
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default Review;
