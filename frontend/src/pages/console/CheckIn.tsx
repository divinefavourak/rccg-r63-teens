/**
 * Check in — the person in front of you, and whether to let them in.
 *
 * Built on the door endpoints (`/events/checkin/…`), which need
 * `events.checkin` and nothing else. That matters: a Teacher holds check-in
 * without `events.view` or `events.manage`, and the general registrations list
 * answers them with only their own tickets. Those endpoints are scoped to one
 * event and to today, which is all a door needs.
 *
 * Every scan answers with an outcome, not an error. "Already checked in" and
 * "not paid" are things to tell the teen, so each gets its own sentence.
 *
 * There is no camera here. Scanning a QR code is the phone app's job; on the
 * web this is the fallback for a dead phone: type the ticket number or a name.
 */
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  AlertBanner,
  Avatar,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  PaymentPill,
  RegistrationPill,
  SearchField,
  Skeleton,
  TableSkeleton,
  Tabs,
} from '../../components/console/primitives';
import { useDebounced } from '../../hooks/useDebounced';
import { parseAPIDate } from '../../utils/dates';

/** `checkin_views._event_payload`. */
interface DoorEvent {
  id: string;
  title: string;
  start_datetime: string;
  venue?: string;
  city?: string;
  registered: number;
  checked_in: number;
}

/** `checkin.attendee`. */
interface Attendee {
  registration_id: string;
  name: string;
  parish?: string;
  photo?: string | null;
  status: string;
  payment_status: string;
}

type Outcome =
  | 'checked_in'
  | 'already_checked_in'
  | 'not_found'
  | 'wrong_event'
  | 'not_paid'
  | 'cancelled'
  | 'waitlisted';

interface ScanResult {
  outcome: Outcome;
  attendee: Attendee | null;
  counts: { registered: number; checked_in: number };
}

type Notice = { kind: 'success' | 'caution' | 'error'; text: string };

const OUTCOMES: Record<Outcome, { kind: Notice['kind']; say: (name: string) => string }> = {
  checked_in: { kind: 'success', say: (n) => `${n} is checked in. Let them in.` },
  already_checked_in: {
    kind: 'caution',
    say: (n) => `${n} was already checked in. Check it is the same person.`,
  },
  not_paid: {
    kind: 'caution',
    say: (n) =>
      `${n} has not paid. An event manager has to mark the payment before they can come in.`,
  },
  waitlisted: {
    kind: 'caution',
    say: (n) => `${n} is on the waitlist and does not have a place yet.`,
  },
  cancelled: { kind: 'error', say: (n) => `${n}'s registration was cancelled.` },
  wrong_event: { kind: 'error', say: () => 'That ticket is for a different event.' },
  not_found: {
    kind: 'error',
    say: () => 'No ticket matches that. Check the number and try again.',
  },
};

const timeOf = (value: string) =>
  parseAPIDate(value)?.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) ?? '';

