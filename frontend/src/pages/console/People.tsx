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
 * Everything is scoped, searched and paged on the server. `scope_queryset`
 * restricts both lists to subtrees where the caller holds the relevant
 * permission, `?node=` narrows them to the scope switcher's node, and the
 * totals are the backend's `count`. Nothing is filtered in the browser, because
 * the browser only ever holds one page.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Check, Pencil, Plus, Search, X } from 'lucide-react';
import api from '../../api/axios';
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
  PaymentPill,
  RegistrationPill,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { PermissionGate } from '../../components/console/PermissionGate';
import AssignRoleModal from '../../components/console/AssignRoleModal';
import EditMemberModal from '../../components/console/EditMemberModal';
import MoveMemberModal from '../../components/console/MoveMemberModal';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList, useConsolePage } from '../../hooks/useConsoleList';
import { NODE_TYPE_LABELS } from '../../types/console';
import type {
  ConsoleMembership,
  ConsoleRoleAssignment,
} from '../../types/console';

type Tab = 'members' | 'roles';

/** `EventRegistrationListSerializer`, the fields the member panel shows. */
interface PersonRegistration {
  id: string;
  registration_id: string;
  event_title: string;
  status: string;
  payment_status: string;
  created_at: string;
  bed?: { code: string } | null;
}

const PAGE_SIZE = 20;

