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
 */
import { useState } from 'react';
import { ShieldCheck, Ticket } from 'lucide-react';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';
import type { ConsoleRoleAssignment } from '../../types/console';

interface RegistrationAudit {
  id: string;
  registration?: string;
  action?: string;
  action_display?: string;
  performed_by?: string;
  performed_by_name?: string;
  notes?: string;
  created_at?: string;
  timestamp?: string;
}

type Tab = 'authority' | 'registrations';

export const AuditLog = () => {
  const { can } = useConsoleAuth();
  const [tab, setTab] = useState<Tab>('authority');

  const grants = useConsoleList<ConsoleRoleAssignment>(
    '/identity/role-assignments/',
    {
      enabled: can('roles.view'),
      errorMessage: 'Could not load the authority history.',
    },
  );

  const registrations = useConsoleList<RegistrationAudit>(
    '/events/audit-logs/',
    {
      enabled: can('events.view'),
      errorMessage: 'Could not load the registration history.',
    },
  );

  return (
    <ScreenShell
      title="Audit log"
      subtitle="An append-only record. Nothing here can be edited or removed — revoking a role leaves the grant visible, ended."
      hideScope
    >
      <Tabs
        tabs={[
          { id: 'authority', label: 'Authority', count: grants.items.length },
          {
            id: 'registrations',
            label: 'Registrations',
            count: registrations.items.length,
          },
        ]}
        active={tab}
        onChange={setTab}
      />

      <Card>
        {tab === 'authority' ? (
          grants.isLoading ? (
            <TableSkeleton rows={6} />
          ) : grants.error ? (
            <ErrorState message={grants.error} onRetry={grants.reload} />
          ) : grants.items.length === 0 ? (
            <EmptyState
              title="No grants recorded"
              message="Role assignments appear here as they are made."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Person</Th>
                  <Th>Role</Th>
                  <Th>At</Th>
                  <Th>Period</Th>
                  <Th>By</Th>
                  <Th>State</Th>
                </tr>
              </thead>
              <tbody>
                {grants.items.map((g) => (
                  <tr key={g.id} className="hover:bg-console-tinted">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={g.user_detail?.display_name ?? '?'}
                          size={24}
                        />
                        <span className="text-console-text">
                          {g.user_detail?.display_name ??
                            g.user_detail?.username ??
                            '—'}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck
                          size={13}
                          className="shrink-0 text-console-subtle"
                        />
                        <span className="text-console-body">
                          {g.role_detail?.label ?? '—'}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-[12px] text-console-muted">
                      {g.node_detail?.name ?? '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-[12px] text-console-muted">
                      {formatDate(g.start_date)}
                      {g.end_date ? ` → ${formatDate(g.end_date)}` : ' → open'}
                    </Td>
                    <Td className="text-[12px] text-console-muted">
                      {g.appointed_by_detail?.display_name ?? (
                        <span className="text-console-subtle">Seeded</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={g.is_active ? 'success' : 'neutral'}>
                        {g.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        ) : registrations.isLoading ? (
          <TableSkeleton rows={6} />
        ) : registrations.error ? (
          <ErrorState
            message={registrations.error}
            onRetry={registrations.reload}
          />
        ) : registrations.items.length === 0 ? (
          <EmptyState
            title="No registration activity"
            message="Changes to event registrations are recorded here."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Action</Th>
                <Th>Registration</Th>
                <Th>By</Th>
                <Th>Notes</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {registrations.items.map((a) => (
                <tr key={a.id} className="hover:bg-console-tinted">
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Ticket size={13} className="shrink-0 text-console-subtle" />
                      <span className="text-console-text">
                        {a.action_display ?? a.action ?? '—'}
                      </span>
                    </div>
                  </Td>
                  <Td className="font-mono text-[11px] text-console-muted">
                    {a.registration ?? '—'}
                  </Td>
                  <Td className="text-[12px] text-console-muted">
                    {a.performed_by_name ?? a.performed_by ?? '—'}
                  </Td>
                  <Td className="max-w-[240px] truncate text-[12px] text-console-muted">
                    {a.notes || '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-[12px] text-console-muted">
                    {formatDate(a.created_at ?? a.timestamp)}
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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default AuditLog;
