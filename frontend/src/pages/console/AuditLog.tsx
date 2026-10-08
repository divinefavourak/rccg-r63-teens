/**
 * Audit log — who did what, and when.
 *
 * Two append-only sources, deliberately shown side by side rather than merged:
 *
 * * **Authority** — every `RoleAssignment` ever made, including revoked ones.
 *   `revoke_role` sets `is_active = False` and stamps an end date; it never
 *   deletes, so a revoked grant remains legible as something that happened.
 * * **Registrations** — `RegistrationAuditLog`, an `AppendOnlyModel` whose
 *   queryset refuses update and delete at the ORM level, not by convention.
 *
 * Merging them into one stream would need a common shape neither has, and would
 * imply an ordering guarantee across two independently-timestamped tables that
 * the database does not provide.
 *
 * Each tab is gated on the permission its endpoint asks for: `roles.view` for
 * authority, `events.manage` for registrations. Both are paged by the server.
 */
import { useMemo, useState } from 'react';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Pager,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsolePage } from '../../hooks/useConsoleList';
import type { ConsoleRoleAssignment } from '../../types/console';

/** `RegistrationAuditLogSerializer`. */
interface RegistrationAudit {
  id: string;
  registration_code?: string;
  attendee_name?: string;
  user_name?: string | null;
  action: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  timestamp: string;
}

type Tab = 'authority' | 'registrations';

const PAGE_SIZE = 25;

const ACTIONS: Record<string, string> = {
  create: 'Registered',
  update: 'Edited',
  status_change: 'Status changed',
  payment_update: 'Payment updated',
  check_in: 'Checked in',
  cancel: 'Cancelled',
};

const plain = (value: unknown) => String(value ?? '').replace(/_/g, ' ');

/** "pending to confirmed", from the before and after the log keeps. */
function changeOf(row: RegistrationAudit): string {
  const after = row.new_values ?? {};
  const before = row.old_values ?? {};
  const parts = Object.keys(after).map((key) =>
    key in before ? `${plain(before[key])} to ${plain(after[key])}` : plain(after[key]),
  );
  return parts.join(', ') || '—';
}

export const AuditLog = () => {
  const { can } = useConsoleAuth();
  const canAuthority = can('roles.view');
  const canRegistrations = can('events.manage');
  const [chosen, setChosen] = useState<Tab | null>(null);
  const [grantPage, setGrantPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const tab: Tab = chosen ?? (canAuthority ? 'authority' : 'registrations');

  const grants = useConsolePage<ConsoleRoleAssignment>('/identity/role-assignments/', {
    enabled: canAuthority,
    params: { page: grantPage, page_size: PAGE_SIZE },
    errorMessage: "We couldn't load the authority history. Try again.",
  });

  const registrations = useConsolePage<RegistrationAudit>('/events/audit-logs/', {
    enabled: canRegistrations,
    params: { page: auditPage, page_size: PAGE_SIZE },
    errorMessage: "We couldn't load the registration history. Try again.",
  });

  const tabs = useMemo(() => {
    const out: { id: Tab; label: string; count?: number }[] = [];
    if (canAuthority) {
      out.push({ id: 'authority', label: 'Authority', count: grants.isLoading ? undefined : grants.count });
    }
    if (canRegistrations) {
      out.push({
        id: 'registrations',
        label: 'Registrations',
        count: registrations.isLoading ? undefined : registrations.count,
      });
    }
    return out;
  }, [canAuthority, canRegistrations, grants.isLoading, grants.count, registrations.isLoading, registrations.count]);

  return (
    <ScreenShell
      title="Audit log"
      subtitle="An append-only record. Nothing here can be edited or removed. Ending a role leaves the grant visible, ended."
      hideScope
    >
      {tabs.length > 1 && <Tabs tabs={tabs} active={tab} onChange={setChosen} />}

      <Card>
        {tabs.length === 0 ? (
          <EmptyState
            art="sitting"
            title="This isn't part of your role"
            message="The audit log is for people who can see roles or manage events."
          />
        ) : tab === 'authority' ? (
          grants.isLoading ? (
            <TableSkeleton rows={6} />
          ) : grants.error ? (
            <ErrorState message={grants.error} onRetry={grants.reload} />
          ) : grants.items.length === 0 ? (
            <EmptyState
              title="No roles have been granted yet"
              message="Each grant appears here when it is made, and stays after it ends."
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Person</Th>
                    <Th>Role</Th>
                    <Th>Period</Th>
                    <Th>Granted by</Th>
                    <Th>State</Th>
                  </tr>
                </thead>
                <tbody className={grants.isFetching ? 'opacity-60' : ''}>
                  {grants.items.map((g) => (
                    <tr key={g.id} className="hover:bg-console-tinted">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={g.user_detail?.display_name ?? '?'} size={36} />
                          <span className="font-semibold text-console-text">
                            {g.user_detail?.display_name ?? g.user_detail?.username ?? '—'}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone="action">
                          {g.role_detail?.label ?? 'Role'}
                          {g.node_detail ? ` @ ${g.node_detail.name}` : ''}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-console-text">
                        {formatDate(g.start_date)}{' '}
                        <span className="text-console-muted">
                          to {g.end_date ? formatDate(g.end_date) : 'no end date'}
                        </span>
                      </Td>
                      <Td className="text-console-body">
                        {g.appointed_by_detail?.display_name ?? (
                          <span className="text-console-muted">Set up by the system</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={g.is_active ? 'success' : 'neutral'}>
                          {g.is_active ? 'Active' : 'Ended'}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {grants.count > PAGE_SIZE && (
                <Pager
                  page={grantPage}
                  pageSize={PAGE_SIZE}
                  count={grants.count}
                  shown={grants.items.length}
                  noun="grants"
                  onPage={setGrantPage}
                />
              )}
            </>
          )
        ) : registrations.isLoading ? (
          <TableSkeleton rows={6} />
        ) : registrations.error ? (
          <ErrorState message={registrations.error} onRetry={registrations.reload} />
        ) : registrations.items.length === 0 ? (
          <EmptyState
            title="No registration activity yet"
            message="Every confirmation, cancellation and check-in is recorded here as it happens."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>What happened</Th>
                  <Th>Ticket</Th>
                  <Th>Change</Th>
                  <Th>By</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody className={registrations.isFetching ? 'opacity-60' : ''}>
                {registrations.items.map((a) => (
                  <tr key={a.id} className="hover:bg-console-tinted">
                    <Td className="font-semibold text-console-text">
                      {ACTIONS[a.action] ?? plain(a.action)}
                    </Td>
                    <Td>
                      <span className="block leading-5 text-console-text">
                        {a.attendee_name || '—'}
                      </span>
                      <span className="block text-[12px] font-medium leading-4 tabular-nums text-console-muted">
                        {a.registration_code}
                      </span>
                    </Td>
                    <Td className="text-console-body">{changeOf(a)}</Td>
                    <Td className="text-console-body">
                      {a.user_name || <span className="text-console-muted">The system</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-console-body">
                      {formatDateTime(a.timestamp)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {registrations.count > PAGE_SIZE && (
              <Pager
                page={auditPage}
                pageSize={PAGE_SIZE}
                count={registrations.count}
                shown={registrations.items.length}
                noun="entries"
                onPage={setAuditPage}
              />
            )}
          </>
        )}
      </Card>
    </ScreenShell>
  );
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default AuditLog;
