/**
 * My class — the smallest Console.
 *
 * A Teacher holds four permissions: `users.view`, `profiles.view`,
 * `content.view`, `events.checkin`. That is enough for exactly three things, and
 * this screen is all three on one page: **who is in my class**, **what am I
 * teaching this week**, and **the door**.
 *
 * Each part reads the endpoint built for it, and each of those needs only a
 * permission a Teacher has:
 *
 * * the roster is `GET /identity/class/` (`profiles.view`). The memberships
 *   list needs `memberships.view`, which a Teacher does not hold;
 * * the lesson is `GET /content/manuals/current/`, the manual whose week
 *   contains today, in its teacher edition for anyone with `content.view`;
 * * the door is `GET /events/checkin/today/` (`events.checkin`).
 *
 * Deliberately not a stripped-down admin table. There are no admin verbs
 * anywhere, and the roster is alphabetical: a class list sorted by reading
 * would be a leaderboard by another name.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Lock, Phone, ScanLine } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
  TableSkeleton,
} from '../../components/console/primitives';
import { OBJECTS } from '../../assets/site';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { parseAPIDate } from '../../utils/dates';

/** `class_views._member`. */
interface ClassMember {
  id: string;
  name: string;
  age: number | null;
  photo: string | null;
  parish: string;
  /** Monday to Sunday: did they read that day. */
  week: boolean[];
  days_this_week: number;
}

interface Roster {
  total: number;
  members: ClassMember[];
}

/** `ClassMemberView`: the member, plus one guardian to call. */
interface MemberDetail extends ClassMember {
  guardian_name: string;
  guardian_phone: string;
  guardian_relationship: string;
}

/** `ManualTeacherDetailSerializer`, the parts shown here. */
interface Lesson {
  id: string;
  title: string;
  week_number?: number | null;
  memory_verse?: string;
  has_teacher_edition?: boolean;
  teacher_notes?: string;
}

