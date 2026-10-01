/**
 * Assign a role.
 *
 * The screen where the escalation guard becomes visible. Three choices —
 * **who**, **where**, **what** — in that order, because the node determines
 * which roles are even legal (`allowed_node_types`) and the granter's own
 * authority determines which are permitted (the subset rule).
 *
 * Roles the granter may *never* grant are omitted entirely; roles they could
 * grant but not at the chosen node are shown greyed with the reason, because
 * that one is fixable by picking a different node.
 *
 * The server re-checks everything (`assign_role` → `can_assign`). If it refuses,
 * its sentence is shown verbatim rather than replaced with a generic failure —
 * it is the only message that explains *which* rule was hit.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import api from '../../api/axios';
import { Avatar, Badge, Btn, Modal } from './primitives';
import { grantableRoles, whoCanGrant } from './roleGrants';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useHierarchy } from '../../hooks/useHierarchy';
import { useConsoleList } from '../../hooks/useConsoleList';
import {
  NODE_TYPE_LABELS,
  type ConsoleMembership,
  type ConsoleRole,
} from '../../types/console';

interface Props {
  onClose: () => void;
  onAssigned: () => void;
  /** Pre-selected person, when opened from a member row. */
  initialUserId?: string;
}

export const AssignRoleModal = ({ onClose, onAssigned, initialUserId }: Props) => {
  const { permissions, me } = useConsoleAuth();
  const hierarchy = useHierarchy();

  const [userId, setUserId] = useState<string | undefined>(initialUserId);
  const [nodeId, setNodeId] = useState<string | undefined>();
  const [roleId, setRoleId] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [roleQuery, setRoleQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = useConsoleList<ConsoleMembership>('/identity/memberships/', {
    errorMessage: 'Could not load people.',
  });
  const roles = useConsoleList<ConsoleRole>('/identity/roles/', {
    errorMessage: 'Could not load roles.',
  });

  const selectableNodes = useMemo(
    () => hierarchy.nodes.filter((n) => n.selectable),
    [hierarchy.nodes],
  );

  // Default the node to the granter's own, the commonest case.
  useEffect(() => {
    if (!nodeId && selectableNodes.length) setNodeId(selectableNodes[0].id);
  }, [nodeId, selectableNodes]);

  const node = useMemo(
    () => hierarchy.byId.get(nodeId ?? ''),
    [hierarchy.byId, nodeId],
  );

  const offered = useMemo(
    () =>
      grantableRoles(roles.items, permissions, {
        granterIsSuperuser: me?.is_superuser,
        nodeType: node?.node_type,
      }),
    [roles.items, permissions, me, node],
  );

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = members.items.filter((m) => m.is_active);
    if (!q) return list.slice(0, 40);
    return list
      .filter(
        (m) =>
          m.user_detail?.display_name?.toLowerCase().includes(q) ||
          m.user_detail?.email?.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [members.items, query]);

  /**
   * A leader searching for a role they cannot grant gets one calm line naming
   * who can, rather than silence that reads as a missing feature.
   */
  const refusal = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return null;
    const shown = offered.some((o) =>
      o.role.label.toLowerCase().includes(q),
    );
    if (shown) return null;
    const hidden = roles.items.find((r) => r.label.toLowerCase().includes(q));
    return hidden ? whoCanGrant(hidden, roles.items) : null;
  }, [roleQuery, offered, roles.items]);

  const chosenRole = offered.find((o) => o.role.id === roleId);
  const ready = Boolean(userId && nodeId && roleId && chosenRole?.validHere);

  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/identity/role-assignments/', {
        user: userId,
        role: roleId,
        node: nodeId,
      });
      onAssigned();
      onClose();
    } catch (err: unknown) {
      const res = (err as {
        response?: { data?: Record<string, unknown> };
      })?.response?.data;
      // DRF surfaces ValidationError from assign_role as a list or a dict.
      const detail =
        (typeof res?.detail === 'string' && res.detail) ||
        (Array.isArray(res) && typeof res[0] === 'string' && res[0]) ||
        (res && Object.values(res).flat().find((v) => typeof v === 'string'));
      setError(
        (detail as string) ??
          'The grant was refused. You may only grant a role whose permissions you already hold here.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Assign a role"
      subtitle="Authority is granted at a node and flows down from it."
      onClose={onClose}
      width={620}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={!ready || saving} onClick={submit}>
            {saving ? 'Granting…' : 'Grant role'}
          </Btn>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {error}
        </div>
      )}

      {/* 1 — who */}
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
        1 · Who
      </p>
      <div className="mb-2 flex items-center gap-2 rounded-console-md border border-console-border px-2.5 py-1.5">
        <Search size={14} className="shrink-0 text-console-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-transparent text-[13px] text-console-text outline-none placeholder:text-console-subtle"
        />
      </div>
      <div className="console-scroll mb-4 max-h-40 overflow-y-auto rounded-console-md border border-console-border">
        {people.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-console-muted">
            Nobody matches.
          </p>
        ) : (
          people.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setUserId(m.user)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                userId === m.user
                  ? 'bg-console-action-light'
                  : 'hover:bg-console-tinted'
              }`}
            >
              <Avatar name={m.user_detail?.display_name ?? '?'} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-console-text">
                  {m.user_detail?.display_name ?? m.user_detail?.username}
                </span>
                <span className="block truncate text-[11px] text-console-subtle">
                  {m.organization_node_detail?.name}
                </span>
              </span>
              {userId === m.user && (
                <Check size={14} className="shrink-0 text-console-action" />
              )}
            </button>
          ))
        )}
      </div>

      {/* 2 — where */}
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
        2 · Where
      </p>
      <select
        value={nodeId ?? ''}
        onChange={(e) => {
          setNodeId(e.target.value);
          setRoleId(undefined); // node changes which roles are legal
        }}
        className="mb-4 w-full rounded-console-md border border-console-border bg-console-surface px-2.5 py-2 text-[13px] text-console-text outline-none focus:border-console-action"
      >
        {selectableNodes.map((n) => (
          <option key={n.id} value={n.id}>
            {'— '.repeat(Math.max(0, n.depth - 1))}
            {n.name} ({NODE_TYPE_LABELS[n.node_type]})
          </option>
        ))}
      </select>

      {/* 3 — what */}
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
        3 · What
      </p>
      <div className="mb-2 flex items-center gap-2 rounded-console-md border border-console-border px-2.5 py-1.5">
        <Search size={14} className="shrink-0 text-console-subtle" />
        <input
          value={roleQuery}
          onChange={(e) => setRoleQuery(e.target.value)}
          placeholder="Filter roles…"
          className="w-full bg-transparent text-[13px] text-console-text outline-none placeholder:text-console-subtle"
        />
      </div>

      {refusal && (
        <p className="mb-2 rounded-console-md bg-console-tinted px-3 py-2 text-[12px] text-console-muted">
          {refusal}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {offered
          .filter((o) =>
            o.role.label.toLowerCase().includes(roleQuery.trim().toLowerCase()),
          )
          .map(({ role, validHere, reason }) => (
            <button
              key={role.id}
              type="button"
              disabled={!validHere}
              onClick={() => setRoleId(role.id)}
              title={reason}
              className={[
                'rounded-console-md border p-2.5 text-left transition-colors',
                !validHere
                  ? 'cursor-not-allowed border-console-border opacity-50'
                  : roleId === role.id
                    ? 'border-console-action bg-console-action-light'
                    : 'border-console-border hover:bg-console-tinted',
              ].join(' ')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-console-text">
                  {role.label}
                </span>
                <Badge tone="neutral">{role.permissions?.length ?? 0}/21</Badge>
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-console-subtle">
                {reason ?? role.description ?? ' '}
              </span>
            </button>
          ))}
      </div>

      {offered.length === 0 && !roles.isLoading && (
        <p className="rounded-console-md bg-console-tinted px-3 py-3 text-[12px] text-console-muted">
          There is no role you can grant. You may only grant a role whose
          permissions you already hold at the chosen node.
        </p>
      )}
    </Modal>
  );
};

export default AssignRoleModal;
