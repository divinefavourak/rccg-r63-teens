/**
 * My class — the smallest Console.
 *
 * A Teacher holds four permissions: `users.view`, `profiles.view`,
 * `content.view`, `events.checkin`. That is enough for exactly three things, and
 * this screen is all three on one page: **who is in my class**, **what am I
 * teaching this week**, and **the door**.
 *
 * Deliberately not a stripped-down admin table. There are no admin verbs
 * anywhere — no edit, no deactivate, no role controls — because a Teacher has
 * none of those permissions and rendering greyed versions would only advertise
 * what they cannot do.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ScanLine, Users } from 'lucide-react';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Avatar,
  Badge,
  Btn,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';
import type { ConsoleMembership } from '../../types/console';

interface Manual {
  id: string;
  title: string;
  theme?: string;
  memory_verse?: string;
  week_number?: number | string;
  week_start_date?: string;
}

export const MyClass = () => {
  const { can, scopeNode } = useConsoleAuth();

  const members = useConsoleList<ConsoleMembership>('/identity/memberships/', {
    enabled: can('users.view'),
    errorMessage: 'Could not load your class.',
  });

  const manuals = useConsoleList<Manual>('/content/manuals/', {
    enabled: can('content.view'),
    params: { ordering: '-week_start_date' },
    errorMessage: 'Could not load this week’s lesson.',
  });

  // `manuals/current/` exists but returns a single object; the list's first row
  // ordered by week start is the same answer and reuses the shared hook.
  const thisWeek = manuals.items[0];

  const roster = useMemo(
    () => members.items.filter((m) => m.is_active),
    [members.items],
  );

  return (
    <ScreenShell
      title="My class"
      subtitle="Your teens, this week's lesson, and the door."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* This week's lesson */}
        <Card>
          <CardHeader>
            <span className="flex items-center gap-2 text-[13px] font-semibold text-console-text">
              <BookOpen size={15} className="text-console-subtle" />
              This week's lesson
            </span>
            <Link
              to="/admin/manuals"
              className="text-[12px] font-medium text-console-action hover:underline"
            >
              All manuals
            </Link>
          </CardHeader>
          <div className="p-4">
            {manuals.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : !thisWeek ? (
              <EmptyState message="No manual has been published yet. When one is, it appears here." />
            ) : (
              <>
                <p className="text-[15px] font-semibold text-console-text">
                  {thisWeek.title}
                </p>
                {thisWeek.theme && (
                  <p className="mt-0.5 text-[13px] text-console-muted">
                    {thisWeek.theme}
                  </p>
                )}
                {thisWeek.memory_verse && (
                  <div className="mt-3 rounded-console-md bg-console-tinted p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
                      Memory verse
                    </p>
                    <p className="mt-0.5 text-[13px] text-console-body">
                      {thisWeek.memory_verse}
                    </p>
                  </div>
                )}
                {thisWeek.week_number && (
                  <p className="mt-3 text-[11px] text-console-subtle">
                    Week {thisWeek.week_number}
                  </p>
                )}
              </>
            )}
          </div>
        </Card>

        {/* The door */}
        <Card>
          <CardHeader>
            <span className="flex items-center gap-2 text-[13px] font-semibold text-console-text">
              <ScanLine size={15} className="text-console-subtle" />
              Check in
            </span>
          </CardHeader>
          <div className="p-4">
            <p className="text-[13px] leading-relaxed text-console-muted">
              You can check people in at an event without being able to browse
              the event list — so check-in has its own way in rather than living
              behind a list you cannot open.
            </p>
            <Link to="/admin/check-in">
              <Btn variant="primary" size="md" className="mt-3 w-full">
                <ScanLine size={15} /> Open check-in
              </Btn>
            </Link>
          </div>
        </Card>
      </div>

      {/* The roster */}
      <Card className="mt-4">
        <CardHeader>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-console-text">
            <Users size={15} className="text-console-subtle" />
            My teens
            <Badge tone="neutral">{roster.length}</Badge>
          </span>
          {scopeNode && (
            <span className="text-[11px] text-console-subtle">
              {scopeNode.name}
            </span>
          )}
        </CardHeader>

        {members.isLoading ? (
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : roster.length === 0 ? (
          <EmptyState
            title="Nobody assigned yet"
            message="Teens appear here once they are given a home node at your parish."
          />
        ) : (
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2.5 rounded-console-md border border-console-border p-2.5"
              >
                <Avatar name={m.user_detail?.display_name ?? '?'} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-console-text">
                    {m.user_detail?.display_name ?? m.user_detail?.username}
                  </p>
                  <p className="truncate text-[11px] text-console-subtle">
                    {m.organization_node_detail?.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </ScreenShell>
  );
};

export default MyClass;
