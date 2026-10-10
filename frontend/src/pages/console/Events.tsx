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
 * touch nothing. They get the list and the way to check-in, and no row actions.
 *
 * Registrations are an event manager's view, per event. The backend answers
 * the registrations list with only the caller's own tickets unless they hold
 * `events.manage`, so it is not offered to anyone else; the door has its own
 * endpoints and its own screen.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Check, Lock, Pencil, Plus, ScanLine, Trash2, X } from 'lucide-react';
import api from '../../api/axios';
import EventEditor, {
  type EventDraft,
} from '../../components/console/EventEditor';
import ScreenShell from '../../components/console/ScreenShell';
import {
  AlertBanner,
  Avatar,
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Pager,
  PaymentPill,
  PublishPill,
  RegistrationPill,
  ScopePill,
  SearchField,
  Skeleton,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { PermissionGate } from '../../components/console/PermissionGate';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsolePage } from '../../hooks/useConsoleList';
import { useConsoleStats } from '../../hooks/useConsoleStats';
import { useDebounced } from '../../hooks/useDebounced';
import { parseAPIDate } from '../../utils/dates';

/** `EventListSerializer`. */
interface EventRow {
  id: string;
  title: string;
  event_type?: string;
  status: string;
  venue?: string;
  city?: string;
  cover_image?: string | null;
  is_virtual?: boolean;
  start_datetime?: string;
  end_datetime?: string;
  /** Confirmed and arrived, counted live. */
  registration_count: number;
  max_attendees: number | null;
  /** Places not yet taken, pending registrations included. Null with no limit. */
  spots_remaining?: number | null;
  registration_status: 'not_open' | 'open' | 'closed' | 'full';
  current_price?: string | number | null;
  is_free?: boolean;
  scope_node_detail: { id: string; name: string; node_type: string } | null;
  bedspaces_enabled?: boolean;
}

/** One hostel in the `bedspaces` summary. */
interface HostelRow {
  id: string;
  name: string;
  code: string;
  gender: 'male' | 'female';
  capacity: number;
  reserved_for_leaders: number;
  attendees_placed: number;
  leaders_placed: number;
  attendee_beds_free: number;
  leader_beds_free: number;
}

interface BedSummary {
  enabled: boolean;
  hostels: HostelRow[];
  /** Hold a place at the event, have no bed. */
  waiting: number;
  waiting_without_gender: number;
}

/** `EventRegistrationListSerializer`. */
interface RegistrationRow {
  id: string;
  registration_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_parish?: string;
  status: string;
  payment_status: string;
  attendee_gender?: string;
  attending_as_leader?: boolean;
  bed?: { code: string; hostel: string; hostel_id: string; is_firm: boolean } | null;
}

/** `EventDashboardStatsSerializer`. */
interface EventTotals {
  total_registrations: number;
  confirmed_count: number;
  pending_count: number;
  waitlisted_count: number;
  checked_in_count: number;
  paid_count: number;
  total_revenue: string | number;
}

type Tab = 'upcoming' | 'past' | 'drafts';
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'waitlisted' | 'cancelled';

const PAGE_SIZE = 20;

const TAB_PARAMS: Record<Tab, Record<string, string>> = {
  upcoming: { upcoming: 'true', ordering: 'start_datetime' },
  past: { upcoming: 'false', ordering: '-start_datetime' },
  drafts: { status: 'draft', ordering: '-created_at' },
};

