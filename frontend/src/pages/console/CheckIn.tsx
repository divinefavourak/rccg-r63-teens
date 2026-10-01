/**
 * Check in — run the door.
 *
 * Reachable directly because `events.checkin` does not imply `events.view`: a
 * Teacher holds the former and not the latter, so check-in cannot be reached by
 * drilling into an event list they cannot open. This screen is that entry point,
 * and it is also what the floating action in `ConsoleLayout` opens.
 *
 * Search-first rather than list-first. At the door you are looking for one named
 * person who is standing in front of you, not browsing a roster.
 */
import { useCallback, useMemo, useState } from 'react';
import { Check, ScanLine, Search } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Avatar,
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';

interface Registration {
  id: string;
  registration_id?: string;
  attendee_name?: string;
  attendee_email?: string;
  attendee_phone?: string;
  status?: string;
  payment_status?: string;
  event_title?: string;
}

export const CheckIn = () => {
  const { can } = useConsoleAuth();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registrations = useConsoleList<Registration>('/events/registrations/', {
    enabled: can('events.checkin'),
    errorMessage: 'Could not load the attendee list.',
  });

  const checkIn = useCallback(
    async (id: string) => {
      setBusy(id);
      setError(null);
      try {
        await api.post(`/events/registrations/${id}/check_in/`, {
          method: 'manual',
        });
        await registrations.reload();
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        setError(detail ?? 'Could not check that person in.');
      } finally {
        setBusy(null);
      }
    },
    [registrations],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Nothing until they type. Showing every registration by default invites
    // scrolling for a name, which is slower than typing it.
    if (!q) return [];
    return registrations.items
      .filter(
        (r) =>
          r.attendee_name?.toLowerCase().includes(q) ||
          r.attendee_email?.toLowerCase().includes(q) ||
          r.registration_id?.toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [registrations.items, query]);

  const checkedInCount = useMemo(
    () => registrations.items.filter((r) => r.status === 'checked_in').length,
    [registrations.items],
  );

  return (
    <ScreenShell
      title="Check in"
      subtitle="Find the person in front of you and let them in."
      actions={
        <Badge tone="neutral">
          {checkedInCount} of {registrations.items.length} in
        </Badge>
      }
    >
      {error && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-console-lg border border-console-border bg-console-surface px-3 py-2.5">
        <Search size={17} className="shrink-0 text-console-subtle" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name, email or ticket reference…"
          className="w-full bg-transparent text-[15px] text-console-text outline-none placeholder:text-console-subtle"
        />
      </div>

      <Card>
        {registrations.isLoading ? (
          <TableSkeleton rows={3} />
        ) : registrations.error ? (
          <ErrorState
            message={registrations.error}
            onRetry={registrations.reload}
          />
        ) : !query.trim() ? (
          <EmptyState message="Start typing to find someone. Nothing is listed until you search — at the door you are looking for one person, not browsing." />
        ) : results.length === 0 ? (
          <EmptyState
            title="No match"
            message={`Nobody registered matches “${query}”. Check the spelling, or try their ticket reference.`}
          />
        ) : (
          <ul className="divide-y divide-console-border">
            {results.map((r) => {
              const already = r.status === 'checked_in';
              const unpaid =
                r.payment_status && !['paid', 'free'].includes(r.payment_status);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <Avatar name={r.attendee_name ?? '?'} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-console-text">
                      {r.attendee_name ?? 'Unnamed'}
                    </p>
                    <p className="truncate text-[12px] text-console-subtle">
                      {r.event_title} · {r.registration_id}
                    </p>
                  </div>

                  {/* Payment state is shown but never blocks the door — that is
                      a conversation for the desk, not a locked turnstile. */}
                  {unpaid && <Badge tone="caution">{r.payment_status}</Badge>}

                  {already ? (
                    <Badge tone="success">
                      <Check size={11} /> Already in
                    </Badge>
                  ) : (
                    <Btn
                      variant="primary"
                      size="md"
                      disabled={busy === r.id}
                      onClick={() => checkIn(r.id)}
                    >
                      <ScanLine size={15} />
                      {busy === r.id ? 'Checking in…' : 'Check in'}
                    </Btn>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </ScreenShell>
  );
};

export default CheckIn;
