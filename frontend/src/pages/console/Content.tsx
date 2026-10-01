/**
 * Content — devotionals by day, and where the gaps are.
 *
 * Two designs from one component, chosen by permission:
 *
 * * `content.manage` — a workspace. Status filter, and (once the editor is
 *   built) authoring.
 * * `content.view` alone — a **forecast**. A Province Coordinator reads what
 *   their teens are about to receive; they get the same calendar with no
 *   toolbar and no add affordance, because they have nothing to add with.
 *
 * The gap banner is the point of the screen. A day with no approved devotional
 * is a day the whole product has nothing to say, so uncovered days are counted
 * up front rather than discovered by scanning.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  Plus,
} from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import { PermissionGate } from '../../components/console/PermissionGate';
import DevotionalPreview from '../../components/console/DevotionalPreview';
import { DevotionalEditor, type DevotionalDraft } from '../../components/console/DevotionalEditor';
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';
import { toISODate, todayISO } from '../../utils/dates';

interface Devotional {
  id: string;
  title: string;
  date: string;
  status: string;
}

/** `PublishableMixin.Status`. Only these three mean a day is actually covered. */
const COVERED = new Set(['approved', 'scheduled', 'published']);

const STATUS_TONE: Record<
  string,
  'neutral' | 'info' | 'caution' | 'success' | 'action'
> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'action',
  scheduled: 'action',
  published: 'success',
  archived: 'neutral',
};

// Local calendar day. toISOString() would convert local midnight to UTC,
// which in Lagos (UTC+1) is still the previous day — every cell was keyed
// one day earlier than its label. See src/utils/dates.ts.
const iso = toISODate;

