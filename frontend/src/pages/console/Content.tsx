/**
 * Content — devotionals by day, and where the gaps are.
 *
 * Two designs from one component, chosen by permission:
 *
 * * `content.manage` — a workspace. A gap opens the editor.
 * * `content.view` alone — a **forecast**. A Province Coordinator reads what
 *   their teens are about to receive; they get the same calendar with no add
 *   affordance, because they have nothing to add with.
 *
 * The gap banner is the point of the screen. A day with no approved devotional
 * is a day the whole product has nothing to say, so uncovered days are named up
 * front rather than discovered by scanning.
 *
 * The days come from `GET /content/devotionals/calendar/`, which answers one
 * entry per day *including the empty ones* and decides coverage on the server.
 * The paged list is the wrong source for this: a month is up to 31 rows and a
 * page is 20, so the last third of the month would read as gaps.
 */
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, DownloadCloud, Plus } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import { PermissionGate } from '../../components/console/PermissionGate';
import DevotionalPreview from '../../components/console/DevotionalPreview';
import { DevotionalEditor, type DevotionalDraft } from '../../components/console/DevotionalEditor';
import {
  AlertBanner,
  Btn,
  Card,
  ErrorState,
  Modal,
  PublishPill,
  Skeleton,
} from '../../components/console/primitives';
import { OBJECTS } from '../../assets/site';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { parseAPIDate, toISODate, todayISO } from '../../utils/dates';

/** One entry of the `calendar` action's `days`. */
interface CalendarDay {
  date: string;
  status: string | null;
  is_covered: boolean;
  devotional: { id: string; title: string; status: string } | null;
}

interface CalendarResponse {
  days: CalendarDay[];
  /** Uncovered ISO dates in the next 14 days, whatever month is on screen. */
  imminent_gaps: string[];
  /** Consecutive covered days from today. */
  buffer_days: number;
}

const NO_DAYS: string[] = [];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ROUND =
  'flex h-10 w-10 items-center justify-center rounded-full bg-console-tinted text-console-text transition-colors hover:bg-console-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text';

const FIELD_LABEL =
  'block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted';
const FIELD_INPUT =
  'mt-1 w-full rounded-console-md border-2 border-transparent bg-console-tinted px-3.5 py-2.5 text-[16px] leading-6 text-console-text outline-none transition-colors focus:border-console-text';

/** The ISO day `days` away from `iso`, in local calendar terms. */
const shiftDay = (iso: string, days: number) => {
  const d = parseAPIDate(iso) ?? new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
};

const shortDay = (iso: string) =>
  parseAPIDate(iso)?.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) ?? iso;

