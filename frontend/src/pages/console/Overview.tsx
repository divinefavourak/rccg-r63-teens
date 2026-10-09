/**
 * Overview — what needs you now.
 *
 * Every card is gated on the permission that makes it *actionable*, not on the
 * permission that makes it visible. Showing a Province Coordinator that four
 * devotionals are unreviewed would be information they can do nothing with; the
 * card is absent for them, and the screen is shorter and more useful as a
 * result.
 *
 * Every total comes from `GET /identity/stats/`, which counts in the database
 * across the caller's whole scope. The lists are fetched only for what a count
 * cannot give: the titles in this week's pipeline and the date of the next
 * event.
 *
 * Consequence worth noting: a Teacher's Overview is almost empty by design.
 * Their work lives on My Class, and this screen sends them there rather than
 * inventing filler.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';
import ScreenShell from '../../components/console/ScreenShell';
import {
  AlertBanner,
  Btn,
  Card,
  MetricTile,
  PublishPill,
  Skeleton,
} from '../../components/console/primitives';
import { OBJECTS } from '../../assets/site';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';
import { useConsoleStats } from '../../hooks/useConsoleStats';
import { useAccountLabel } from '../../components/console/account';
import { parseAPIDate, toISODate } from '../../utils/dates';

interface Devotional {
  id: string;
  title: string;
  date: string;
  status: string;
}
interface EventRow {
  id: string;
  title: string;
  start_datetime?: string;
}

const DAY_MS = 86400000;
const NO_GAPS: string[] = [];

const shortDay = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Monday of the week `d` falls in, at local midnight. */
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

const greeting = (hour: number) =>
  hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

const COUNT_WORDS = ['Nothing needs', 'One thing needs', 'Two things need', 'Three things need'];

/**
 * A thing that needs the holder, in the colour of its kind, with the one
 * action that deals with it. The 3D object is decoration and hidden from
 * assistive tech.
 */
const AttentionCard = ({
  tone,
  label,
  headline,
  children,
  action,
  to,
  object,
}: {
  tone: string;
  label: string;
  headline: string;
  children: ReactNode;
  action: string;
  to: string;
  object: string;
}) => (
  <div
    className={`relative flex min-h-[248px] flex-col items-start gap-2 rounded-console-xl p-5 text-pop-on ${tone}`}
  >
    <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.08em]">
      {label}
    </p>
    <p className="pr-12 text-[32px] font-extrabold leading-10 tracking-[-0.02em]">
      {headline}
    </p>
    <div className="text-[14px] leading-5">{children}</div>
    <div className="flex-1" />
    <Link
      to={to}
      className="inline-flex h-10 shrink-0 items-center rounded-full bg-ink px-4 text-[14px] font-semibold leading-5 text-on-ink transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {action}
    </Link>
    <img
      src={object}
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute -top-[18px] right-3 h-16 w-16"
    />
  </div>
);