export const Content = () => {
  const { can } = useConsoleAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const canManage = can('content.manage');
  /** Open the authoring modal: an existing record to edit, or a bare date. */
  const [editing, setEditing] = useState<
    { devotional?: DevotionalDraft; date: string } | null
  >(null);

  const [preview, setPreview] = useState<{ id?: string; date: string } | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const { from, to } = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return { from: iso(start), to: iso(end) };
  }, [month]);

  const { items, isLoading, error, reload } = useConsoleList<Devotional>(
    '/content/devotionals/',
    {
      // date_from/date_to are handled in DevotionalViewSet.get_queryset.
      params: { date_from: from, date_to: to, ordering: 'date' },
      enabled: can('content.view'),
      errorMessage: 'Could not load the devotional calendar.',
    },
  );

  /**
   * Backfill the last 7 days from the web scraper.
   *
   * `force` is not sent: the endpoint skips days that already have a devotional
   * unless forced, and overwriting something a person wrote is not what anyone
   * means by "import". The response reports created and skipped separately, so
   * "nothing happened" and "everything was already there" read differently.
   */
  const runImport = useCallback(async () => {
    setImporting(true);
    setImportMessage(null);
    try {
      const { data } = await api.post<{
        created?: unknown[];
        results?: unknown[];
        errors?: unknown[];
      }>('/content/devotionals/fetch_from_web/', { days: 7 });
      const made = (data.results ?? data.created ?? []).length;
      const skipped = (data.errors ?? []).length;
      setImportMessage({
        ok: true,
        text: made
          ? `Imported ${made} devotional${made === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already covered` : ''}.`
          : 'Nothing new to import — every day in the last week already has one.',
      });
      await reload();
    } catch (err: unknown) {
      const detail = (
        err as { response?: { data?: { detail?: string; error?: string } } }
      )?.response?.data;
      setImportMessage({
        ok: false,
        text: detail?.detail ?? detail?.error ?? 'The import failed.',
      });
    } finally {
      setImporting(false);
    }
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, Devotional>();
    for (const d of items) map.set(d.date?.slice(0, 10), d);
    return map;
  }, [items]);

  /** Calendar cells, padded so the 1st lands on the right weekday. Monday-first. */
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    const lead = (first.getDay() + 6) % 7; // JS weeks start Sunday; church weeks don't.
    const out: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return out;
  }, [month]);

  /** Uncovered days from today onward — past gaps cannot be fixed. */
  const gaps = useMemo(() => {
    const today = iso(new Date());
    return cells
      .filter((d): d is Date => Boolean(d))
      .map(iso)
      .filter((day) => day >= today && !COVERED.has(byDate.get(day)?.status ?? ''));
  }, [cells, byDate]);

  const monthLabel = month.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScreenShell
      title="Content"
      subtitle={
        canManage
          ? 'Every day needs an approved devotional. This is where you see which do not have one.'
          : 'What the teens in your scope will receive, day by day.'
      }
      readOnly={!canManage}
      actions={
        <>
          {/*
            Auto-import scrapes published devotionals from the web and fills
            gaps. Gated on content.manage because it creates content; it never
            overwrites an existing day unless `force` is set, which this UI
            deliberately does not offer — silently replacing a devotional
            someone wrote is not an "import".
          */}
          <PermissionGate permission="content.manage">
            <Btn
              variant="primary"
              size="sm"
              onClick={() => setEditing({ date: todayISO() })}
              title="Write a devotional"
            >
              <Plus size={14} />
              New devotional
            </Btn>
          </PermissionGate>

          <PermissionGate permission="content.manage">
            <Btn
              variant="secondary"
              size="sm"
              disabled={importing}
              onClick={runImport}
              title="Fetch the last 7 days of devotionals from the web, skipping days that already have one"
            >
              <DownloadCloud size={14} />
              {importing ? 'Importing…' : 'Auto-import'}
            </Btn>
          </PermissionGate>

          <div className="flex items-center gap-1">
            <Btn
              variant="ghost"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
              aria-label="Previous month"
            >
              <ChevronLeft size={15} />
            </Btn>
            <span className="min-w-[130px] text-center text-[13px] font-medium text-console-text">
              {monthLabel}
            </span>
            <Btn
              variant="ghost"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
              aria-label="Next month"
            >
              <ChevronRight size={15} />
            </Btn>
          </div>
        </>
      }
    >
      {importMessage && (
        <div
          className={`mb-3 rounded-console-md px-3 py-2 text-[13px] ${
            importMessage.ok
              ? 'bg-console-success-bg text-console-success'
              : 'bg-console-danger-bg text-console-danger'
          }`}
        >
          {importMessage.text}
        </div>
      )}

      {editing && (
        <DevotionalEditor
          devotional={editing.devotional}
          defaultDate={editing.date}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {preview && (
        <DevotionalPreview
          id={preview.id}
          date={preview.date}
          onClose={() => setPreview(null)}
          onChanged={reload}
          onEdit={(target) => {
            setPreview(null);
            setEditing({ devotional: { id: target.id, date: target.date }, date: target.date });
          }}
        />
      )}

      {gaps.length > 0 && !isLoading && !error && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-console-md border border-console-border bg-console-caution-bg px-3 py-2">
          <AlertTriangle size={15} className="shrink-0 text-console-caution" />
          <span className="text-[13px] text-console-caution">
            {gaps.length} {gaps.length === 1 ? 'day has' : 'days have'} no
            approved devotional in {monthLabel}.
          </span>
        </div>
      )}

      <Card className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <div className="mb-1.5 grid grid-cols-7 gap-1.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-semibold uppercase tracking-wider text-console-subtle"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((date, i) => {
                if (!date) return <div key={`pad-${i}`} />;
                const day = iso(date);
                const item = byDate.get(day);
                const isToday = day === iso(new Date());
                const uncovered = !COVERED.has(item?.status ?? '');
                const future = day >= iso(new Date());

                return (
                  <button
                    key={day}
                    type="button"
                    /*
                      An empty day opens the editor; a filled one opens the
                      preview (which itself offers Edit). Tapping a gap and being
                      shown a read-only "nothing here" was the dead end that made
                      the Console unable to author anything.
                    */
                    onClick={() =>
                      item
                        ? setPreview({ id: item.id, date: day })
                        : canManage
                          ? setEditing({ date: day })
                          : setPreview({ date: day })
                    }
                    title={
                      item
                        ? `Preview “${item.title}”`
                        : canManage
                          ? 'Write the devotional for this day'
                          : 'Nothing scheduled for this day'
                    }
                    className={[
                      'min-h-[64px] rounded-console-md border p-1.5 text-left transition-colors hover:border-console-action-hover',
                      isToday
                        ? 'border-console-action'
                        : 'border-console-border',
                      uncovered && future
                        ? 'bg-console-caution-bg'
                        : 'bg-console-surface',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] tabular-nums ${isToday ? 'font-bold text-console-action' : 'text-console-subtle'}`}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                    {item ? (
                      <div className="mt-1">
                        <p className="line-clamp-2 text-[11px] leading-snug text-console-body">
                          {item.title}
                        </p>
                        <div className="mt-1">
                          <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] text-console-subtle">
                        {future ? 'No devotional' : '—'}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {items.length === 0 && (
              <EmptyState
                message={`Nothing scheduled for ${monthLabel}.`}
              />
            )}
          </>
        )}
      </Card>

      {canManage && (
        <p className="mt-3 text-[12px] leading-relaxed text-console-muted">
          Authoring is not built into the Console yet — creating and editing
          devotionals still happens in the legacy panel at{' '}
          <code className="font-mono text-[11px]">/legacy-admin/devotionals</code>.
          Submitting for review and approving already work from here.
        </p>
      )}
    </ScreenShell>
  );
};

export default Content;
