/**
 * Overview — what needs you now.
 *
 * Every card is gated on the permission that makes it *actionable*, not on the
 * permission that makes it visible. Showing a Province Coordinator that four
 * devotionals are unreviewed would be information they can do nothing with; the
 * card is absent for them, and the screen is shorter and more useful as a
 * result.
 *
 * Consequence worth noting: a Teacher's Overview is almost empty by design.
 * Their work lives on My Class, and this screen sends them there rather than
 * inventing filler.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  GraduationCap,
  Users,
} from 'lucide-react';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Card,
  CardHeader,
  Skeleton,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';
import { toISODate } from '../../utils/dates';

interface Devotional {
  id: string;
  title: string;
  date: string;
  status: string;
}
interface Registration {
  id: string;
  status?: string;
}
interface EventRow {
  id: string;
  title: string;
  start_datetime?: string;
}

const COVERED = new Set(['approved', 'scheduled', 'published']);
// Local calendar day — see src/utils/dates.ts for why toISOString() is wrong here.
const iso = toISODate;

/** A tile is a number plus what it means. A number alone is trivia. */
const Tile = ({
  label,
  value,
  tone = 'neutral',
  to,
  hint,
  loading,
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'caution';
  to?: string;
  hint?: string;
  loading?: boolean;
}) => {
  const body = (
    <div
      className={`rounded-console-lg border p-4 transition-colors ${
        tone === 'caution'
          ? 'border-console-border bg-console-caution-bg'
          : 'border-console-border bg-console-surface hover:bg-console-tinted'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-1.5 h-7 w-12" />
      ) : (
        <p
          className={`mt-1 text-[24px] font-semibold tabular-nums ${
            tone === 'caution' ? 'text-console-caution' : 'text-console-text'
          }`}
        >
          {value}
        </p>
      )}
      {hint && (
        <p className="mt-0.5 text-[11px] leading-snug text-console-muted">
          {hint}
        </p>
      )}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
};

export const Overview = () => {
  const { me, can, permissions, assignments, scopeNode } = useConsoleAuth();

  const name =
    me?.profile?.display_name?.split(' ')[0] || me?.first_name || 'there';

  const today = iso(new Date());
  const in14 = iso(new Date(Date.now() + 14 * 86400000));

  const devotionals = useConsoleList<Devotional>('/content/devotionals/', {
    enabled: can('content.view'),
    params: { date_from: today, date_to: in14, ordering: 'date' },
  });

  const inReview = useConsoleList<Devotional>('/content/devotionals/', {
    enabled: can('content.publish'),
    params: { status: 'in_review' },
  });

  const registrations = useConsoleList<Registration>('/events/registrations/', {
    enabled: can('events.view'),
  });

  const events = useConsoleList<EventRow>('/events/events/', {
    enabled: can('events.view'),
    params: { status: 'upcoming', ordering: 'start_datetime' },
  });

  const members = useConsoleList<unknown>('/identity/memberships/', {
    enabled: can('memberships.view'),
  });

  /** Days in the next fortnight with no approved devotional. */
  const gaps = useMemo(() => {
    const covered = new Set(
      devotionals.items
        .filter((d) => COVERED.has(d.status))
        .map((d) => d.date?.slice(0, 10)),
    );
    const out: string[] = [];
    for (let i = 0; i < 14; i += 1) {
      const day = iso(new Date(Date.now() + i * 86400000));
      if (!covered.has(day)) out.push(day);
    }
    return out;
  }, [devotionals.items]);

  const pending = useMemo(
    () => registrations.items.filter((r) => r.status === 'pending').length,
    [registrations.items],
  );

  // A Teacher's Console is My Class. Point there rather than pad this screen.
  const teacherOnly = can('events.checkin') && !can('events.view');

  return (
    <ScreenShell
      title={`Good to see you, ${name}`}
      subtitle={
        assignments[0]?.role_detail?.label
          ? `${assignments[0].role_detail.label}${scopeNode ? ` · looking at ${scopeNode.name}` : ''}`
          : undefined
      }
    >
      {teacherOnly && (
        <Link to="/admin/my-class">
          <Card className="mb-4 p-4 transition-colors hover:bg-console-tinted">
            <div className="flex items-center gap-3">
              <GraduationCap size={20} className="shrink-0 text-console-action" />
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-console-text">
                  Go to My class
                </p>
                <p className="text-[12px] text-console-muted">
                  Your teens, this week's lesson, and check-in.
                </p>
              </div>
              <ArrowRight size={16} className="text-console-subtle" />
            </div>
          </Card>
        </Link>
      )}

      {/* Needs you now — only what this holder can actually act on. */}
      {(can('content.publish') || can('events.manage')) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {can('content.publish') && gaps.length > 0 && (
            <Link to="/admin/content">
              <div className="flex items-start gap-3 rounded-console-lg border border-console-border bg-console-caution-bg p-4">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 shrink-0 text-console-caution"
                />
                <div>
                  <p className="text-[13px] font-semibold text-console-caution">
                    {gaps.length} of the next 14 days has no approved devotional
                  </p>
                  <p className="mt-0.5 text-[12px] text-console-muted">
                    A day without one is a day the app has nothing to say.
                  </p>
                </div>
              </div>
            </Link>
          )}

          {can('content.publish') && inReview.items.length > 0 && (
            <Link to="/admin/review">
              <div className="flex items-start gap-3 rounded-console-lg border border-console-border bg-console-surface p-4 transition-colors hover:bg-console-tinted">
                <CheckSquare
                  size={17}
                  className="mt-0.5 shrink-0 text-console-info"
                />
                <div>
                  <p className="text-[13px] font-semibold text-console-text">
                    {inReview.items.length} waiting on review
                  </p>
                  <p className="mt-0.5 text-[12px] text-console-muted">
                    Someone other than the author has to approve each one.
                  </p>
                </div>
              </div>
            </Link>
          )}

          {can('events.manage') && pending > 0 && (
            <Link to="/admin/events">
              <div className="flex items-start gap-3 rounded-console-lg border border-console-border bg-console-caution-bg p-4">
                <Users
                  size={17}
                  className="mt-0.5 shrink-0 text-console-caution"
                />
                <div>
                  <p className="text-[13px] font-semibold text-console-caution">
                    {pending} registration{pending === 1 ? '' : 's'} waiting
                  </p>
                  <p className="mt-0.5 text-[12px] text-console-muted">
                    Each one is a family waiting to hear back.
                  </p>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {can('memberships.view') && (
          <Tile
            label="Members"
            value={members.items.length}
            to="/admin/people"
            loading={members.isLoading}
            hint={scopeNode ? `in ${scopeNode.name}` : undefined}
          />
        )}
        {can('events.view') && (
          <Tile
            label="Upcoming events"
            value={events.items.length}
            to="/admin/events"
            loading={events.isLoading}
          />
        )}
        {can('content.view') && (
          <Tile
            label="Days covered"
            value={`${14 - gaps.length}/14`}
            tone={gaps.length > 0 ? 'caution' : 'neutral'}
            to="/admin/content"
            loading={devotionals.isLoading}
            hint="next fortnight"
          />
        )}
        <Tile
          label="Your permissions"
          value={me?.is_superuser ? 21 : permissions.size}
          to="/admin/settings"
          hint="of 21"
        />
      </div>

      {/* Next events */}
      {can('events.view') && events.items.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <span className="flex items-center gap-2 text-[13px] font-semibold text-console-text">
              <CalendarDays size={15} className="text-console-subtle" />
              Coming up
            </span>
            <Link
              to="/admin/events"
              className="text-[12px] font-medium text-console-action hover:underline"
            >
              All events
            </Link>
          </CardHeader>
          <ul className="divide-y divide-console-border">
            {events.items.slice(0, 5).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="truncate text-[13px] text-console-text">
                  {e.title}
                </span>
                <Badge tone="neutral">
                  {e.start_datetime
                    ? new Date(e.start_datetime).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </ScreenShell>
  );
};

export default Overview;
