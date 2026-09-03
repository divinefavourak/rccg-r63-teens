/**
 * Events — everything scoped at or above where you are looking.
 *
 * Visibility and management are two different questions, kept apart in
 * `events/scoping.py`: you *see* an event whose `scope_node` is at or above your
 * position, and you *manage* one only where you hold `events.manage` at an
 * ancestor-or-self of it. Both are enforced server-side by path-prefix
 * comparison, so this screen never filters by node itself.
 *
 * The Parish Leader case is the design problem worth naming: `events.view`
 * without `events.manage` means they can read the record and work the door, but
 * touch nothing. They get the list and check-in, and no row menu at all.
 */
import { useCallback, useMemo, useState } from 'react';
import { CalendarDays, Pencil, ScanLine, Users } from 'lucide-react';
import api from '../../api/axios';
import EventEditor, {
  type EventDraft,
} from '../../components/console/EventEditor';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { PermissionGate } from '../../components/console/PermissionGate';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';

interface EventRow {
  id: string;
  title: string;
  event_type?: string;
  status?: string;
  venue?: string;
  city?: string;
  start_datetime?: string;
  registration_count?: number;
  max_attendees?: number | null;
  price?: string | number;
  is_free?: boolean;
}

interface RegistrationRow {
  id: string;
  registration_id?: string;
  attendee_name?: string;
  attendee_email?: string;
  status?: string;
  payment_status?: string;
  event?: string;
  event_title?: string;
}

const EVENT_TONE: Record<string, 'neutral' | 'info' | 'success' | 'caution'> = {
  upcoming: 'info',
  ongoing: 'success',
  completed: 'neutral',
  cancelled: 'caution',
};

const REG_TONE: Record<
  string,
  'neutral' | 'info' | 'caution' | 'success' | 'danger'
> = {
  pending: 'caution',
  confirmed: 'success',
  checked_in: 'success',
  cancelled: 'neutral',
  rejected: 'danger',
  waitlisted: 'info',
  expired: 'neutral',
};

type Tab = 'events' | 'registrations';