export const Overview = () => {
  const { can, scopeNode, assignments } = useConsoleAuth();
  const { firstName } = useAccountLabel();
  const { stats, isLoading: statsLoading, error: statsError, reload } =
    useConsoleStats();

  // Fixed for the life of the screen: a render must not read the clock, and a
  // dashboard left open past midnight is refreshed by its queries, not by this.
  const [now] = useState(() => new Date());
  const weekStart = useMemo(() => mondayOf(now), [now]);

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)),
    [weekStart],
  );

  // Seven rows at most, so one page always holds the week.
  const pipeline = useConsoleList<Devotional>('/content/devotionals/', {
    enabled: can('content.view'),
    params: {
      date_from: toISODate(week[0]!),
      date_to: toISODate(week[6]!),
      ordering: 'date',
    },
  });

  // `upcoming=true` is the backend's date filter. There is no "upcoming"
  // status; asking for one is a 400.
  const nextEvent = useConsoleList<EventRow>('/events/events/', {
    enabled: can('events.view'),
    params: { upcoming: 'true', ordering: 'start_datetime', page_size: 1 },
  });

  const people = stats?.sections.people;
  const events = stats?.sections.events;
  const content = stats?.sections.content;

  // The figures cover the caller's authority, which is where their highest
  // role is held. That is not always the node the scope switcher shows.
  const coverage = assignments[0]?.node_detail?.name ?? scopeNode?.name;

  const gaps = content?.coverage_next_14.gaps ?? NO_GAPS;
  const inReview = content?.in_review ?? 0;
  const pending = events?.registrations.pending ?? 0;

  const showGap = can('content.publish') && gaps.length > 0;
  const showReview = can('content.publish') && inReview > 0;
  const showPending = can('events.manage') && pending > 0;
  const needing = [showGap, showReview, showPending].filter(Boolean).length;

  const byDate = useMemo(
    () => new Map(pipeline.items.map((d) => [d.date?.slice(0, 10), d])),
    [pipeline.items],
  );

  const gapSet = useMemo(() => new Set(gaps), [gaps]);
  const fortnight = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) =>
        toISODate(new Date(now.getTime() + i * DAY_MS)),
      ),
    [now],
  );
  const firstGap = parseAPIDate(gaps[0]);
  const upcoming = parseAPIDate(nextEvent.items[0]?.start_datetime);

  // A Teacher's Console is My Class. Point there rather than pad this screen.
  const teacherOnly = can('events.checkin') && !can('events.view');

  return (
    <ScreenShell
      crumb="Overview"
      title={`${greeting(now.getHours())}${firstName ? `, ${firstName}` : ''}`}
      subtitle={
        statsLoading || teacherOnly
          ? undefined
          : `${COUNT_WORDS[needing]} you${coverage ? ` in ${coverage}` : ''} today.`
      }
      hideScope
      actions={
        <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-console-tinted pl-3 pr-4 text-[14px] font-semibold leading-5 text-console-text">
          <CalendarDays size={16} /> {shortDay(now)} {now.getFullYear()}
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        {statsError && (
          <AlertBanner
            kind="error"
            action={
              <Btn variant="soft" size="md" onClick={() => reload()}>
                Try again
              </Btn>
            }
          >
            {statsError}
          </AlertBanner>
        )}

        {teacherOnly && (
          <Link to="/admin/my-class" className="block">
            <Card className="p-5 transition-colors hover:bg-console-tinted">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pop-lime text-pop-on">
                  <GraduationCap size={22} />
                </span>
                <div className="flex-1">
                  <p className="text-[17px] font-bold leading-6 text-console-text">
                    Go to My class
                  </p>
                  <p className="text-[14px] leading-5 text-console-body">
                    Your teens, this week's lesson, and check-in.
                  </p>
                </div>
                <ArrowRight size={20} className="text-console-text" />
              </div>
            </Card>
          </Link>
        )}

        {/* Needs you now — only what this holder can actually act on. */}
        {needing > 0 && (
          <div className="grid gap-4 pt-[18px] sm:grid-cols-2 xl:grid-cols-4">
            {showGap && (
              <AttentionCard
                tone="bg-pop-amber"
                label="Devotional gap"
                headline={firstGap ? shortDay(firstGap) : `${gaps.length} days`}
                action="Schedule one"
                to="/admin/content"
                object={OBJECTS.calendar}
              >
                <p>
                  No devotional is approved. {gaps.length}{' '}
                  {gaps.length === 1 ? 'gap' : 'gaps'} in the next 14 days.
                </p>
                <div
                  className="mt-2 flex gap-1"
                  role="img"
                  aria-label={`${14 - gaps.length} of the next 14 days are covered`}
                >
                  {fortnight.map((day) => (
                    <span
                      key={day}
                      className={`h-[22px] w-3 rounded-full ${
                        gapSet.has(day) ? 'border-[1.5px] border-ink' : 'bg-ink'
                      }`}
                    />
                  ))}
                </div>
              </AttentionCard>
            )}

            {showReview && (
              <AttentionCard
                tone="bg-pop-violet"
                label="Review queue"
                headline={`${inReview} ${inReview === 1 ? 'item' : 'items'}`}
                action="Open queue"
                to="/admin/review"
                object={OBJECTS.notebook}
              >
                <p>
                  Waiting for approval. Someone other than the author has to
                  approve each one.
                </p>
              </AttentionCard>
            )}

            {showPending && (
              <AttentionCard
                tone="bg-pop-sky"
                label="Registrations"
                headline={`${pending} pending`}
                action="Review"
                to="/admin/events"
                object={OBJECTS.bell}
              >
                <p>Event registrations awaiting confirmation.</p>
              </AttentionCard>
            )}
          </div>
        )}

        {(can('memberships.view') || can('events.view') || can('content.view')) && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {can('memberships.view') && (
              <MetricTile
                label="Members"
                loading={statsLoading}
                value={people?.total.toLocaleString()}
                change="with an active membership"
                scope={coverage}
              />
            )}
            {can('events.view') && (
              <MetricTile
                label="Events upcoming"
                loading={statsLoading}
                value={events?.events_upcoming.toLocaleString()}
                change={upcoming ? `Next: ${shortDay(upcoming)}` : 'None scheduled'}
                scope={coverage}
              />
            )}
            {can('events.view') && (
              <MetricTile
                label={`Registrations · ${stats?.days ?? 30} days`}
                loading={statsLoading}
                value={events?.registrations_recent.toLocaleString()}
                change={
                  events?.check_in_rate == null
                    ? 'No check-ins to take a rate of'
                    : `${events.check_in_rate}% of all registrations checked in`
                }
                scope={coverage}
              />
            )}
            {can('content.view') && (
              <MetricTile
                label="Devotionals published"
                loading={statsLoading}
                value={content?.published.toLocaleString()}
                change={
                  content
                    ? `${content.scheduled + content.approved} approved or scheduled`
                    : undefined
                }
                scope="All of Faith Tribe"
              />
            )}
          </div>
        )}

        {can('content.view') && (
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
              This week's pipeline
            </h2>
            {pipeline.error ? (
              <AlertBanner
                kind="error"
                action={
                  <Btn variant="soft" size="md" onClick={() => pipeline.reload()}>
                    Try again
                  </Btn>
                }
              >
                We couldn't load this week's devotionals.
              </AlertBanner>
            ) : (
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {week.map((day) => {
                  const item = byDate.get(toISODate(day));
                  const isToday = toISODate(day) === toISODate(now);
                  return (
                    <li
                      key={day.getTime()}
                      className={`flex min-w-0 flex-col items-start gap-1.5 rounded-console-md bg-console-tinted p-2.5 ${
                        isToday ? 'outline outline-2 -outline-offset-2 outline-console-text' : ''
                      }`}
                    >
                      <p className="text-[12px] font-medium uppercase leading-4 text-console-muted">
                        {day.toLocaleDateString('en-GB', { weekday: 'short' })}{' '}
                        {day.getDate()}
                        {isToday && <span className="sr-only"> (today)</span>}
                      </p>
                      {pipeline.isLoading ? (
                        <>
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-[26px] w-[88px]" />
                        </>
                      ) : item ? (
                        <>
                          <p className="w-full truncate text-[14px] font-semibold leading-5 text-console-text">
                            {item.title}
                          </p>
                          <PublishPill status={item.status} />
                        </>
                      ) : (
                        <>
                          <p className="text-[14px] font-semibold leading-5 text-console-muted">
                            Nothing yet
                          </p>
                          {/* The list only includes unpublished work for
                              people who manage content, so for everyone else
                              an empty day means "not published", no more. */}
                          <span className="inline-flex h-[26px] items-center rounded-full border-[1.5px] border-dashed border-console-border-strong px-2.5 text-[12px] font-semibold leading-4 text-console-muted">
                            {can('content.manage') ? 'No devotional' : 'Not published'}
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        )}
      </div>
    </ScreenShell>
  );
};

export default Overview;
