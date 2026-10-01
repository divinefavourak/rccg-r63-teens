/**
 * Preview a devotional as the teen will receive it.
 *
 * Fetches the detail record on open rather than reusing the list row, because
 * the list serializer omits the body, the memory verses and the discussion
 * questions — which are the things you actually want to check before approving.
 *
 * The memory verse is called out separately: it is the Verse of the Day, and its
 * absence blocks publishing (`content/services/review.py` → `validate_publishable`).
 * A reviewer needs to see whether it is there before they hit Approve, not after.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { Badge, Btn, Modal } from './primitives';
import { ExplanatoryChip } from './PermissionGate';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { formatAPIDate } from '../../utils/dates';

interface MemoryVerse {
  id?: string;
  reference?: string;
  text?: string;
  is_primary?: boolean;
}

interface DevotionalDetail {
  id: string;
  title: string;
  date: string;
  status: string;
  content?: string;
  anchor_scripture?: string;
  prayer?: string;
  reflection?: string;
  memory_verses?: MemoryVerse[];
  submitted_by?: string | null;
  review_notes?: string;
}

const STATUS_TONE: Record<
  string,
  'neutral' | 'info' | 'action' | 'success' | 'caution'
> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'action',
  scheduled: 'action',
  published: 'success',
  archived: 'neutral',
};

export const DevotionalPreview = ({
  id,
  date,
  onClose,
  onChanged,
  onEdit,
}: {
  /** Omit to show the "no devotional for this day" state. */
  id?: string;
  date: string;
  onClose: () => void;
  onChanged?: () => void;
  /** Open this devotional in the editor. Omit to hide the Edit action. */
  onEdit?: (item: { id: string; date: string }) => void;
}) => {
  const { me, can } = useConsoleAuth();
  const [item, setItem] = useState<DevotionalDetail | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data } = await api.get<DevotionalDetail>(
        `/content/devotionals/${id}/`,
      );
      setItem(data);
      setError(null);
    } catch {
      setError('Could not load this devotional.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (verb: 'approve' | 'publish' | 'submit_for_review') => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/content/devotionals/${id}/${verb}/`, {});
      await load();
      onChanged?.();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(detail ?? 'That action did not go through.');
    } finally {
      setBusy(false);
    }
  };

  // formatAPIDate, not new Date(date): a bare 'YYYY-MM-DD' parses as UTC
  // midnight, which renders as the previous day for anyone behind UTC.
  const pretty = formatAPIDate(
    date,
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    'en-GB',
  );

  const mine = Boolean(
    item?.submitted_by && me?.id && item.submitted_by === me.id,
  );
  const verses = item?.memory_verses ?? [];
  const noVerse = verses.length === 0;

  return (
    <Modal
      title={item?.title ?? (id ? 'Loading…' : 'No devotional')}
      subtitle={pretty}
      onClose={onClose}
      width={640}
      footer={
        item ? (
          <>
            {/*
              Editing is gated on content.manage and on the item still being
              editable — once published, changing it silently under teens who
              have already read it is a different action from writing it.
            */}
            {onEdit && can('content.manage') && item.status !== 'published' && (
              <Btn
                variant="secondary"
                onClick={() => onEdit({ id: item.id, date })}
              >
                Edit
              </Btn>
            )}
            {can('content.publish') && item.status === 'in_review' && (
              <Btn
                variant="primary"
                // Shown but blocked: the two-person rule is about this item, not
                // about this person. See PermissionGate's docstring.
                disabled={mine || busy}
                title={
                  mine
                    ? 'The two-person rule: someone other than the submitter must approve.'
                    : undefined
                }
                onClick={() => act('approve')}
              >
                Approve
              </Btn>
            )}
            {can('content.publish') &&
              (item.status === 'approved' || item.status === 'scheduled') && (
              <Btn
                variant="primary"
                disabled={noVerse || busy}
                title={
                  noVerse
                    ? 'A devotional cannot publish without a memory verse — it is the Verse of the Day.'
                    : undefined
                }
                onClick={() => act('publish')}
              >
                Publish
              </Btn>
            )}
          </>
        ) : null
      }
    >
      {error && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {error}
        </div>
      )}

      {!id ? (
        <p className="text-[13px] leading-relaxed text-console-muted">
          Nothing is scheduled for {pretty}. A day with no approved devotional is
          a day the app has nothing to say — this is the gap the banner counts.
        </p>
      ) : isLoading ? (
        <p className="text-[13px] text-console-muted">Loading…</p>
      ) : item ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>
              {item.status.replace('_', ' ')}
            </Badge>
            {mine && <Badge tone="neutral">You submitted this</Badge>}
          </div>

          {noVerse && (
            <ExplanatoryChip
              variant="caution"
              message="No memory verse — this cannot publish until one is set."
            />
          )}

          {item.anchor_scripture && (
            <p className="text-[13px] font-medium text-console-body">
              {item.anchor_scripture}
            </p>
          )}

          {verses.length > 0 && (
            <div className="rounded-console-md bg-console-tinted p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
                Memory verse{verses.length > 1 ? 's' : ''}
              </p>
              {verses.map((v, i) => (
                <div key={v.id ?? i} className="mt-1.5">
                  <p className="text-[13px] leading-relaxed text-console-body">
                    {v.text}
                  </p>
                  <p className="mt-0.5 text-[11px] text-console-subtle">
                    {v.reference}
                    {v.is_primary && ' · Verse of the Day'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {item.content && (
            // whitespace-pre-wrap: the body is stored as plain text with real
            // paragraph breaks, and collapsing them would run it together.
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-console-body">
              {item.content}
            </div>
          )}

          {item.reflection && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
                Reflection
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-console-body">
                {item.reflection}
              </p>
            </div>
          )}

          {item.prayer && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
                Prayer
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-console-body">
                {item.prayer}
              </p>
            </div>
          )}

          {item.review_notes && (
            <p className="rounded-console-md bg-console-caution-bg px-3 py-2 text-[12px] italic text-console-caution">
              Review notes: {item.review_notes}
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default DevotionalPreview;