export const CheckIn = () => {
  const [eventId, setEventId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Notice | null>(null);
  const [counts, setCounts] = useState<Record<string, ScanResult['counts']>>({});
  const term = useDebounced(query.trim());

  const today = useQuery({
    queryKey: ['checkin-today'],
    queryFn: async () => {
      const { data } = await api.get<{ events: DoorEvent[] }>('/events/checkin/today/');
      return data.events;
    },
  });

  const events = today.data ?? [];
  const event = events.find((e) => e.id === eventId) ?? events[0];

  // The door searches from two characters; fewer would list half the event.
  const canSearch = !!event && term.length >= 2;
  const matches = useQuery({
    queryKey: ['checkin-search', event?.id, term],
    enabled: canSearch,
    queryFn: async () => {
      const { data } = await api.get<{ results: Attendee[] }>('/events/checkin/search/', {
        params: { event: event!.id, q: term },
      });
      return data.results;
    },
  });

  const checkIn = useCallback(
    async (code: string) => {
      if (!event) return;
      setBusy(code);
      try {
        const { data } = await api.post<ScanResult>('/events/checkin/scan/', {
          event: event.id,
          code,
          method: 'manual',
        });
        const outcome = OUTCOMES[data.outcome] ?? OUTCOMES.not_found;
        setResult({
          kind: outcome.kind,
          text: outcome.say(data.attendee?.name ?? 'This person'),
        });
        setCounts((prev) => ({ ...prev, [event.id]: data.counts }));
        matches.refetch();
      } catch {
        setResult({
          kind: 'error',
          text: "We couldn't reach the server, so nobody was checked in. Try again.",
        });
      } finally {
        setBusy(null);
      }
    },
    [event, matches],
  );

  const tally = event ? (counts[event.id] ?? event) : null;

  return (
    <ScreenShell
      title="Check in"
      subtitle={
        event
          ? `${event.title} · ${timeOf(event.start_datetime)}${event.venue ? ` · ${event.venue}` : ''}`
          : 'Find the person in front of you and let them in.'
      }
      hideScope
    >
      {today.isPending ? (
        <Card>
          <TableSkeleton rows={3} />
        </Card>
      ) : today.isError ? (
        <Card>
          <ErrorState
            message="We couldn't load today's events. Try again."
            onRetry={() => today.refetch()}
          />
        </Card>
      ) : !event || !tally ? (
        <Card>
          <EmptyState
            title="No event today"
            message="Check-in opens on the day of an event you can work the door for."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {events.length > 1 && (
            <div className="[&>div]:mb-0">
              <Tabs
                tabs={events.map((e) => ({ id: e.id, label: e.title }))}
                active={event.id}
                onChange={(id) => {
                  setEventId(id);
                  setQuery('');
                  setResult(null);
                }}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <div className="flex flex-col gap-1 self-start rounded-console-xl bg-pop-lime p-5 text-pop-on">
              <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.08em]">
                Checked in
              </p>
              <p
                className="text-[32px] font-extrabold leading-10 tracking-[-0.02em] tabular-nums"
                aria-live="polite"
              >
                {tally.checked_in.toLocaleString()}
              </p>
              <p className="text-[14px] leading-5">
                of {tally.registered.toLocaleString()} with a place
              </p>
            </div>

            <Card className="flex flex-col gap-4 p-5">
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  // Enter on a typed ticket number goes straight to the door,
                  // without waiting for the list.
                  if (query.trim()) checkIn(query.trim());
                }}
              >
                <div className="min-w-0 flex-1 [&>label]:w-full sm:[&>label]:w-full">
                  <SearchField
                    value={query}
                    onChange={(value) => {
                      setQuery(value);
                      // A result belongs to the search that produced it.
                      setResult(null);
                    }}
                    label={`Find a ticket for ${event.title}`}
                    placeholder="Ticket number or name"
                  />
                </div>
                <Btn
                  type="submit"
                  variant="go"
                  size="md"
                  disabled={!query.trim() || busy !== null}
                >
                  <ScanLine size={16} /> Check in
                </Btn>
              </form>

              <div aria-live="assertive">
                {result && <AlertBanner kind={result.kind}>{result.text}</AlertBanner>}
              </div>

              {!canSearch ? (
                <p className="text-[14px] leading-5 text-console-body">
                  Type a ticket number and press Enter, or at least two letters of a
                  name to see who matches.
                </p>
              ) : matches.isPending ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : matches.isError ? (
                <AlertBanner
                  kind="error"
                  action={
                    <Btn variant="soft" size="md" onClick={() => matches.refetch()}>
                      Try again
                    </Btn>
                  }
                >
                  We couldn't search the tickets.
                </AlertBanner>
              ) : matches.data.length === 0 ? (
                <p className="text-[14px] leading-5 text-console-body">
                  Nobody registered for {event.title} matches “{term}”. Check the
                  spelling, or ask for their ticket number.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {matches.data.map((a) => {
                    const arrived = a.status === 'checked_in' || a.status === 'attended';
                    return (
                      <li
                        key={a.registration_id}
                        className="flex min-h-16 flex-wrap items-center gap-3 border-t border-console-border py-2 first:border-t-0"
                      >
                        {a.photo ? (
                          <img
                            src={a.photo}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <Avatar name={a.name} size={40} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold leading-5 text-console-text">
                            {a.name}
                          </p>
                          <p className="truncate text-[12px] font-medium leading-4 text-console-muted">
                            {a.registration_id}
                            {a.parish ? ` · ${a.parish}` : ''}
                          </p>
                        </div>
                        <RegistrationPill status={a.status} />
                        {a.payment_status !== 'not_required' && a.payment_status !== 'paid' && (
                          <PaymentPill status={a.payment_status} />
                        )}
                        {!arrived && (
                          <Btn
                            variant="go"
                            size="md"
                            disabled={busy !== null}
                            onClick={() => checkIn(a.registration_id)}
                          >
                            {busy === a.registration_id ? 'Checking in…' : 'Check in'}
                          </Btn>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </ScreenShell>
  );
};

export default CheckIn;