const naira = (value: string | number | null | undefined) =>
  `₦${Number(value ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

const dayOf = (value: string | undefined) => {
  const d = parseAPIDate(value);
  return d
    ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
};

const placeOf = (e: EventRow) =>
  e.is_virtual ? 'Online' : [e.venue, e.city].filter(Boolean).join(', ') || 'Venue not set';

const errorDetail = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
  fallback;

const REGISTRATION_STATE: Record<
  EventRow['registration_status'],
  { label: string; tone: string; Icon: typeof Check }
> = {
  open: { label: 'Open', tone: 'bg-pop-green text-pop-on', Icon: Check },
  not_open: { label: 'Not open yet', tone: 'bg-console-tinted text-console-muted', Icon: Lock },
  closed: { label: 'Closed', tone: 'bg-console-tinted text-console-muted', Icon: Lock },
  full: { label: 'Full', tone: 'bg-pop-amber text-pop-on', Icon: Lock },
};

const Registered = ({ event }: { event: EventRow }) => {
  const max = event.max_attendees;
  // The bar is places *taken*, which includes people still pending: that is
  // what the server decides "Full" from, and the two must not disagree.
  const taken =
    max && event.spots_remaining != null
      ? max - event.spots_remaining
      : event.registration_count;
  const share = max ? Math.max(0, Math.min(100, (taken / max) * 100)) : 0;
  return (
    <div className="w-40 max-w-full">
      <p className="text-[12px] font-semibold leading-4 tabular-nums text-console-text">
        {event.registration_count.toLocaleString()}
        {max ? ` of ${max.toLocaleString()}` : ' registered'}
      </p>
      {max ? (
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-console-tinted"
          role="img"
          aria-label={`${Math.round(share)}% of places taken`}
        >
          <div className="h-full rounded-full bg-console-go" style={{ width: `${share}%` }} />
        </div>
      ) : (
        <p className="text-[12px] font-medium leading-4 text-console-muted">No limit set</p>
      )}
    </div>
  );
};

const StatTile = ({
  tone,
  value,
  label,
  loading,
}: {
  tone: string;
  value: string;
  label: string;
  loading: boolean;
}) => (
  <div className={`flex min-h-[84px] flex-col justify-center rounded-console-lg px-4 py-3 text-pop-on ${tone}`}>
    {loading ? (
      <Skeleton className="h-9 w-16 opacity-40" />
    ) : (
      <p className="text-[32px] font-extrabold leading-10 tracking-[-0.02em] tabular-nums">
        {value}
      </p>
    )}
    <p className="text-[14px] leading-5">{label}</p>
  </div>
);

const BED_FIELD =
  'mt-1 w-full rounded-console-md border-2 border-transparent bg-console-tinted px-3 py-2 text-[14px] leading-5 text-console-text outline-none transition-colors focus:border-console-text';
const BED_LABEL =
  'block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted';

/**
 * Where people sleep: the hostels, how full each is, and who is still waiting.
 *
 * Beds are given out by the server as people register. This is where the
 * organiser says what beds exist, and asks it to try again for the people
 * without one after adding a hostel or releasing beds reserved for leaders.
 */
const Bedspaces = ({ eventId, onChanged }: { eventId: string; onChanged: () => void }) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', code: '', gender: 'male', capacity: '', reserved: '0' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const summary = useQuery({
    queryKey: ['event-bedspaces', eventId],
    queryFn: async () => (await api.get<BedSummary>(`/events/events/${eventId}/bedspaces/`)).data,
  });

  const refresh = () => {
    summary.refetch();
    onChanged();
  };

  const firstMessage = (err: unknown, fallback: string) => {
    const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
    const first = data ? Object.values(data).flat()[0] : undefined;
    return typeof first === 'string' ? first : fallback;
  };

  const run = async (work: () => Promise<string>, fallback: string) => {
    setBusy(true);
    setNote(null);
    try {
      setNote({ kind: 'success', text: await work() });
      refresh();
    } catch (err) {
      setNote({ kind: 'error', text: firstMessage(err, fallback) });
    } finally {
      setBusy(false);
    }
  };

  const addHostel = () =>
    run(async () => {
      await api.post('/events/hostels/', {
        event: eventId,
        name: draft.name.trim(),
        code: draft.code.trim(),
        gender: draft.gender,
        capacity: Number(draft.capacity),
        reserved_for_leaders: Number(draft.reserved) || 0,
      });
      const name = draft.name.trim();
      setDraft({ name: '', code: '', gender: 'male', capacity: '', reserved: '0' });
      setAdding(false);
      return `${name} is added. Press "Place people waiting" to fill it.`;
    }, "We couldn't add that hostel. Try again.");

  const placeWaiting = () =>
    run(async () => {
      const { data } = await api.post<{ placed: number }>(`/events/events/${eventId}/place_waiting/`);
      return data.placed
        ? `${data.placed} ${data.placed === 1 ? 'person was' : 'people were'} given a bed.`
        : 'Nobody could be placed. There is no free bed for the people waiting.';
    }, "We couldn't place people. Try again.");

  const setReserved = (hostel: HostelRow, value: number) =>
    run(async () => {
      await api.patch(`/events/hostels/${hostel.id}/`, { reserved_for_leaders: value });
      return `${hostel.name} now keeps ${value} ${value === 1 ? 'bed' : 'beds'} for leaders.`;
    }, "We couldn't change that. Try again.");

  const remove = (hostel: HostelRow) =>
    run(async () => {
      await api.delete(`/events/hostels/${hostel.id}/`);
      return `${hostel.name} is removed.`;
    }, "We couldn't remove that hostel. Try again.");

  const s = summary.data;
  const ready = draft.name.trim() && draft.code.trim() && Number(draft.capacity) > 0;

  return (
    <Card className="mb-5 flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
            Bedspaces
          </h2>
          <p className="text-[14px] leading-5 text-console-body">
            {summary.isPending
              ? 'Loading the hostels…'
              : !s || s.hostels.length === 0
                ? 'No hostels yet. Add one and beds are given out automatically.'
                : s.waiting === 0
                  ? 'Everyone who holds a place has a bed.'
                  : `${s.waiting} ${s.waiting === 1 ? 'person has' : 'people have'} no bed${
                      s.waiting_without_gender
                        ? `, ${s.waiting_without_gender} of them because no gender is recorded`
                        : ''
                    }.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {s && s.waiting > 0 && s.hostels.length > 0 && (
            <Btn variant="soft" size="md" disabled={busy} onClick={placeWaiting}>
              Place people waiting
            </Btn>
          )}
          <Btn size="md" onClick={() => setAdding((v) => !v)}>
            <Plus size={16} /> Add hostel
          </Btn>
        </div>
      </div>

      {note && (
        <AlertBanner
          kind={note.kind}
          action={
            <Btn variant="soft" size="md" onClick={() => setNote(null)}>
              Dismiss
            </Btn>
          }
        >
          {note.text}
        </AlertBanner>
      )}

      {summary.isError && (
        <AlertBanner
          kind="error"
          action={
            <Btn variant="soft" size="md" onClick={() => summary.refetch()}>
              Try again
            </Btn>
          }
        >
          We couldn't load the hostels.
        </AlertBanner>
      )}

      {adding && (
        <div className="grid gap-3 rounded-console-lg bg-console-tinted p-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block lg:col-span-2">
            <span className={BED_LABEL}>Name</span>
            <input
              className={`${BED_FIELD} bg-console-surface`}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Hostel A"
            />
          </label>
          <label className="block">
            <span className={BED_LABEL}>Bed prefix</span>
            <input
              className={`${BED_FIELD} bg-console-surface`}
              value={draft.code}
              maxLength={10}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder="HA"
            />
          </label>
          <label className="block">
            <span className={BED_LABEL}>For</span>
            <select
              className={`${BED_FIELD} bg-console-surface`}
              value={draft.gender}
              onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
            >
              <option value="male">Boys</option>
              <option value="female">Girls</option>
            </select>
          </label>
          <label className="block">
            <span className={BED_LABEL}>Beds</span>
            <input
              type="number"
              min={1}
              className={`${BED_FIELD} bg-console-surface`}
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={BED_LABEL}>For leaders</span>
            <input
              type="number"
              min={0}
              className={`${BED_FIELD} bg-console-surface`}
              value={draft.reserved}
              onChange={(e) => setDraft({ ...draft, reserved: e.target.value })}
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
            <Btn variant="primary" size="md" disabled={!ready || busy} onClick={addHostel}>
              {busy ? 'Adding…' : 'Add hostel'}
            </Btn>
            <p className="text-[12px] font-medium leading-4 text-console-muted">
              Beds are numbered {draft.code.trim() || 'HA'}-001 upward. "For leaders" beds are kept
              out of the attendees' count.
            </p>
          </div>
        </div>
      )}

      {s && s.hostels.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Hostel</Th>
              <Th>For</Th>
              <Th>Attendees</Th>
              <Th>Leaders</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {s.hostels.map((h) => {
              const attendeeBeds = h.capacity - h.reserved_for_leaders;
              return (
                <tr key={h.id}>
                  <Td>
                    <span className="block font-semibold leading-5 text-console-text">{h.name}</span>
                    <span className="block text-[12px] font-medium leading-4 tabular-nums text-console-muted">
                      {h.code}-001 to {h.code}-{String(h.capacity).padStart(3, '0')}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={h.gender === 'male' ? 'info' : 'action'}>
                      {h.gender === 'male' ? 'Boys' : 'Girls'}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-console-text">
                    {h.attendees_placed} of {attendeeBeds}
                    <span className="text-console-muted"> · {h.attendee_beds_free} free</span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-console-text">
                    {h.leaders_placed} of {h.reserved_for_leaders}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      {h.leader_beds_free > 0 && (
                        <Btn
                          variant="soft"
                          disabled={busy}
                          title="Give the unused leader beds to attendees"
                          onClick={() => setReserved(h, h.leaders_placed)}
                        >
                          Release {h.leader_beds_free} leader {h.leader_beds_free === 1 ? 'bed' : 'beds'}
                        </Btn>
                      )}
                      {h.attendees_placed + h.leaders_placed === 0 && (
                        <Btn
                          variant="danger"
                          disabled={busy}
                          aria-label={`Remove ${h.name}`}
                          onClick={() => remove(h)}
                        >
                          Remove
                        </Btn>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
};

/** One event's registrations, for the people who manage it. */
const Registrations = ({ event, onBack }: { event: EventRow; onBack: () => void }) => {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<RegistrationRow | null>(null);
  const [placing, setPlacing] = useState<RegistrationRow | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const search = useDebounced(query.trim());

  const list = useConsolePage<RegistrationRow>(`/events/events/${event.id}/registrations/`, {
    params: {
      status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      page,
      page_size: PAGE_SIZE,
    },
    errorMessage: `We couldn't load the registrations for ${event.title}.`,
  });

  const totals = useQuery({
    queryKey: ['event-dashboard', event.id],
    queryFn: async () => {
      const { data } = await api.get<EventTotals>(`/events/events/${event.id}/dashboard/`);
      return data;
    },
  });

  const refresh = useCallback(() => {
    list.reload();
    totals.refetch();
  }, [list, totals]);

  /**
   * Confirm, cancel or check in one registration. The backend treats a repeat
   * as a no-op and refuses a check-in it should not allow (unpaid, cancelled,
   * waitlisted) with a sentence written for the person at the door.
   */
  const act = useCallback(
    async (row: RegistrationRow, action: 'confirmed' | 'cancelled' | 'check_in') => {
      setBusy(row.id);
      setNotice(null);
      try {
        if (action === 'check_in') {
          await api.post(`/events/registrations/${row.id}/check_in/`, { method: 'manual' });
        } else {
          await api.post(`/events/registrations/${row.id}/update_status/`, { status: action });
        }
        setNotice({
          kind: 'success',
          text:
            action === 'check_in'
              ? `${row.attendee_name} is checked in.`
              : action === 'confirmed'
                ? `${row.attendee_name} is confirmed. They have been told.`
                : `${row.attendee_name}'s registration is cancelled. They have been told.`,
        });
        refresh();
      } catch (err) {
        setNotice({
          kind: 'error',
          text: errorDetail(err, `We couldn't update ${row.attendee_name}. Try again.`),
        });
      } finally {
        setBusy(null);
        setCancelling(null);
      }
    },
    [refresh],
  );

  const hostels = useQuery({
    queryKey: ['event-bedspaces', event.id],
    enabled: Boolean(event.bedspaces_enabled),
    queryFn: async () => (await api.get<BedSummary>(`/events/events/${event.id}/bedspaces/`)).data,
  });

  /** Put someone in a named hostel, or take their bed back. */
  const placeIn = async (row: RegistrationRow, hostelId: string | null) => {
    setBusy(row.id);
    setNotice(null);
    try {
      const { data } = hostelId
        ? await api.post<RegistrationRow>(`/events/registrations/${row.id}/assign_bed/`, { hostel: hostelId })
        : await api.post<RegistrationRow>(`/events/registrations/${row.id}/release_bed/`);
      setNotice({
        kind: 'success',
        text: data.bed
          ? `${row.attendee_name} is in bed ${data.bed.code}, ${data.bed.hostel}.`
          : `${row.attendee_name} no longer has a bed.`,
      });
      refresh();
      hostels.refetch();
    } catch (err) {
      setNotice({ kind: 'error', text: errorDetail(err, `We couldn't place ${row.attendee_name}. Try again.`) });
    } finally {
      setBusy(null);
      setPlacing(null);
    }
  };

  const t = totals.data;
  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'waitlisted', label: 'Waitlisted' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <ScreenShell
      crumb={`Events  /  ${event.title}  /  Registrations`}
      title="Registrations"
      subtitle={`${event.title} · ${dayOf(event.start_datetime)} · ${placeOf(event)}`}
      hideScope
      actions={
        <>
          <Btn size="md" onClick={onBack}>
            <ArrowLeft size={16} /> All events
          </Btn>
          <PermissionGate permission="events.checkin">
            <Link
              to="/admin/check-in"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-console-go px-4 text-[14px] font-semibold leading-5 text-console-on-go transition-[filter] hover:brightness-95"
            >
              <ScanLine size={16} /> Open check-in
            </Link>
          </PermissionGate>
        </>
      }
    >
      {placing && (
        <Modal
          title={`Choose a hostel for ${placing.attendee_name}`}
          subtitle={
            placing.attending_as_leader
              ? 'They are coming as a leader, so they take a bed reserved for leaders.'
              : 'They take the first free bed in the hostel you choose.'
          }
          onClose={() => setPlacing(null)}
          width={480}
        >
          <div className="flex flex-col gap-2">
            {(hostels.data?.hostels ?? []).map((h) => {
              const free = placing.attending_as_leader ? h.leader_beds_free : h.attendee_beds_free;
              return (
                <Btn
                  key={h.id}
                  variant="soft"
                  size="md"
                  className="!justify-between"
                  disabled={busy === placing.id || free <= 0 || placing.bed?.hostel_id === h.id}
                  onClick={() => placeIn(placing, h.id)}
                >
                  <span>
                    {h.name} · {h.gender === 'male' ? 'Boys' : 'Girls'}
                  </span>
                  <span className="font-medium tabular-nums">
                    {placing.bed?.hostel_id === h.id ? 'They are here' : `${Math.max(0, free)} free`}
                  </span>
                </Btn>
              );
            })}
            {placing.bed && (
              <Btn variant="danger" size="md" disabled={busy === placing.id} onClick={() => placeIn(placing, null)}>
                Take their bed back
              </Btn>
            )}
          </div>
        </Modal>
      )}

      {cancelling && (
        <Modal
          title={`Cancel ${cancelling.attendee_name}'s registration?`}
          subtitle="Their place is released and they are emailed. Any refund is handled separately."
          onClose={() => setCancelling(null)}
          width={480}
          footer={
            <>
              <Btn size="md" onClick={() => setCancelling(null)}>
                Keep it
              </Btn>
              <Btn
                variant="danger"
                size="md"
                disabled={busy === cancelling.id}
                onClick={() => act(cancelling, 'cancelled')}
              >
                {busy === cancelling.id ? 'Cancelling…' : 'Cancel registration'}
              </Btn>
            </>
          }
        >
          {null}
        </Modal>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          tone="bg-pop-violet"
          loading={totals.isPending}
          value={(t?.total_registrations ?? 0).toLocaleString()}
          label={event.max_attendees ? `Registered of ${event.max_attendees.toLocaleString()}` : 'Registered'}
        />
        <StatTile tone="bg-pop-green" loading={totals.isPending} value={(t?.confirmed_count ?? 0).toLocaleString()} label="Confirmed" />
        <StatTile tone="bg-pop-amber" loading={totals.isPending} value={(t?.pending_count ?? 0).toLocaleString()} label="Pending" />
        <StatTile
          tone="bg-pop-sky"
          loading={totals.isPending}
          value={(t?.paid_count ?? 0).toLocaleString()}
          label={`Paid · ${naira(t?.total_revenue)}`}
        />
        <StatTile tone="bg-pop-pink" loading={totals.isPending} value={(t?.checked_in_count ?? 0).toLocaleString()} label="Checked in" />
      </div>

      {event.bedspaces_enabled && (
        <Bedspaces
          eventId={event.id}
          onChanged={() => {
            list.reload();
            hostels.refetch();
          }}
        />
      )}

      {notice && (
        <AlertBanner
          kind={notice.kind}
          className="mb-4"
          action={
            <Btn variant="soft" size="md" onClick={() => setNotice(null)}>
              Dismiss
            </Btn>
          }
        >
          {notice.text}
        </AlertBanner>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex-1 [&>div]:mb-0">
          <Tabs
            tabs={filters}
            active={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
          />
        </div>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          label={`Search registrations for ${event.title}`}
          placeholder="Search name, email or ticket"
        />
      </div>

      <Card>
        {list.isLoading ? (
          <TableSkeleton rows={6} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <EmptyState
            title={
              search
                ? `No registration matches “${search}”`
                : filter === 'all'
                  ? `No registrations for ${event.title} yet`
                  : `No ${filter} registrations`
            }
            message={
              search || filter !== 'all'
                ? 'Try another name, or switch back to All.'
                : 'They appear here as teens sign up in the app.'
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Ticket</Th>
                  <Th>Attendee</Th>
                  <Th>Parish</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  {event.bedspaces_enabled && <Th>Bed</Th>}
                  <Th />
                </tr>
              </thead>
              <tbody className={list.isFetching ? 'opacity-60' : ''}>
                {list.items.map((r) => (
                  <tr key={r.id} className="hover:bg-console-tinted">
                    <Td className="whitespace-nowrap text-[12px] font-medium tabular-nums text-console-body">
                      {r.registration_id}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.attendee_name} size={36} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold leading-5 text-console-text">
                            {r.attendee_name}
                          </span>
                          <span className="block truncate text-[12px] font-medium leading-4 text-console-muted">
                            {r.attendee_email}
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td className="text-console-text">{r.attendee_parish || '—'}</Td>
                    <Td>
                      <RegistrationPill status={r.status} />
                    </Td>
                    <Td>
                      <PaymentPill status={r.payment_status} />
                    </Td>
                    {event.bedspaces_enabled && (
                      <Td>
                        <button
                          type="button"
                          disabled={r.status === 'cancelled' || r.status === 'waitlisted' || r.status === 'no_show'}
                          onClick={() => setPlacing(r)}
                          aria-label={
                            r.bed
                              ? `${r.attendee_name} is in bed ${r.bed.code}. Change it.`
                              : `${r.attendee_name} has no bed. Choose a hostel.`
                          }
                          className="rounded-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text disabled:opacity-50"
                        >
                          {r.bed ? (
                            <Badge
                              tone={r.bed.is_firm ? 'success' : 'caution'}
                              title={r.bed.is_firm ? r.bed.hostel : `${r.bed.hostel}. Held until payment is confirmed.`}
                            >
                              {r.bed.code}
                              {r.bed.is_firm ? '' : ' · held'}
                            </Badge>
                          ) : (
                            <Badge>No bed</Badge>
                          )}
                        </button>
                        {r.attending_as_leader && (
                          <span className="ml-1.5 text-[12px] font-medium text-console-muted">Leader</span>
                        )}
                      </Td>
                    )}
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {(r.status === 'pending' || r.status === 'waitlisted') && (
                          <Btn variant="soft" disabled={busy === r.id} onClick={() => act(r, 'confirmed')}>
                            <Check size={14} /> Confirm
                          </Btn>
                        )}
                        {r.status === 'confirmed' && (
                          <PermissionGate permission="events.checkin">
                            <Btn variant="go" disabled={busy === r.id} onClick={() => act(r, 'check_in')}>
                              <ScanLine size={14} /> Check in
                            </Btn>
                          </PermissionGate>
                        )}
                        {(r.status === 'pending' || r.status === 'confirmed' || r.status === 'waitlisted') && (
                          <Btn
                            variant="danger"
                            disabled={busy === r.id}
                            aria-label={`Cancel ${r.attendee_name}'s registration`}
                            onClick={() => setCancelling(r)}
                          >
                            <X size={14} /> Cancel
                          </Btn>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              count={list.count}
              shown={list.items.length}
              noun={list.count === 1 ? 'registration' : 'registrations'}
              onPage={setPage}
            />
          </>
        )}
      </Card>
    </ScreenShell>
  );
};

export const Events = () => {
  const { can, scopeNode, assignments } = useConsoleAuth();
  const { stats } = useConsoleStats();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EventDraft | null>(null);
  const [open, setOpen] = useState<EventRow | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleted, setDeleted] = useState<string | null>(null);

  /**
   * Open an event for editing from its full record. A list row leaves out the
   * description, address and state, and an editor filled from it would save
   * those back as blanks.
   */
  const edit = async (row: EventRow) => {
    setOpening(row.id);
    setOpenError(null);
    try {
      const { data } = await api.get<EventDraft>(`/events/events/${row.id}/`);
      setEditing({ ...data, id: row.id });
    } catch {
      setOpenError(`We couldn't open ${row.title} for editing. Try again.`);
    } finally {
      setOpening(null);
    }
  };

  const canManage = can('events.manage');
  const canView = can('events.view');
  const where = assignments[0]?.node_detail?.name ?? scopeNode?.name;

  const events = useConsolePage<EventRow>('/events/events/', {
    enabled: canView,
    params: { ...TAB_PARAMS[tab], page, page_size: PAGE_SIZE },
    errorMessage: "We couldn't load events. Try again.",
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setOpenError(null);
    try {
      await api.delete(`/events/events/${deleting.id}/`);
      setDeleted(`${deleting.title} is deleted.`);
      events.reload();
    } catch (err: unknown) {
      // The server's reason is the useful part: it says when to archive
      // instead (an event people have paid for), so it is shown as sent.
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setOpenError(detail ?? `We couldn't delete ${deleting.title}. Try again.`);
    } finally {
      setDeleting(null);
      setDeleteBusy(false);
    }
  };

  const tabs = useMemo(() => {
    const base: { id: Tab; label: string }[] = [
      { id: 'upcoming', label: 'Upcoming' },
      { id: 'past', label: 'Past' },
    ];
    // Only a manager is ever sent an unpublished event, so only a manager has
    // a Drafts tab.
    if (canManage) base.push({ id: 'drafts', label: 'Drafts' });
    return base;
  }, [canManage]);

  if (open) return <Registrations event={open} onBack={() => setOpen(null)} />;

  const pending = stats?.sections.events?.registrations.pending ?? 0;

  return (
    <ScreenShell
      title="Events"
      subtitle={
        events.isLoading || events.error
          ? 'Events for your part of the church, and who has registered for them.'
          : `${events.count.toLocaleString()} ${tab === 'drafts' ? 'in draft' : tab}${where ? ` for ${where}` : ''}`
      }
      readOnly={canView && !canManage}
      hideScope
      actions={
        <PermissionGate permission="events.manage">
          <Btn variant="primary" size="md" onClick={() => setEditing({})}>
            <Plus size={16} /> New event
          </Btn>
        </PermissionGate>
      }
    >
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

      {deleting && (
        <Modal
          title={`Delete ${deleting.title}?`}
          subtitle="This cannot be undone. The event goes, with every registration, ticket, hostel and bed on it. Nobody who registered is told. It is meant for test events and mistakes: for an event that is over or called off, archive it instead, which keeps the record of who came."
          onClose={() => setDeleting(null)}
          width={480}
          footer={
            <>
              <Btn size="md" onClick={() => setDeleting(null)}>
                Cancel
              </Btn>
              <Btn variant="danger" size="md" disabled={deleteBusy} onClick={confirmDelete}>
                {deleteBusy ? 'Deleting…' : 'Delete event'}
              </Btn>
            </>
          }
        >
          {null}
        </Modal>
      )}

      {deleted && (
        <AlertBanner
          kind="success"
          className="mb-4"
          action={
            <Btn variant="soft" size="md" onClick={() => setDeleted(null)}>
              Dismiss
            </Btn>
          }
        >
          {deleted}
        </AlertBanner>
      )}

      {openError && (
        <AlertBanner
          kind="error"
          className="mb-4"
          action={
            <Btn variant="soft" size="md" onClick={() => setOpenError(null)}>
              Dismiss
            </Btn>
          }
        >
          {openError}
        </AlertBanner>
      )}

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
        }}
      />

      <Card>
        {events.isLoading ? (
          <TableSkeleton rows={5} />
        ) : events.error ? (
          <ErrorState message={events.error} onRetry={events.reload} />
        ) : events.items.length === 0 ? (
          <EmptyState
            title={
              tab === 'drafts'
                ? 'No drafts'
                : `No ${tab} events${where ? ` for ${where}` : ''} yet`
            }
            message={
              tab === 'upcoming'
                ? canManage
                  ? 'Create the first one and teens will see it in the app.'
                  : 'Events created higher up the church appear here automatically.'
                : tab === 'past'
                  ? 'Events move here once they have ended.'
                  : 'An event you save without publishing waits here.'
            }
            action={
              tab === 'upcoming' && canManage ? (
                <Btn variant="primary" size="md" onClick={() => setEditing({})}>
                  New event
                </Btn>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th>Date</Th>
                  <Th>Scope</Th>
                  <Th>Registration</Th>
                  <Th>Registered</Th>
                  <Th>Price</Th>
                  {canManage && <Th />}
                </tr>
              </thead>
              <tbody className={events.isFetching ? 'opacity-60' : ''}>
                {events.items.map((e) => {
                  const state = REGISTRATION_STATE[e.registration_status];
                  return (
                    <tr key={e.id} className="hover:bg-console-tinted">
                      <Td>
                        <div className="flex items-center gap-3">
                          {e.cover_image ? (
                            <img
                              src={e.cover_image}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-[12px] object-cover"
                            />
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-pop-violet text-pop-on">
                              <CalendarDays size={20} />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold leading-5 text-console-text">
                                {e.title}
                              </span>
                              {e.status !== 'published' && <PublishPill status={e.status} />}
                            </span>
                            <span className="block truncate text-[12px] font-medium leading-4 text-console-muted">
                              {placeOf(e)}
                            </span>
                          </span>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-console-text">
                        {dayOf(e.start_datetime)}
                      </Td>
                      <Td>
                        <ScopePill name={e.scope_node_detail?.name} />
                      </Td>
                      <Td>
                        {state ? (
                          <span
                            className={`inline-flex h-[26px] items-center gap-1 whitespace-nowrap rounded-full pl-1.5 pr-2.5 text-[12px] font-semibold leading-4 ${state.tone}`}
                          >
                            <state.Icon size={14} strokeWidth={2.5} /> {state.label}
                          </span>
                        ) : (
                          <Badge>{e.registration_status}</Badge>
                        )}
                      </Td>
                      <Td>
                        <Registered event={e} />
                      </Td>
                      <Td className="whitespace-nowrap font-semibold text-console-text">
                        {e.is_free ? 'Free' : naira(e.current_price)}
                      </Td>
                      {/* Absent for a Parish Leader: they hold events.view and
                          can read the record, but not touch it. */}
                      {canManage && (
                        <Td>
                          <div className="flex justify-end gap-1.5">
                            <Btn variant="soft" onClick={() => setOpen(e)}>
                              Registrations
                            </Btn>
                            <Btn
                              variant="ghost"
                              aria-label={`Edit ${e.title}`}
                              disabled={opening !== null}
                              onClick={() => edit(e)}
                            >
                              <Pencil size={14} />
                            </Btn>
                            <Btn
                              variant="ghost"
                              aria-label={`Delete ${e.title}`}
                              onClick={() => setDeleting(e)}
                            >
                              <Trash2 size={14} />
                            </Btn>
                          </div>
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {events.count > PAGE_SIZE && (
              <Pager
                page={page}
                pageSize={PAGE_SIZE}
                count={events.count}
                shown={events.items.length}
                noun="events"
                onPage={setPage}
              />
            )}
          </>
        )}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {canManage && pending > 0 && (
          <div className="rounded-console-xl bg-pop-sky p-5 text-pop-on">
            <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.08em]">Pending</p>
            <p className="mt-1 text-[20px] font-bold leading-7 tracking-[-0.01em]">
              {pending.toLocaleString()} {pending === 1 ? 'registration' : 'registrations'} to confirm
            </p>
            <p className="mt-1 text-[14px] leading-5">
              Open an event's registrations and filter to Pending.
            </p>
          </div>
        )}
        <PermissionGate permission="events.checkin">
          <Link
            to="/admin/check-in"
            className="block rounded-console-xl bg-pop-lime p-5 text-pop-on transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text"
          >
            <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.08em]">At the door</p>
            <p className="mt-1 text-[20px] font-bold leading-7 tracking-[-0.01em]">
              Open check-in for an event
            </p>
            <p className="mt-1 text-[14px] leading-5">Find a ticket by name or number.</p>
          </Link>
        </PermissionGate>
      </div>
    </ScreenShell>
  );
};

export default Events;