export const Events = () => {
  const { can } = useConsoleAuth();
  const [tab, setTab] = useState<Tab>('events');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EventDraft | null>(null);

  const canManage = can('events.manage');
  const canView = can('events.view');

  const events = useConsoleList<EventRow>('/events/events/', {
    enabled: canView,
    params: { ordering: '-start_datetime' },
    errorMessage: 'Could not load events for this scope.',
  });

  const registrations = useConsoleList<RegistrationRow>(
    '/events/registrations/',
    {
      enabled: canView,
      errorMessage: 'Could not load registrations.',
    },
  );

  /**
   * Check someone in at the door.
   *
   * `method: 'manual'` because this is a person tapping a row, not a QR scan —
   * the backend records which, and the distinction matters when reconciling
   * attendance afterwards.
   */
  const checkIn = useCallback(
    async (registrationId: string) => {
      setCheckingIn(registrationId);
      setActionError(null);
      try {
        await api.post(`/events/registrations/${registrationId}/check_in/`, {
          method: 'manual',
        });
        await registrations.reload();
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        setActionError(detail ?? 'Could not check that person in.');
      } finally {
        setCheckingIn(null);
      }
    },
    [registrations],
  );

  const pendingCount = useMemo(
    () => registrations.items.filter((r) => r.status === 'pending').length,
    [registrations.items],
  );

  const tabs = useMemo(
    () => [
      { id: 'events' as const, label: 'Events', count: events.items.length },
      {
        id: 'registrations' as const,
        label: 'Registrations',
        count: registrations.items.length,
      },
    ],
    [events.items.length, registrations.items.length],
  );

  return (
    <ScreenShell
      title="Events"
      subtitle="Events scoped at or above where you are looking, and who has registered for them."
      readOnly={canView && !canManage}
      actions={
        <PermissionGate permission="events.manage">
          <Btn variant="primary" size="sm" onClick={() => setEditing({})}>
            <CalendarDays size={14} /> New event
          </Btn>
        </PermissionGate>
      }
    >
      {actionError && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {actionError}
        </div>
      )}

      {editing && (
        <EventEditor
          event={editing.id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            events.reload();
          }}
        />
      )}

      {pendingCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-console-md border border-console-border bg-console-caution-bg px-3 py-2 text-[13px] text-console-caution">
          <Users size={15} className="shrink-0" />
          {pendingCount} registration{pendingCount === 1 ? '' : 's'} waiting on a
          decision.
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Card>
        {tab === 'events' ? (
          events.isLoading ? (
            <TableSkeleton rows={5} />
          ) : events.error ? (
            <ErrorState message={events.error} onRetry={events.reload} />
          ) : events.items.length === 0 ? (
            <EmptyState
              title="No events here"
              message="Nothing is scoped to your position or above it. Events created higher up the tree appear here automatically."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th>When</Th>
                  <Th>Where</Th>
                  <Th>Registered</Th>
                  <Th>Status</Th>
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {events.items.map((e) => (
                  <tr key={e.id} className="hover:bg-console-tinted">
                    <Td>
                      <span className="font-medium text-console-text">
                        {e.title}
                      </span>
                      {e.event_type && (
                        <span className="ml-1.5 text-[11px] text-console-subtle">
                          {e.event_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-[12px] text-console-muted">
                      {formatDateTime(e.start_datetime)}
                    </Td>
                    <Td className="text-[12px] text-console-muted">
                      {[e.venue, e.city].filter(Boolean).join(', ') || '—'}
                    </Td>
                    <Td className="tabular-nums text-console-body">
                      {e.registration_count ?? 0}
                      {e.max_attendees ? (
                        <span className="text-console-subtle">
                          {' '}
                          / {e.max_attendees}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      {e.status && (
                        <Badge tone={EVENT_TONE[e.status] ?? 'neutral'}>
                          {e.status}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {/* Absent for a Parish Leader: they hold events.view and
                          can read the record, but not touch it. */}
                      <PermissionGate permission="events.manage">
                        <Btn
                          variant="ghost"
                          size="sm"
                          title="Edit this event"
                          onClick={() => setEditing(e as EventDraft)}
                        >
                          <Pencil size={13} />
                        </Btn>
                      </PermissionGate>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        ) : registrations.isLoading ? (
          <TableSkeleton rows={5} />
        ) : registrations.error ? (
          <ErrorState
            message={registrations.error}
            onRetry={registrations.reload}
          />
        ) : registrations.items.length === 0 ? (
          <EmptyState
            title="No registrations"
            message="Nobody has registered for an event in your scope yet."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Attendee</Th>
                <Th>Reference</Th>
                <Th>Event</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {registrations.items.map((r) => (
                <tr key={r.id} className="hover:bg-console-tinted">
                  <Td>
                    <span className="font-medium text-console-text">
                      {r.attendee_name ?? '—'}
                    </span>
                    <span className="block text-[11px] text-console-subtle">
                      {r.attendee_email}
                    </span>
                  </Td>
                  <Td className="font-mono text-[11px] text-console-muted">
                    {r.registration_id ?? '—'}
                  </Td>
                  <Td className="text-[12px] text-console-muted">
                    {r.event_title ?? '—'}
                  </Td>
                  <Td>
                    {r.status && (
                      <Badge tone={REG_TONE[r.status] ?? 'neutral'}>
                        {r.status.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {r.payment_status && (
                      <Badge
                        tone={r.payment_status === 'paid' ? 'success' : 'caution'}
                      >
                        {r.payment_status.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {/*
                      Check-in is its own permission. A Parish Leader holds it
                      without events.manage, so this is the one row action they
                      get — and the only one they need.
                    */}
                    <PermissionGate permission="events.checkin">
                      {r.status !== 'checked_in' && (
                        <Btn
                          variant="secondary"
                          size="sm"
                          disabled={checkingIn === r.id}
                          onClick={() => checkIn(r.id)}
                        >
                          <ScanLine size={13} />
                          {checkingIn === r.id ? 'Checking in…' : 'Check in'}
                        </Btn>
                      )}
                    </PermissionGate>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </ScreenShell>
  );
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default Events;
