/**
 * Analytics — scoped aggregate counts.
 *
 * Reads `GET /api/v1/identity/stats/`, which aggregates **in the database**
 * within the caller's authority. Before that endpoint existed this screen
 * counted rows client-side, which meant every figure was silently bounded by
 * pagination — a Regional Coordinator would see "40 registrations" because that
 * was the page size, not because that was the number.
 *
 * Sections are omitted, not zeroed, when the caller lacks the permission for
 * that data. A zero where someone has no visibility is a lie; an absent section
 * is the truth.
 */
import { useCallback, useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Card,
  CardHeader,
  ErrorState,
  Skeleton,
} from '../../components/console/primitives';

interface Stats {
  days: number;
  scope: { id: string; name: string; node_type: string } | null;
  sections: {
    people?: {
      total: number;
      by_node: { name: string; node_type: string; count: number }[];
    };
    events?: {
      events_total: number;
      events_upcoming: number;
      registrations: {
        total: number;
        checked_in: number;
        pending: number;
        confirmed: number;
      };
      registrations_recent: number;
      check_in_rate: number | null;
    };
    content?: {
      total: number;
      published: number;
      in_review: number;
      draft: number;
      approved: number;
      scheduled: number;
      coverage_next_14: { covered: number; gaps: string[] };
    };
  };
}

const Stat = ({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'neutral' | 'caution';
}) => (
  <div
    className={`rounded-console-lg border border-console-border p-4 ${
      tone === 'caution' ? 'bg-console-caution-bg' : 'bg-console-surface'
    }`}
  >
    <p className="text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
      {label}
    </p>
    <p
      className={`mt-1 text-[24px] font-semibold tabular-nums ${
        tone === 'caution' ? 'text-console-caution' : 'text-console-text'
      }`}
    >
      {value}
    </p>
    {hint && (
      <p className="mt-0.5 text-[11px] leading-snug text-console-muted">{hint}</p>
    )}
  </div>
);

export const Analytics = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Stats>('/identity/stats/', {
        params: { days },
      });
      setStats(data);
    } catch {
      setError('Could not load the figures for your scope.');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const people = stats?.sections.people;
  const events = stats?.sections.events;
  const content = stats?.sections.content;
  const gaps = content?.coverage_next_14.gaps.length ?? 0;

  return (
    <ScreenShell
      title="Analytics"
      subtitle={
        stats?.scope
          ? `Everything below is counted across ${stats.scope.name} and everything beneath it.`
          : 'Counted across everything you have authority over.'
      }
      actions={
        <div className="flex items-center gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-console-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                days === d
                  ? 'bg-console-action-light text-console-action'
                  : 'text-console-muted hover:bg-console-tinted'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {people && (
              <Stat
                label="Members"
                value={people.total}
                hint="active memberships in scope"
              />
            )}
            {events && (
              <>
                <Stat
                  label="Upcoming events"
                  value={events.events_upcoming}
                  hint={`${events.events_total} in total`}
                />
                <Stat
                  label="Registrations"
                  value={events.registrations.total}
                  hint={`${events.registrations_recent} in the last ${days} days`}
                />
                <Stat
                  label="Check-in rate"
                  value={
                    events.check_in_rate === null
                      ? '—'
                      : `${events.check_in_rate}%`
                  }
                  hint={
                    events.check_in_rate === null
                      ? 'no registrations yet'
                      : `${events.registrations.checked_in} of ${events.registrations.total}`
                  }
                />
              </>
            )}
            {content && (
              <Stat
                label="Days covered"
                value={`${content.coverage_next_14.covered}/14`}
                tone={gaps > 0 ? 'caution' : 'neutral'}
                hint="next fortnight"
              />
            )}
          </div>

          {events && events.registrations.pending > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-console-md border border-console-border bg-console-caution-bg px-3 py-2 text-[13px] text-console-caution">
              <Info size={15} className="shrink-0" />
              {events.registrations.pending} registration
              {events.registrations.pending === 1 ? '' : 's'} still waiting on a
              decision.
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Where the people are — the question a coordinator actually has. */}
            {people && people.by_node.length > 0 && (
              <Card>
                <CardHeader>
                  <span className="text-[13px] font-semibold text-console-text">
                    Members by node
                  </span>
                  <Badge tone="neutral">top {people.by_node.length}</Badge>
                </CardHeader>
                <ul className="divide-y divide-console-border">
                  {people.by_node.map((n) => {
                    const share = people.total
                      ? Math.round((n.count / people.total) * 100)
                      : 0;
                    return (
                      <li key={n.name} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[13px] text-console-body">
                            {n.name}
                            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-console-subtle">
                              {n.node_type}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-[13px] text-console-text">
                            {n.count}
                          </span>
                        </div>
                        {/* A bar, because a ranked list of numbers is much
                            harder to compare than a ranked list of lengths. */}
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-console-tinted">
                          <div
                            className="h-full rounded-full bg-console-action"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            {content && (
              <Card>
                <CardHeader>
                  <span className="text-[13px] font-semibold text-console-text">
                    Content pipeline
                  </span>
                  <Badge tone="neutral">{content.total} total</Badge>
                </CardHeader>
                <ul className="divide-y divide-console-border">
                  {(
                    [
                      ['Draft', content.draft],
                      ['In review', content.in_review],
                      ['Approved', content.approved],
                      ['Scheduled', content.scheduled],
                      ['Published', content.published],
                    ] as const
                  ).map(([label, count]) => (
                    <li
                      key={label}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <span className="text-[13px] text-console-body">
                        {label}
                      </span>
                      <span className="tabular-nums text-[13px] text-console-text">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
                {gaps > 0 && (
                  <p className="border-t border-console-border px-4 py-2.5 text-[12px] text-console-caution">
                    {gaps} of the next 14 days has no approved devotional.
                  </p>
                )}
              </Card>
            )}
          </div>

          {Object.keys(stats?.sections ?? {}).length === 0 && (
            <p className="mt-4 text-[13px] text-console-muted">
              There is nothing to report — your role does not include visibility
              of people, events or content.
            </p>
          )}
        </>
      )}
    </ScreenShell>
  );
};

export default Analytics;