/** The value, once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

const nameOf = (person: ConsoleMembership['user_detail']) =>
  person?.display_name || person?.username || 'Unknown';

const ActivePill = ({ active }: { active: boolean }) =>
  active ? (
    <span className="inline-flex h-[26px] items-center gap-1 rounded-full bg-pop-lime pl-1.5 pr-2.5 text-[12px] font-semibold leading-4 text-pop-on">
      <Check size={14} strokeWidth={2.5} /> Active
    </span>
  ) : (
    <Badge title="This account has been deactivated">Deactivated</Badge>
  );

const RolePill = ({ grant }: { grant: ConsoleRoleAssignment }) => (
  <Badge tone="action">
    {grant.role_detail?.label ?? 'Role'}
    {grant.node_detail ? ` @ ${grant.node_detail.name}` : ''}
  </Badge>
);

const Pager = ({
  page,
  count,
  shown,
  noun,
  where,
  onPage,
}: {
  page: number;
  count: number;
  shown: number;
  noun: string;
  where: string;
  onPage: (page: number) => void;
}) => {
  const first = (page - 1) * PAGE_SIZE + 1;
  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-2 border-t border-console-border px-5 py-1.5">
      <p className="min-w-0 flex-1 text-[14px] leading-5 text-console-muted">
        Showing {first.toLocaleString()}–{(first + shown - 1).toLocaleString()} of{' '}
        {count.toLocaleString()} {noun} in {where}
      </p>
      <Btn variant="soft" size="md" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Btn>
      <Btn
        variant="soft"
        size="md"
        disabled={page * PAGE_SIZE >= count}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Btn>
    </div>
  );
};

const PeopleScreen = () => {
  const { can, scopeNode } = useConsoleAuth();
  const [tab, setTab] = useState<Tab>('members');
  const [query, setQuery] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [rolePage, setRolePage] = useState(1);
  const [selected, setSelected] = useState<ConsoleMembership | null>(null);
  const [assigning, setAssigning] = useState<ConsoleMembership | 'anyone' | null>(null);
  const [revoking, setRevoking] = useState<ConsoleRoleAssignment | null>(null);
  const [editing, setEditing] = useState<ConsoleMembership | null>(null);
  const [moving, setMoving] = useState<ConsoleMembership | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canSeeRoles = can('roles.view');
  const readOnly = can('memberships.view') && !can('memberships.manage');
  const where = scopeNode?.name ?? 'your scope';
  const search = useDebounced(query.trim(), 300);

  const scoped = { node: scopeNode?.id, search: search || undefined, is_active: 'true' };

  const members = useConsolePage<ConsoleMembership>('/identity/memberships/', {
    params: { ...scoped, page: memberPage, page_size: PAGE_SIZE },
    errorMessage: `We couldn't load the members of ${where}.`,
  });

  // Roles are only fetched when the caller may see them — requesting an
  // endpoint we know will 403 would put a red herring in their network log.
  const grants = useConsolePage<ConsoleRoleAssignment>('/identity/role-assignments/', {
    enabled: canSeeRoles,
    params: { ...scoped, page: rolePage, page_size: PAGE_SIZE },
    errorMessage: `We couldn't load the roles held in ${where}.`,
  });

  // The roles held by the people on this page of members, asked for by name.
  // Joining against the first page of *all* grants would show most leaders as
  // holding nothing.
  const pageUsers = useMemo(
    () => members.items.map((m) => m.user).sort().join(','),
    [members.items],
  );
  const held = useConsoleList<ConsoleRoleAssignment>('/identity/role-assignments/', {
    enabled: canSeeRoles && pageUsers.length > 0,
    params: { users: pageUsers, is_active: 'true', page_size: 200 },
  });

  const rolesByUser = useMemo(() => {
    const map = new Map<string, ConsoleRoleAssignment[]>();
    for (const grant of held.items) {
      map.set(grant.user, [...(map.get(grant.user) ?? []), grant]);
    }
    return map;
  }, [held.items]);

  const reloadAll = useCallback(() => {
    members.reload();
    grants.reload();
    held.reload();
  }, [members, grants, held]);

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
      reloadAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setRevoking(null);
      setActionError(detail ?? "We couldn't end that role. Try again.");
    } finally {
      setBusy(false);
    }
  }, [revoking, reloadAll]);

  const tabs = useMemo(() => {
    // Annotated rather than inferred: without this TS narrows the array to the
    // type of its first element and the Roles tab cannot be pushed.
    const base: { id: Tab; label: string; count?: number }[] = [
      { id: 'members', label: 'Members', count: members.isLoading ? undefined : members.count },
    ];
    // The Roles tab is absent, not empty, for someone without roles.view.
    if (canSeeRoles) {
      base.push({ id: 'roles', label: 'Roles', count: grants.isLoading ? undefined : grants.count });
    }
    return base;
  }, [members.isLoading, members.count, grants.isLoading, grants.count, canSeeRoles]);

  const selectedRoles = selected ? (rolesByUser.get(selected.user) ?? []) : [];

  // What the open member registered for. Only an event manager is sent other
  // people's registrations, so only they are asked.
  const registrations = useConsolePage<PersonRegistration>('/events/registrations/', {
    enabled: Boolean(selected) && can('events.manage'),
    params: { person: selected?.user, page_size: 5 },
  });

  return (
    <ScreenShell
      title="People"
      subtitle={
        members.isLoading || members.error
          ? 'Who belongs where, and who holds authority over them.'
          : `${members.count.toLocaleString()} ${members.count === 1 ? 'member' : 'members'}${
              search ? ` matching “${search}”` : ''
            } in ${where} and everything beneath it`
      }
      readOnly={readOnly}
      hideScope
      actions={
        /*
          Absent, not disabled. Someone without roles.assign has no Assign
          button at all — and per the subset rule, holding roles.assign is
          necessary but not sufficient: which roles appear inside the flow is
          computed from what the granter already holds.
        */
        <PermissionGate permission="roles.assign">
          <Btn variant="primary" size="md" onClick={() => setAssigning('anyone')}>
            <Plus size={16} /> Assign a role
          </Btn>
        </PermissionGate>
      }
    >
      {actionError && (
        <AlertBanner
          kind="error"
          className="mb-4"
          action={
            <Btn variant="soft" size="md" onClick={() => setActionError(null)}>
              Dismiss
            </Btn>
          }
        >
          {actionError}
        </AlertBanner>
      )}

      {saved && (
        <AlertBanner
          kind="success"
          className="mb-4"
          action={
            <Btn variant="soft" size="md" onClick={() => setSaved(null)}>
              Dismiss
            </Btn>
          }
        >
          {saved}
        </AlertBanner>
      )}

      {moving && (
        <MoveMemberModal
          membership={moving}
          name={nameOf(moving.user_detail)}
          onClose={() => setMoving(null)}
          onMoved={(message) => {
            setMoving(null);
            setSelected(null);
            setSaved(message);
            reloadAll();
          }}
        />
      )}

      {editing && (
        <EditMemberModal
          userId={editing.user}
          name={nameOf(editing.user_detail)}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            setSelected(null);
            setSaved(`${name}'s details are saved.`);
            reloadAll();
          }}
        />
      )}

      {assigning && (
        <AssignRoleModal
          onClose={() => setAssigning(null)}
          onAssigned={reloadAll}
          initialUserId={assigning === 'anyone' ? undefined : assigning.user}
          initialQuery={assigning === 'anyone' ? '' : nameOf(assigning.user_detail)}
        />
      )}

      {revoking && (
        <Modal
          title={`End ${nameOf(revoking.user_detail)}'s ${revoking.role_detail?.label ?? ''} role today?`}
          subtitle={`The grant at ${revoking.node_detail?.name ?? 'this node'} ends today, with the ${
            revoking.role_detail?.permissions?.length ?? 0
          } permissions it carries there. Nothing is deleted: the history stays on their record.`}
          onClose={() => setRevoking(null)}
          width={480}
          footer={
            <>
              <Btn size="md" onClick={() => setRevoking(null)}>
                Cancel
              </Btn>
              <Btn variant="danger" size="md" disabled={busy} onClick={confirmRevoke}>
                {busy ? 'Ending…' : 'End role today'}
              </Btn>
            </>
          }
        >
          {null}
        </Modal>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex-1 [&>div]:mb-0">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
        <label className="flex h-10 w-full items-center gap-2 rounded-full bg-console-tinted px-4 focus-within:outline focus-within:outline-2 focus-within:outline-console-text sm:w-72">
          <Search size={16} className="shrink-0 text-console-muted" />
          <span className="sr-only">Search people in {where}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMemberPage(1);
              setRolePage(1);
            }}
            placeholder="Search by name or email"
            className="w-full min-w-0 bg-transparent text-[14px] text-console-text outline-none placeholder:text-console-muted"
          />
        </label>
      </div>

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <Card className="w-full min-w-0 flex-1">
          {tab === 'members' ? (
            members.isLoading ? (
              <TableSkeleton rows={6} />
            ) : members.error ? (
              <ErrorState message={members.error} onRetry={members.reload} />
            ) : members.items.length === 0 ? (
              <EmptyState
                title={search ? `Nobody matches “${search}”` : `No members in ${where} yet`}
                message={
                  search
                    ? `No one in ${where} has that name or email. Check the spelling, or look in a wider scope.`
                    : 'People appear here once they join a parish in this part of the church.'
                }
                action={
                  search ? (
                    <Btn size="md" onClick={() => setQuery('')}>
                      Clear search
                    </Btn>
                  ) : undefined
                }
              />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Member</Th>
                      <Th>Home</Th>
                      {canSeeRoles && <Th>Roles</Th>}
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className={members.isFetching ? 'opacity-60' : ''}>
                    {members.items.map((m) => {
                      const roles = rolesByUser.get(m.user) ?? [];
                      const isSelected = selected?.id === m.id;
                      return (
                        <tr
                          key={m.id}
                          className={
                            isSelected ? 'bg-console-action-light' : 'hover:bg-console-tinted'
                          }
                        >
                          <Td>
                            <button
                              type="button"
                              onClick={() => setSelected(isSelected ? null : m)}
                              aria-pressed={isSelected}
                              className="flex w-full items-center gap-3 rounded-console-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text"
                            >
                              <Avatar name={nameOf(m.user_detail)} size={40} />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold leading-5 text-console-text">
                                  {nameOf(m.user_detail)}
                                </span>
                                <span className="block truncate text-[12px] font-medium leading-4 text-console-muted">
                                  {m.user_detail?.email}
                                </span>
                              </span>
                            </button>
                          </Td>
                          <Td className="text-console-text">
                            {m.organization_node_detail?.name ?? '—'}
                          </Td>
                          {canSeeRoles && (
                            <Td>
                              {held.isLoading ? (
                                <span className="text-console-muted">…</span>
                              ) : roles.length === 0 ? (
                                // Not an error and not missing data — most members
                                // legitimately hold no authority at all.
                                <span className="text-console-muted">Member only</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {roles.map((grant) => (
                                    <RolePill key={grant.id} grant={grant} />
                                  ))}
                                </div>
                              )}
                            </Td>
                          )}
                          <Td>
                            <ActivePill active={m.user_detail?.is_active ?? true} />
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <Pager
                  page={memberPage}
                  count={members.count}
                  shown={members.items.length}
                  noun={members.count === 1 ? 'member' : 'members'}
                  where={where}
                  onPage={setMemberPage}
                />
              </>
            )
          ) : grants.isLoading ? (
            <TableSkeleton rows={6} />
          ) : grants.error ? (
            <ErrorState message={grants.error} onRetry={grants.reload} />
          ) : grants.items.length === 0 ? (
            <EmptyState
              title={search ? `No role matches “${search}”` : `No roles held in ${where}`}
              message={
                search
                  ? 'Search covers the person, the role and the node it is held at.'
                  : 'Authority is granted per node, so this is normal for a parish whose leaders are recorded higher up the tree.'
              }
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Person</Th>
                    <Th>Role</Th>
                    <Th>Since</Th>
                    <Th>Granted by</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className={grants.isFetching ? 'opacity-60' : ''}>
                  {grants.items.map((a) => (
                    <tr key={a.id} className="hover:bg-console-tinted">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={nameOf(a.user_detail)} size={40} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold leading-5 text-console-text">
                              {nameOf(a.user_detail)}
                            </span>
                            <span className="block truncate text-[12px] font-medium leading-4 text-console-muted">
                              {a.user_detail?.email}
                            </span>
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <RolePill grant={a} />
                      </Td>
                      <Td className="whitespace-nowrap text-console-text">
                        {formatDate(a.start_date)}
                        {a.end_date && (
                          <span className="text-console-muted"> to {formatDate(a.end_date)}</span>
                        )}
                      </Td>
                      <Td className="text-console-body">
                        {a.appointed_by_detail?.display_name ?? (
                          // Assignments made by derive_hierarchy or grant_role have
                          // no appointer. Saying so beats an empty cell.
                          <span className="text-console-muted">Set up by the system</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <PermissionGate permission="roles.assign">
                          <Btn variant="danger" onClick={() => setRevoking(a)}>
                            End role
                          </Btn>
                        </PermissionGate>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pager
                page={rolePage}
                count={grants.count}
                shown={grants.items.length}
                noun={grants.count === 1 ? 'role' : 'roles'}
                where={where}
                onPage={setRolePage}
              />
            </>
          )}
        </Card>

        {tab === 'members' && selected && (
          <Card className="flex w-full shrink-0 flex-col gap-4 p-5 xl:w-[330px]">
            <div className="flex items-center gap-3">
              <Avatar name={nameOf(selected.user_detail)} size={64} />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <h2 className="w-full truncate text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
                  {nameOf(selected.user_detail)}
                </h2>
                <ActivePill active={selected.user_detail?.is_active ?? true} />
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close member details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-console-tinted text-console-text transition-colors hover:bg-console-border"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted">
              Membership
            </p>
            <div className="flex flex-col gap-0.5 rounded-console-md bg-pop-lime px-3.5 py-3 text-pop-on">
              <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em]">
                Home{' '}
                {selected.organization_node_detail
                  ? NODE_TYPE_LABELS[selected.organization_node_detail.node_type]
                  : ''}
              </p>
              <p className="text-[14px] font-semibold leading-5">
                {selected.organization_node_detail?.name ?? '—'}
              </p>
              <p className="text-[12px] font-medium leading-4">
                Joined {formatDate(selected.joined_at)}
              </p>
            </div>

            {canSeeRoles && (
              <>
                <p className="text-[12px] font-medium leading-4 tracking-[0.06em] text-console-muted">
                  <span className="uppercase">Authority</span> (separate from membership)
                </p>
                {selectedRoles.length === 0 ? (
                  <p className="text-[14px] leading-5 text-console-body">
                    Holds no role. Most members don't.
                  </p>
                ) : (
                  selectedRoles.map((grant) => (
                    <div
                      key={grant.id}
                      className="flex flex-col items-start gap-1 rounded-console-md bg-console-tinted px-3.5 py-3"
                    >
                      <RolePill grant={grant} />
                      <p className="text-[14px] leading-5 text-console-text">
                        Since {formatDate(grant.start_date)} ·{' '}
                        {grant.end_date ? `ends ${formatDate(grant.end_date)}` : 'no end date'}
                      </p>
                      <p className="text-[12px] font-medium leading-4 text-console-muted">
                        {grant.appointed_by_detail
                          ? `Granted by ${grant.appointed_by_detail.display_name}`
                          : 'Set up by the system'}
                      </p>
                      <PermissionGate permission="roles.assign">
                        <Btn variant="danger" className="mt-1" onClick={() => setRevoking(grant)}>
                          End role
                        </Btn>
                      </PermissionGate>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Each is absent for someone who cannot do it. Editing an account
                needs users.manage; granting authority needs roles.assign. */}
            <div className="flex flex-wrap gap-2">
              <PermissionGate permission="roles.assign">
                <Btn variant="primary" size="md" onClick={() => setAssigning(selected)}>
                  <Plus size={16} /> Assign role
                </Btn>
              </PermissionGate>
              <PermissionGate permission="users.manage">
                <Btn size="md" onClick={() => setEditing(selected)}>
                  <Pencil size={16} /> Edit details
                </Btn>
              </PermissionGate>
              <PermissionGate permission="memberships.manage">
                <Btn size="md" onClick={() => setMoving(selected)}>
                  <ArrowRightLeft size={16} /> Move
                </Btn>
              </PermissionGate>
            </div>

            {can('events.manage') && (
              <>
                <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted">
                  Registered for
                </p>
                {registrations.isLoading ? (
                  <p className="text-[14px] leading-5 text-console-muted">Loading…</p>
                ) : registrations.error ? (
                  <p className="text-[14px] leading-5 text-console-body">
                    We couldn't load their registrations.
                  </p>
                ) : registrations.items.length === 0 ? (
                  <p className="text-[14px] leading-5 text-console-body">
                    Nothing yet.
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {registrations.items.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-col gap-1.5 border-t border-console-border py-2.5 first:border-t-0 first:pt-0"
                      >
                        <p className="text-[14px] font-semibold leading-5 text-console-text">
                          {r.event_title}
                        </p>
                        <p className="text-[12px] font-medium leading-4 tabular-nums text-console-muted">
                          {r.registration_id} · {formatDate(r.created_at)}
                          {r.bed ? ` · bed ${r.bed.code}` : ''}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <RegistrationPill status={r.status} />
                          {r.payment_status !== 'not_required' && (
                            <PaymentPill status={r.payment_status} />
                          )}
                        </div>
                      </li>
                    ))}
                    {registrations.count > registrations.items.length && (
                      <li className="border-t border-console-border pt-2.5 text-[14px] leading-5 text-console-body">
                        and {(registrations.count - registrations.items.length).toLocaleString()} more
                      </li>
                    )}
                  </ul>
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </ScreenShell>
  );
};

/**
 * Remounted when the scope changes, so the page number, the search and the
 * open member all start over rather than pointing into another node's list.
 */
export const People = () => {
  const { scopeNode } = useConsoleAuth();
  return <PeopleScreen key={scopeNode?.id ?? 'none'} />;
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