interface DoorEvent {
  id: string;
  title: string;
  start_datetime: string;
  registered: number;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const INK_PILL =
  'inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold leading-5 text-on-ink transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

const LABEL = 'text-[12px] font-medium uppercase leading-4 tracking-[0.08em]';

const Person = ({ member, size }: { member: ClassMember; size: number }) =>
  member.photo ? (
    <img
      src={member.photo}
      alt=""
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <Avatar name={member.name} size={size} />
  );

const GuardianDialog = ({ member, onClose }: { member: ClassMember; onClose: () => void }) => {
  const detail = useQuery({
    queryKey: ['class-member', member.id],
    queryFn: async () => {
      const { data } = await api.get<MemberDetail>(`/identity/class/${member.id}/`);
      return data;
    },
  });
  const d = detail.data;
  return (
    <Modal
      title={member.name}
      subtitle={`${member.age ? `${member.age} years old · ` : ''}${member.parish}`}
      onClose={onClose}
      width={440}
    >
      {detail.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : detail.isError ? (
        <ErrorState
          message={`We couldn't load ${member.name}'s guardian. Try again.`}
          onRetry={() => detail.refetch()}
        />
      ) : d && d.guardian_name ? (
        <div className="rounded-console-md bg-console-tinted px-3.5 py-3">
          <p className={`${LABEL} text-console-muted`}>Guardian</p>
          <p className="mt-1 text-[14px] font-semibold leading-5 text-console-text">
            {d.guardian_name}
            {d.guardian_relationship ? ` (${d.guardian_relationship})` : ''}
          </p>
          {d.guardian_phone && (
            <a
              href={`tel:${d.guardian_phone}`}
              className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full bg-console-action px-4 text-[14px] font-semibold text-console-on-action"
            >
              <Phone size={16} /> {d.guardian_phone}
            </a>
          )}
        </div>
      ) : (
        <p className="text-[14px] leading-5 text-console-body">
          No guardian is on {member.name}'s profile yet.
        </p>
      )}
    </Modal>
  );
};

export const MyClass = () => {
  const { can, scopeNode } = useConsoleAuth();
  const [calling, setCalling] = useState<ClassMember | null>(null);

  const roster = useQuery({
    queryKey: ['class-roster'],
    enabled: can('profiles.view'),
    queryFn: async () => (await api.get<Roster>('/identity/class/')).data,
  });

  // 404 is an answer here: no manual covers this week.
  const lesson = useQuery({
    queryKey: ['manual-current'],
    enabled: can('content.view'),
    retry: false,
    queryFn: async () => {
      try {
        return (await api.get<Lesson>('/content/manuals/current/')).data;
      } catch (err: unknown) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) return null;
        throw err;
      }
    },
  });

  const door = useQuery({
    queryKey: ['checkin-today'],
    enabled: can('events.checkin'),
    queryFn: async () =>
      (await api.get<{ events: DoorEvent[] }>('/events/checkin/today/')).data.events,
  });

  const members = roster.data?.members ?? [];
  const total = roster.data?.total ?? 0;
  const event = door.data?.[0];
  const opens = parseAPIDate(event?.start_datetime)?.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <ScreenShell
      title="My class"
      subtitle={
        roster.data
          ? `${total.toLocaleString()} ${total === 1 ? 'teen' : 'teens'}${scopeNode ? ` at ${scopeNode.name}` : ''}`
          : "Your teens, this week's lesson, and the door."
      }
      hideScope
    >
      {calling && <GuardianDialog member={calling} onClose={() => setCalling(null)} />}

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        {can('profiles.view') && (
          <Card className="w-full min-w-0 flex-1">
            <div className="px-5 pb-2 pt-5">
              <h2 className="text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
                My teens
              </h2>
              <p className="text-[14px] leading-5 text-console-body">
                This week's readings, Monday to Sunday
              </p>
            </div>

            {roster.isPending ? (
              <TableSkeleton rows={5} />
            ) : roster.isError ? (
              <ErrorState
                message="We couldn't load your class. Try again."
                onRetry={() => roster.refetch()}
              />
            ) : members.length === 0 ? (
              <EmptyState
                title="No teens in your class yet"
                message="Teens appear here once they choose your parish as their home in the app."
              />
            ) : (
              <ul className="px-5 pb-2">
                {members.map((m) => (
                  <li key={m.id} className="border-t border-console-border">
                    <button
                      type="button"
                      onClick={() => setCalling(m)}
                      aria-label={`${m.name}, read ${m.days_this_week} of 7 days this week. Open guardian contact.`}
                      className="flex min-h-[58px] w-full flex-wrap items-center gap-3 rounded-console-sm py-2 text-left transition-colors hover:bg-console-tinted focus-visible:outline focus-visible:outline-2 focus-visible:outline-console-text"
                    >
                      <Person member={m} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold leading-5 text-console-text">
                          {m.name}
                        </span>
                        <span className="block text-[12px] font-medium leading-4 text-console-muted">
                          {m.age ? `${m.age} years old` : m.parish}
                        </span>
                      </span>
                      <span className="flex items-center gap-1" aria-hidden="true">
                        {WEEKDAYS.map((day, i) => (
                          <span
                            key={day}
                            title={`${day}: ${m.week[i] ? 'read' : 'no reading'}`}
                            className={`h-3.5 w-3.5 rounded-full ${
                              m.week[i]
                                ? 'bg-console-go'
                                : 'border-[1.5px] border-console-border-strong bg-console-tinted'
                            }`}
                          />
                        ))}
                      </span>
                      <span className="w-12 text-right text-[12px] font-medium leading-4 tabular-nums text-console-muted">
                        {m.days_this_week} of 7
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {total > members.length && (
              <p className="border-t border-console-border px-5 py-3 text-[14px] leading-5 text-console-muted">
                Showing the first {members.length.toLocaleString()} of {total.toLocaleString()}.
              </p>
            )}
          </Card>
        )}

        <div className="flex w-full shrink-0 flex-col gap-4 pt-[18px] xl:w-[380px]">
          {can('content.view') && (
            <div className="relative flex flex-col items-start gap-2 rounded-console-xl bg-pop-violet p-5 text-pop-on">
              <img
                src={OBJECTS.notebook}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -top-[18px] right-4 h-16 w-16"
              />
              {lesson.isPending ? (
                <>
                  <Skeleton className="h-3 w-40 opacity-40" />
                  <Skeleton className="h-9 w-48 opacity-40" />
                </>
              ) : lesson.isError ? (
                <>
                  <p className={LABEL}>This week's lesson</p>
                  <p className="text-[14px] leading-5">We couldn't load this week's lesson.</p>
                  <button type="button" className={INK_PILL} onClick={() => lesson.refetch()}>
                    Try again
                  </button>
                </>
              ) : !lesson.data ? (
                <>
                  <p className={LABEL}>This week's lesson</p>
                  <p className="pr-14 text-[20px] font-bold leading-7 tracking-[-0.01em]">
                    No lesson for this week yet
                  </p>
                  <p className="text-[14px] leading-5">
                    It appears here when the manual for this week is published.
                  </p>
                  <Link to="/admin/manuals" className={INK_PILL}>
                    <BookOpen size={16} /> All manuals
                  </Link>
                </>
              ) : (
                <>
                  <p className={LABEL}>
                    This week's lesson
                    {lesson.data.week_number ? ` · Week ${lesson.data.week_number}` : ''}
                  </p>
                  <p className="pr-14 text-[32px] font-extrabold leading-10 tracking-[-0.02em]">
                    {lesson.data.title}
                  </p>
                  {lesson.data.memory_verse && (
                    <p className="text-[14px] font-semibold leading-5">
                      Memory verse: {lesson.data.memory_verse}
                    </p>
                  )}
                  {lesson.data.has_teacher_edition && lesson.data.teacher_notes && (
                    <div className="w-full rounded-console-md bg-console-surface px-3.5 py-3 text-console-text">
                      <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase leading-4 tracking-[0.06em]">
                        <Lock size={14} /> Teachers only · never shown to teens
                      </p>
                      <p className="mt-1 line-clamp-3 text-[14px] leading-5 text-console-body">
                        {lesson.data.teacher_notes}
                      </p>
                    </div>
                  )}
                  <Link to="/admin/manuals" className={`${INK_PILL} mt-1`}>
                    <BookOpen size={16} /> Open full lesson
                  </Link>
                </>
              )}
            </div>
          )}

          {can('events.checkin') && (
            <div className="relative mt-[18px] flex flex-col items-start gap-2 rounded-console-xl bg-pop-lime p-5 text-pop-on">
              <img
                src={OBJECTS.target}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -top-[18px] right-4 h-16 w-16"
              />
              <p className={LABEL}>Today's event</p>
              {door.isPending ? (
                <Skeleton className="h-7 w-48 opacity-40" />
              ) : door.isError ? (
                <>
                  <p className="text-[14px] leading-5">We couldn't check for an event today.</p>
                  <button type="button" className={INK_PILL} onClick={() => door.refetch()}>
                    Try again
                  </button>
                </>
              ) : !event ? (
                <>
                  <p className="pr-14 text-[20px] font-bold leading-7 tracking-[-0.01em]">
                    No event today
                  </p>
                  <p className="text-[14px] leading-5">
                    Check-in opens on the day of an event.
                  </p>
                </>
              ) : (
                <>
                  <p className="pr-14 text-[20px] font-bold leading-7 tracking-[-0.01em]">
                    {event.title}
                  </p>
                  <p className="text-[14px] leading-5">
                    {opens ? `Doors open ${opens} · ` : ''}
                    {event.registered.toLocaleString()} registered
                  </p>
                  <Link to="/admin/check-in" className={`${INK_PILL} mt-1`}>
                    <ScanLine size={16} /> Start check-in
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!can('profiles.view') && !can('content.view') && !can('events.checkin') && (
        <Card>
          <EmptyState
            art="sitting"
            title="This isn't part of your role"
            message="My class is for the people who teach one. Whoever appointed you can add it."
          />
        </Card>
      )}
    </ScreenShell>
  );
};

export default MyClass;
