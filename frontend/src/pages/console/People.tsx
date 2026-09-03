/**
 * People — who belongs where, and who holds what authority.
 *
 * The screen is built around the distinction the backend insists on:
 * **Membership is belonging, RoleAssignment is authority.** A teen has a
 * membership and no role; a Regional Coordinator has both, and they may point at
 * different nodes. Merging them into one "user row with a role column" — which
 * is what the legacy admin does — makes the difference invisible and the
 * transfer/revoke flows incoherent.
 *
 * Everything is scoped server-side: `scope_queryset` restricts both lists to
 * subtrees where the caller holds the relevant permission, so there is no
 * client-side filtering to bypass and no id to tamper with.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ShieldOff, UserCog } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Avatar,
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { PermissionGate } from '../../components/console/PermissionGate';
import AssignRoleModal from '../../components/console/AssignRoleModal';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import type {
  ConsoleMembership,
  ConsoleRoleAssignment,
} from '../../types/console';

type Tab = 'members' | 'roles';

/** DRF may or may not paginate depending on settings; accept both shapes. */
function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const results = (data as { results?: T[] } | null)?.results;
  return Array.isArray(results) ? results : [];
}

export const People = () => {
  const { can, scopeNode } = useConsoleAuth();
  const [tab, setTab] = useState<Tab>('members');
  const [memberships, setMemberships] = useState<ConsoleMembership[]>([]);
  const [assignments, setAssignments] = useState<ConsoleRoleAssignment[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [revoking, setRevoking] = useState<ConsoleRoleAssignment | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canSeeRoles = can('roles.view');
  const readOnly = can('memberships.view') && !can('memberships.manage');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Roles are only fetched when the caller may see them — requesting an
      // endpoint we know will 403 would put a red herring in their network log.
      const [membershipRes, assignmentRes] = await Promise.all([
        api.get('/identity/memberships/'),
        canSeeRoles
          ? api.get('/identity/role-assignments/')
          : Promise.resolve({ data: [] }),
      ]);
      setMemberships(unwrap<ConsoleMembership>(membershipRes.data));
      setAssignments(unwrap<ConsoleRoleAssignment>(assignmentRes.data));
    } catch {
      setError('Could not load people for this scope.');
    } finally {
      setIsLoading(false);
    }
  }, [canSeeRoles]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Revoke is a soft end, not a delete: `revoke_role` sets `is_active = False`
   * and stamps today's end date, so the grant stays in the audit log as
   * something that happened and then stopped. The confirm dialog says so,
   * because "revoke" otherwise reads as erasure.
   */
  const confirmRevoke = useCallback(async () => {
    if (!revoking) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/identity/role-assignments/${revoking.id}/`);
      setRevoking(null);
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setActionError(detail ?? 'Could not revoke that role.');
    } finally {
      setBusy(false);
    }
  }, [revoking, load]);

  /**
   * Authority held per person, so a member row can show their roles.
   * Keyed by user id because a person may hold several.
   */
  const rolesByUser = useMemo(() => {
    const map = new Map<string, ConsoleRoleAssignment[]>();
    for (const a of assignments) {
      if (!a.is_active) continue;
      const list = map.get(a.user) ?? [];
      list.push(a);
      map.set(a.user, list);
    }
    return map;
  }, [assignments]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memberships;
    return memberships.filter((m) => {
      const d = m.user_detail;
      return (
        d?.display_name?.toLowerCase().includes(q) ||
        d?.username?.toLowerCase().includes(q) ||
        d?.email?.toLowerCase().includes(q) ||
        m.organization_node_detail?.name?.toLowerCase().includes(q)
      );
    });
  }, [memberships, query]);

  const filteredAssignments = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = assignments.filter((a) => a.is_active);
    if (!q) return active;
    return active.filter(
      (a) =>
        a.user_detail?.display_name?.toLowerCase().includes(q) ||
        a.role_detail?.label?.toLowerCase().includes(q) ||
        a.node_detail?.name?.toLowerCase().includes(q),
    );
  }, [assignments, query]);

  const tabs = useMemo(() => {
    // Annotated rather than inferred: without this TS narrows the array to the
    // type of its first element and the Roles tab cannot be pushed.
    const base: { id: Tab; label: string; count: number }[] = [
      { id: 'members', label: 'Members', count: memberships.length },
    ];
    // The Roles tab is absent, not empty, for someone without roles.view.
    if (canSeeRoles) {
      base.push({
        id: 'roles',
        label: 'Roles',
        count: assignments.filter((a) => a.is_active).length,
      });
    }
    return base;
  }, [memberships.length, assignments, canSeeRoles]);

  return (
    <ScreenShell
      title="People"
      subtitle="Who belongs where, and who holds authority over them."
      readOnly={readOnly}
      actions={
        <>
          <div className="flex items-center gap-2 rounded-console-md border border-console-border bg-console-surface px-2.5 py-1.5">
            <Search size={14} className="shrink-0 text-console-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, node…"
              className="w-52 bg-transparent text-[13px] text-console-text outline-none placeholder:text-console-subtle"
            />
          </div>

          {/*
            Absent, not disabled. Someone without roles.assign has no Assign
            button at all — and per the subset rule, holding roles.assign is
            necessary but not sufficient: which roles appear inside the flow is
            computed from what the granter already holds.
          */}
          <PermissionGate permission="roles.assign">
            <Btn
              variant="primary"
              size="sm"
              onClick={() => setAssigning(true)}
            >
              <UserCog size={14} /> Assign a role
            </Btn>
          </PermissionGate>
        </>
      }
    >
      {actionError && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {actionError}
        </div>
      )}

      {assigning && (
        <AssignRoleModal
          onClose={() => setAssigning(false)}
          onAssigned={load}
        />
      )}

      {revoking && (
        <Modal
          title="End this role?"
          onClose={() => setRevoking(null)}
          width={460}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setRevoking(null)}>
                Keep it
              </Btn>
              <Btn variant="primary" disabled={busy} onClick={confirmRevoke}>
                {busy ? 'Ending…' : 'End the role'}
              </Btn>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-console-body">
            <strong>{revoking.user_detail?.display_name}</strong> will stop being{' '}
            {revoking.role_detail?.label} at {revoking.node_detail?.name}, and
            loses the {revoking.role_detail?.permissions?.length ?? 0} permissions
            that role carries there.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-console-muted">
            Nothing is deleted. The grant stays in the audit log with today as its
            end date, so the record of who held what, and when, stays intact.
          </p>
        </Modal>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : tab === 'members' ? (
          filteredMembers.length === 0 ? (
            <EmptyState
              title={query ? 'No matches' : 'Nobody here yet'}
              message={
                query
                  ? `Nothing matches “${query}” in ${scopeNode?.name ?? 'this scope'}.`
                  : `No active memberships in ${scopeNode?.name ?? 'this scope'}. People appear here once they are given a home node.`
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Home node</Th>
                  <Th>Authority</Th>
                  <Th>Since</Th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const held = rolesByUser.get(m.user) ?? [];
                  return (
                    <tr key={m.id} className="hover:bg-console-tinted">
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.user_detail?.display_name ?? '?'} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-console-text">
                              {m.user_detail?.display_name ??
                                m.user_detail?.username ??
                                'Unknown'}
                            </p>
                            <p className="truncate text-[11px] text-console-subtle">
                              {m.user_detail?.email}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <span className="text-console-body">
                            {m.organization_node_detail?.name ?? '—'}
                          </span>
                          {m.is_primary && (
                            <Badge tone="action" title="Their home node">
                              Primary
                            </Badge>
                          )}
                        </div>
                      </Td>
                      <Td>
                        {held.length === 0 ? (
                          // Not an error and not missing data — most members
                          // legitimately hold no authority at all.
                          <span className="text-[12px] text-console-subtle">
                            Member only
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {held.map((a) => (
                              <Badge key={a.id} tone="info">
                                {a.role_detail?.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-[12px] text-console-muted">
                        {formatDate(m.joined_at)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )
        ) : filteredAssignments.length === 0 ? (
          <EmptyState
            title="No roles granted here"
            message={`Nobody in ${scopeNode?.name ?? 'this scope'} currently holds a role. Authority is granted per node, so this is normal for a parish whose leaders are recorded higher up the tree.`}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Held at</Th>
                <Th>Granted</Th>
                <Th>Appointed by</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((a) => (
                <tr key={a.id} className="hover:bg-console-tinted">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={a.user_detail?.display_name ?? '?'} />
                      <span className="font-medium text-console-text">
                        {a.user_detail?.display_name ?? a.user_detail?.username}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-console-body">
                        {a.role_detail?.label}
                      </span>
                      <span
                        className="text-[11px] tabular-nums text-console-subtle"
                        title="Permissions this role carries"
                      >
                        {a.role_detail?.permissions?.length ?? 0}/21
                      </span>
                    </div>
                  </Td>
                  <Td className="text-console-body">{a.node_detail?.name ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-[12px] text-console-muted">
                    {formatDate(a.start_date)}
                    {a.end_date && (
                      <span className="text-console-subtle">
                        {' '}
                        → {formatDate(a.end_date)}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[12px] text-console-muted">
                    {a.appointed_by_detail?.display_name ?? (
                      // Assignments made by derive_hierarchy or grant_role have
                      // no appointer. Saying so beats an empty cell.
                      <span className="text-console-subtle">Seeded</span>
                    )}
                  </Td>
                  <Td>
                    <PermissionGate permission="roles.assign">
                      <Btn
                        variant="danger"
                        size="sm"
                        title="End this role"
                        onClick={() => setRevoking(a)}
                      >
                        <ShieldOff size={13} />
                      </Btn>
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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  // Africa/Lagos is the product's reference timezone; the Console shows local
  // dates rather than UTC so "today" means the same thing as it does in church.
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default People;