export const Content = () => {
  const { can } = useConsoleAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [today] = useState(todayISO);

  const canManage = can('content.manage');
  /** Open the authoring modal: an existing record to edit, or a bare date. */
  const [editing, setEditing] = useState<
    { devotional?: DevotionalDraft; date: string } | null
  >(null);
  const [preview, setPreview] = useState<{ id?: string; date: string } | null>(null);
  const [importing, setImporting] = useState(false);
  // The import window: a day, and how far either side of it to reach.
  const [importOpen, setImportOpen] = useState(false);
  const [importDate, setImportDate] = useState(today);
  const [daysBefore, setDaysBefore] = useState(6);
  const [daysAfter, setDaysAfter] = useState(0);
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // From the Monday of the week the 1st falls in, so the first row is whole.
  // JS weeks start on Sunday; church weeks do not.
  const { start, end } = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    return {
      start: toISODate(new Date(first.getFullYear(), first.getMonth(), 1 - lead)),
      end: toISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
    };
  }, [month]);

  const calendar = useQuery({
    queryKey: ['content-calendar', start, end],
    enabled: can('content.view'),
    queryFn: async () => {
      const { data } = await api.get<CalendarResponse>('/content/devotionals/calendar/', {
        params: { start, end },
      });
      return data;
    },
  });
  const reload = calendar.refetch;

  /**
   * Fill days from the web scraper: the chosen day, `daysBefore` days back and
   * `daysAfter` days forward.
   *
   * `force` is not sent: the endpoint skips days that already have a devotional
   * unless forced, and overwriting something a person wrote is not what anyone
   * means by "import". A day the source has not published yet is skipped too,
   * so reaching forward only finds what is already online.
   */
  const runImport = useCallback(async () => {
    setImporting(true);
    setImportMessage(null);
    try {
      const { data } = await api.post<{ results?: unknown[]; errors?: unknown[] }>(
        '/content/devotionals/fetch_from_web/',
        { date: importDate, days_before: daysBefore, days_after: daysAfter },
      );
      setImportOpen(false);
      const made = (data.results ?? []).length;
      const skipped = (data.errors ?? []).length;
      setImportMessage({
        ok: true,
        text: made
          ? `Imported ${made} ${made === 1 ? 'devotional' : 'devotionals'}${skipped ? `, skipped ${skipped}` : ''}. They are drafts until reviewed.`
          : 'Nothing new to import. Those days already have a devotional, or the source has not published them yet.',
      });
      await reload();
    } catch (err: unknown) {
      const detail = (
        err as { response?: { data?: { detail?: string; error?: string } } }
      )?.response?.data;
      setImportMessage({
        ok: false,
        text: detail?.detail ?? detail?.error ?? "The import didn't run. Try again.",
      });
    } finally {
      setImporting(false);
    }
  }, [reload, importDate, daysBefore, daysAfter]);

  const days = calendar.data?.days ?? [];
  const imminent = calendar.data?.imminent_gaps ?? NO_DAYS;
  const imminentSet = useMemo(() => new Set(imminent), [imminent]);

  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthPrefix = toISODate(month).slice(0, 7);

  const open = (day: CalendarDay) => {
    /*
      An empty day opens the editor; a filled one opens the preview (which
      itself offers Edit). Tapping a gap and being shown a read-only "nothing
      here" was the dead end that made the Console unable to author anything.
    */
    if (day.devotional) setPreview({ id: day.devotional.id, date: day.date });
    else if (canManage) setEditing({ date: day.date });
  };

  return (
    <ScreenShell
      crumb="Content  /  Calendar"
      title="Devotional calendar"
      subtitle={
        canManage
          ? 'Every day is a slot. A day counts as covered only when its devotional is Approved, Scheduled or Published.'
          : 'What the teens in your part of the church will receive, day by day.'
      }
      readOnly={!canManage}
      hideScope
      actions={
        <PermissionGate permission="content.manage">
          {/*
            Scrapes published devotionals from the web and fills gaps. It
            never overwrites an existing day: silently replacing a devotional
            someone wrote is not an "import".
          */}
          <Btn size="md" onClick={() => setImportOpen(true)}>
            <DownloadCloud size={16} /> Import from web
          </Btn>
          <Btn variant="primary" size="md" onClick={() => setEditing({ date: today })}>
            <Plus size={16} /> New devotional
          </Btn>
        </PermissionGate>
      }
    >
      {importOpen && (
        <Modal
          title="Import devotionals from the web"
          subtitle="Days that already have a devotional are left alone. Imported ones arrive as drafts for review."
          onClose={() => setImportOpen(false)}
          width={520}
          footer={
            <>
              <Btn size="md" onClick={() => setImportOpen(false)} disabled={importing}>
                Cancel
              </Btn>
              <Btn
                variant="primary"
                size="md"
                disabled={importing || !importDate || daysBefore + daysAfter + 1 > 31}
                onClick={runImport}
              >
                {importing
                  ? 'Importing…'
                  : `Import ${daysBefore + daysAfter + 1} ${daysBefore + daysAfter === 0 ? 'day' : 'days'}`}
              </Btn>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-3">
              <span className={FIELD_LABEL}>Around this day</span>
              <input
                type="date"
                value={importDate}
                onChange={(e) => setImportDate(e.target.value)}
                className={FIELD_INPUT}
              />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Days before</span>
              <input
                type="number"
                min={0}
                max={30}
                value={daysBefore}
                onChange={(e) => setDaysBefore(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                className={FIELD_INPUT}
              />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Days after</span>
              <input
                type="number"
                min={0}
                max={30}
                value={daysAfter}
                onChange={(e) => setDaysAfter(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                className={FIELD_INPUT}
              />
            </label>
          </div>
          <p className="mt-3 text-[14px] leading-5 text-console-body">
            {importDate
              ? `From ${shortDay(shiftDay(importDate, -daysBefore))} to ${shortDay(shiftDay(importDate, daysAfter))}.`
              : 'Choose a day.'}{' '}
            {daysBefore + daysAfter + 1 > 31
              ? 'That is more than 31 days; import in smaller pieces.'
              : 'A day the source has not published yet is skipped.'}
          </p>
        </Modal>
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

      <div className="flex flex-col gap-5">
        {importMessage && (
          <AlertBanner
            kind={importMessage.ok ? 'success' : 'error'}
            action={
              <Btn variant="soft" size="md" onClick={() => setImportMessage(null)}>
                Dismiss
              </Btn>
            }
          >
            {importMessage.text}
          </AlertBanner>
        )}

        {imminent.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-console-lg bg-pop-amber px-4 py-3 text-pop-on">
            <img src={OBJECTS.calendar} alt="" aria-hidden="true" className="h-11 w-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold leading-6">
                {imminent.length} {imminent.length === 1 ? 'day' : 'days'} in the next 14{' '}
                {imminent.length === 1 ? 'has' : 'have'} no approved devotional
              </p>
              <p className="text-[14px] leading-5">
                Draft and In review do not count as covered.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {imminent.slice(0, 4).map((day) =>
                canManage ? (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setEditing({ date: day })}
                    aria-label={`Write the devotional for ${shortDay(day)}`}
                    className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-[14px] font-semibold leading-5 text-on-ink transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {shortDay(day)}
                  </button>
                ) : (
                  <span
                    key={day}
                    className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-[14px] font-semibold leading-5 text-on-ink"
                  >
                    {shortDay(day)}
                  </span>
                ),
              )}
              {imminent.length > 4 && (
                <span className="inline-flex h-10 items-center text-[14px] font-semibold">
                  and {imminent.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
            {monthLabel}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              className={ROUND}
              aria-label="Previous month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className={ROUND}
              aria-label="Next month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <Card className="p-4">
          {calendar.isPending ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-[100px] rounded-console-md" />
              ))}
            </div>
          ) : calendar.isError ? (
            <ErrorState
              message={`We couldn't load the calendar for ${monthLabel}.`}
              onRetry={() => reload()}
            />
          ) : (
            <div className="console-scroll overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="mb-2 grid grid-cols-7 gap-2 px-2">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {days.map((day) => {
                    const item = day.devotional;
                    const isToday = day.date === today;
                    const past = day.date < today;
                    const outside = !day.date.startsWith(monthPrefix);
                    const gap = !item && imminentSet.has(day.date);
                    const clickable = Boolean(item) || canManage;
                    const number = Number(day.date.slice(8));

                    const tone = isToday
                      ? 'bg-console-action-light outline outline-2 -outline-offset-2 outline-console-text'
                      : gap
                        ? 'bg-console-caution-bg outline-dashed outline-[1.5px] -outline-offset-2 outline-console-caution'
                        : 'bg-console-tinted';

                    const body = (
                      <>
                        <span
                          className={`text-[12px] font-medium leading-4 tabular-nums ${
                            gap ? 'text-console-caution' : 'text-console-muted'
                          }`}
                        >
                          {number}
                          {isToday && ' · Today'}
                        </span>
                        {item ? (
                          <>
                            <span className="line-clamp-2 text-[14px] font-semibold leading-5 text-console-text">
                              {item.title}
                            </span>
                            <span className="mt-auto pt-1.5">
                              <PublishPill status={item.status} />
                            </span>
                          </>
                        ) : gap ? (
                          <>
                            <span className="text-[14px] font-semibold leading-5 text-console-text">
                              No devotional
                            </span>
                            {canManage && (
                              <span className="mt-auto inline-flex h-[26px] items-center gap-1 self-start rounded-full bg-ink pl-1.5 pr-2.5 text-[12px] font-semibold leading-4 text-on-ink">
                                <Plus size={14} strokeWidth={2.5} /> Add
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[12px] font-medium leading-4 text-console-muted">
                            {past ? 'Nothing was published' : 'Not planned yet'}
                          </span>
                        )}
                      </>
                    );

                    const className = `flex min-h-[100px] flex-col items-start gap-1.5 rounded-console-md p-2.5 text-left ${tone} ${
                      (past || outside) && !isToday ? 'opacity-60' : ''
                    }`;

                    return clickable ? (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => open(day)}
                        aria-label={
                          item
                            ? `${shortDay(day.date)}: ${item.title}, ${item.status.replace('_', ' ')}`
                            : `${shortDay(day.date)}: write the devotional`
                        }
                        className={`${className} transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text`}
                      >
                        {body}
                      </button>
                    ) : (
                      <div key={day.date} className={className}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        {calendar.data && (
          <p className="text-[14px] leading-5 text-console-body">
            {calendar.data.buffer_days === 0
              ? 'Today has no approved devotional.'
              : `The next ${calendar.data.buffer_days} ${
                  calendar.data.buffer_days === 1 ? 'day is' : 'days are'
                } covered without a break.`}
          </p>
        )}
      </div>
    </ScreenShell>
  );
};

export default Content;
