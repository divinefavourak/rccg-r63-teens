/**
 * Hierarchy — the church tree, from where you sit downward.
 *
 * Two designs in one screen, chosen by permission:
 *
 * * **Explorer** (`hierarchy.view`) — navigate, search, and open any node to
 *   see what is in it: how much church sits beneath it, its members, the
 *   people who lead there, and its events.
 * * **Editor** (`hierarchy.manage`) — the explorer plus renaming, re-coding,
 *   deactivating and adding beneath a node. The server decides node by node:
 *   holding the permission somewhere is not holding it everywhere, and a
 *   refusal is shown as the server words it.
 *
 * Each part of a node's details is fetched only by someone who may see it, and
 * each asks the server to narrow to that node (`?node=`), which means "this
 * node and everything beneath it" on every endpoint used here.
 *
 * Ancestors above the caller's ceiling arrive from the API marked
 * `selectable: false`. They are drawn muted and inert so an operator can see
 * where they sit without being able to climb.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Crosshair, Pencil, Plus, X } from 'lucide-react';
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
  SearchField,
  Skeleton,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsolePage } from '../../hooks/useConsoleList';
import { useHierarchy, type TreeNode } from '../../hooks/useHierarchy';
import {
  NODE_TYPE_LABELS,
  NODE_TYPE_ORDER,
  type ConsoleMembership,
  type ConsoleRoleAssignment,
  type NodeType,
} from '../../types/console';
import { parseAPIDate } from '../../utils/dates';

const LEVEL_BADGE: Record<NodeType, string> = {
  national: 'var(--level-national-badge)',
  region: 'var(--level-region-badge)',
  province: 'var(--level-province-badge)',
  zone: 'var(--level-zone-badge)',
  area: 'var(--level-area-badge)',
  parish: 'var(--level-parish-badge)',
  department: 'var(--level-dept-badge)',
};

const PLURALS: Record<NodeType, string> = {
  national: 'nations',
  region: 'regions',
  province: 'provinces',
  zone: 'zones',
  area: 'areas',
  parish: 'parishes',
  department: 'departments',
};

const LABEL =
  'block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted';
const INPUT =
  'mt-1 w-full rounded-console-md border-2 border-transparent bg-console-tinted px-3.5 py-2.5 text-[16px] leading-6 text-console-text outline-none transition-colors placeholder:text-console-muted focus:border-console-text';

interface EventRow {
  id: string;
  title: string;
  start_datetime?: string;
  registration_count: number;
  max_attendees: number | null;
  scope_node_detail: { id: string; name: string } | null;
}

/** The level pill of the Console kit: the level's colour, ink text. */
const LevelPill = ({ type, muted = false }: { type: NodeType; muted?: boolean }) => (
  <span
    className={`inline-flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold leading-4 ${
      muted || type === 'national' ? 'text-console-muted' : 'text-pop-on'
    }`}
    style={{ background: muted ? 'var(--console-surface-tinted)' : LEVEL_BADGE[type] }}
  >
    {NODE_TYPE_LABELS[type]}
  </span>
);

/**
 * The single node type permitted directly beneath `parent`.
 *
 * Mirrors `hierarchy.child_type_of`. Returns null for Department, which is the
 * bottom of the tree and cannot have children.
 */
function childLevelOf(parent: NodeType): NodeType | null {
  const i = NODE_TYPE_ORDER.indexOf(parent);
  return i >= 0 && i + 1 < NODE_TYPE_ORDER.length ? NODE_TYPE_ORDER[i + 1] : null;
}

/**
 * Add a child, or rename/deactivate an existing node.
 *
 * The child's node type is shown as a fixed label, never a dropdown: the level
 * rule makes exactly one type legal, so offering a choice would only let someone
 * propose a tree the server must reject.
 */
const NodeEditor = ({
  mode,
  node,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  node: TreeNode;
  onClose: () => void;
  onSaved: (message: string) => void;
}) => {
  const childType = childLevelOf(node.node_type);
  const [name, setName] = useState(mode === 'edit' ? node.name : '');
  const [code, setCode] = useState(mode === 'edit' ? (node.code ?? '') : '');
  const [active, setActive] = useState(node.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'add') {
        await api.post('/hierarchy/nodes/', {
          parent: node.id,
          name: name.trim(),
          code: code.trim(),
        });
        onSaved(`${name.trim()} is added under ${node.name}.`);
      } else {
        await api.patch(`/hierarchy/nodes/${node.id}/`, {
          name: name.trim(),
          code: code.trim(),
          is_active: active,
        });
        onSaved(`${name.trim()} is saved.`);
      }
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const detail =
        (typeof data?.detail === 'string' && data.detail) ||
        (data && Object.values(data).flat().find((v) => typeof v === 'string'));
      setError(
        (detail as string) ?? "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        mode === 'add' && childType
          ? `Add a ${NODE_TYPE_LABELS[childType]} under ${node.name}`
          : `Edit ${node.name}`
      }
      subtitle={
        mode === 'add'
          ? "A node's type is always one level below its parent's, so it is not a choice."
          : `${NODE_TYPE_LABELS[node.node_type]}. Its place in the tree is not changed here.`
      }
      onClose={onClose}
      width={480}
      footer={
        <>
          <Btn size="md" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" size="md" disabled={busy || !name.trim()} onClick={save}>
            {busy ? 'Saving…' : mode === 'add' ? 'Add' : 'Save changes'}
          </Btn>
        </>
      }
    >
      {error && (
        <AlertBanner kind="error" className="mb-3">
          {error}
        </AlertBanner>
      )}

      <label className="block">
        <span className={LABEL}>Name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </label>

      <label className="mt-3 block">
        <span className={LABEL}>Church code (optional)</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Used to match rows in a CSV"
          className={INPUT}
        />
      </label>

      {mode === 'edit' && (
        <label className="mt-3 flex items-start gap-2.5 rounded-console-md bg-console-tinted px-3.5 py-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>
            <span className="block text-[14px] font-semibold leading-5 text-console-text">
              Active
            </span>
            <span className="block text-[12px] font-medium leading-4 text-console-muted">
              A node is deactivated, never deleted: memberships and roles point at
              it, so removing it would erase the record of who belonged where.
            </span>
          </span>
        </label>
      )}
    </Modal>
  );
};

const Section = ({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <h3 className={LABEL}>{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

const QUIET = 'text-[14px] leading-5 text-console-body';
const LINK =
  'text-[14px] font-semibold leading-5 text-console-text underline underline-offset-2 hover:no-underline';

/** Everything about one node that the caller is allowed to see. */
const NodeDetails = ({
  node,
  path,
  counts,
  onClose,
  onEdit,
  onAdd,
}: {
  node: TreeNode;
  path: string;
  counts: Partial<Record<NodeType, number>>;
  onClose: () => void;
  onEdit: () => void;
  onAdd: () => void;
}) => {
  const { can, scopeNode, setScopeNode } = useConsoleAuth();
  const canManage = can('hierarchy.manage');
  const childType = childLevelOf(node.node_type);
  const isScope = scopeNode?.id === node.id;

  const members = useConsolePage<ConsoleMembership>('/identity/memberships/', {
    enabled: can('memberships.view'),
    params: { node: node.id, is_active: 'true', page_size: 1 },
  });
  const leaders = useConsolePage<ConsoleRoleAssignment>('/identity/role-assignments/', {
    enabled: can('roles.view'),
    params: { node: node.id, is_active: 'true', page_size: 6 },
  });
  const events = useConsolePage<EventRow>('/events/events/', {
    enabled: can('events.view'),
    params: { node: node.id, ordering: '-start_datetime', page_size: 5 },
  });

  const beneath = NODE_TYPE_ORDER.filter((type) => counts[type]).map(
    (type) => `${counts[type]} ${counts[type] === 1 ? NODE_TYPE_LABELS[type].toLowerCase() : PLURALS[type]}`,
  );

  const scopeHere = () =>
    setScopeNode({ id: node.id, name: node.name, node_type: node.node_type });

  return (
    <Card className="flex w-full shrink-0 flex-col gap-5 p-5 xl:w-[400px]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <LevelPill type={node.node_type} />
            {!node.is_active && <Badge>Inactive</Badge>}
            {isScope && <Badge tone="action">Current scope</Badge>}
          </div>
          <h2 className="mt-2 text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
            {node.name}
          </h2>
          <p className="text-[12px] font-medium leading-4 text-console-muted">
            {path}
            {node.code ? ` · code ${node.code}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-console-tinted text-console-text transition-colors hover:bg-console-border"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Absent for someone who cannot change the tree. Where the server
            says no for this particular node, the editor shows its reason. */}
        {canManage && (
          <Btn variant="primary" size="md" onClick={onEdit}>
            <Pencil size={16} /> Edit
          </Btn>
        )}
        {canManage && childType && (
          <Btn size="md" onClick={onAdd}>
            <Plus size={16} /> Add {NODE_TYPE_LABELS[childType]}
          </Btn>
        )}
        {!isScope && (
          <Btn variant="soft" size="md" onClick={scopeHere}>
            <Crosshair size={16} /> Look here
          </Btn>
        )}
      </div>

      <Section title="Beneath it">
        <p className={QUIET}>
          {beneath.length ? beneath.join(' · ') : 'Nothing sits beneath this yet.'}
        </p>
      </Section>

      {can('memberships.view') && (
        <Section
          title="Members"
          aside={
            <Link to="/admin/people" onClick={scopeHere} className={LINK}>
              Open in People
            </Link>
          }
        >
          {members.isLoading ? (
            <Skeleton className="h-5 w-40" />
          ) : members.error ? (
            <p className={QUIET}>We couldn't count the members here.</p>
          ) : (
            <p className={QUIET}>
              <span className="text-[20px] font-bold tabular-nums text-console-text">
                {members.count.toLocaleString()}
              </span>{' '}
              with an active membership here or beneath
            </p>
          )}
        </Section>
      )}

      {can('roles.view') && (
        <Section title="Who leads here and beneath">
          {leaders.isLoading ? (
            <Skeleton className="h-9 w-full rounded-console-md" />
          ) : leaders.error ? (
            <p className={QUIET}>We couldn't load the roles held here.</p>
          ) : leaders.items.length === 0 ? (
            <p className={QUIET}>Nobody holds a role here yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {leaders.items.map((grant) => (
                <li key={grant.id} className="flex items-center gap-2.5">
                  <Avatar name={grant.user_detail?.display_name ?? '?'} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold leading-5 text-console-text">
                      {grant.user_detail?.display_name ?? grant.user_detail?.username}
                    </span>
                    <span className="block truncate text-[12px] font-medium leading-4 text-console-muted">
                      {grant.role_detail?.label}
                      {grant.node_detail && grant.node_detail.id !== node.id
                        ? ` at ${grant.node_detail.name}`
                        : ''}
                    </span>
                  </span>
                </li>
              ))}
              {leaders.count > leaders.items.length && (
                <li className={QUIET}>
                  and {(leaders.count - leaders.items.length).toLocaleString()} more, under People → Roles
                </li>
              )}
            </ul>
          )}
        </Section>
      )}

      {can('events.view') && (
        <Section
          title="Events"
          aside={
            <Link to="/admin/events" className={LINK}>
              All events
            </Link>
          }
        >
          {events.isLoading ? (
            <Skeleton className="h-9 w-full rounded-console-md" />
          ) : events.error ? (
            <p className={QUIET}>We couldn't load the events here.</p>
          ) : events.items.length === 0 ? (
            <p className={QUIET}>No event is owned by {node.name} or anything beneath it.</p>
          ) : (
            <ul className="flex flex-col">
              {events.items.map((event) => {
                const day = parseAPIDate(event.start_datetime)?.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <li
                    key={event.id}
                    className="border-t border-console-border py-2 first:border-t-0 first:pt-0"
                  >
                    <p className="text-[14px] font-semibold leading-5 text-console-text">
                      {event.title}
                    </p>
                    <p className="text-[12px] font-medium leading-4 text-console-muted">
                      {day ?? 'No date'} · {event.registration_count.toLocaleString()}
                      {event.max_attendees ? ` of ${event.max_attendees.toLocaleString()}` : ''} registered
                      {event.scope_node_detail && event.scope_node_detail.id !== node.id
                        ? ` · ${event.scope_node_detail.name}`
                        : ''}
                    </p>
                  </li>
                );
              })}
              {events.count > events.items.length && (
                <li className={`${QUIET} border-t border-console-border pt-2`}>
                  and {(events.count - events.items.length).toLocaleString()} more
                </li>
              )}
            </ul>
          )}
        </Section>
      )}
    </Card>
  );
};

export const Hierarchy = () => {
  const { can, scopeNode } = useConsoleAuth();
  const { roots, nodes, subtreeCounts, isLoading, error, reload } = useHierarchy();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const canManage = can('hierarchy.manage');
  const readOnly = can('hierarchy.view') && !canManage;
  const [editing, setEditing] = useState<{ mode: 'add' | 'edit'; node: TreeNode } | null>(null);

  // Read from the live list each time, so the panel shows a rename at once.
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  // Search matches keep their ancestors so results read as a tree, not a list
  // of orphaned names with no context about where they sit.
  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const keep = new Set<string>();
    for (const n of nodes) {
      if (!n.name.toLowerCase().includes(q)) continue;
      keep.add(n.id);
      for (const other of nodes) {
        if (n.path.startsWith(other.path) && other.id !== n.id) keep.add(other.id);
      }
    }
    return keep;
  }, [nodes, query]);

  const pathOf = (node: TreeNode) =>
    nodes
      .filter((other) => node.path.startsWith(other.path))
      .sort((a, b) => a.path.length - b.path.length)
      .map((other) => other.name)
      .join(' → ');

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: TreeNode, depth: number) => {
    if (visibleIds && !visibleIds.has(node.id)) return null;

    const counts = subtreeCounts(node.id);
    const childCount = node.children.length;
    // While searching, everything on a matching path is open — collapsing a
    // result behind a chevron would hide the thing that was searched for.
    const isOpen = visibleIds ? true : expanded.has(node.id);
    const isSelected = node.id === selectedId;
    const beneath = counts.parish ?? childCount;

    return (
      <div key={node.id}>
        <div
          className={[
            'flex h-11 items-center gap-2 rounded-full pr-3.5 transition-colors',
            isSelected
              ? 'bg-console-action text-console-on-action'
              : 'text-console-text hover:bg-console-tinted',
          ].join(' ')}
          style={{ paddingLeft: 8 + depth * 22 }}
        >
          <button
            type="button"
            onClick={() => childCount && toggle(node.id)}
            aria-label={childCount ? `${isOpen ? 'Collapse' : 'Expand'} ${node.name}` : undefined}
            aria-expanded={childCount ? isOpen : undefined}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              childCount ? 'hover:bg-black/10' : 'invisible'
            }`}
          >
            <ChevronRight size={16} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </button>

          {/* Above the ceiling: shown for context, never opened. */}
          <button
            type="button"
            disabled={!node.selectable}
            onClick={() => setSelectedId(isSelected ? null : node.id)}
            aria-pressed={isSelected}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text disabled:cursor-default"
          >
            <LevelPill type={node.node_type} muted={!node.selectable} />
            <span
              className={`min-w-0 flex-1 truncate text-[14px] font-semibold leading-5 ${
                node.selectable ? '' : 'text-console-muted'
              }`}
            >
              {node.name}
              {!node.is_active && <span className="ml-1.5 font-medium opacity-70">inactive</span>}
              {node.id === scopeNode?.id && (
                <span className="ml-1.5 font-medium opacity-70">current scope</span>
              )}
            </span>
            {beneath > 0 && (
              <span
                className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums opacity-80"
                title={counts.parish ? 'Parishes beneath this' : 'Directly beneath this'}
              >
                {beneath.toLocaleString()}
              </span>
            )}
          </button>
        </div>

        {isOpen && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <ScreenShell
      title="Hierarchy"
      subtitle="Seven levels: National, Region, Province, Zone, Area, Parish, Department. Choose any part of the church to see what is in it."
      readOnly={readOnly}
      hideScope
      actions={
        <SearchField
          value={query}
          onChange={setQuery}
          label="Find a part of the church"
          placeholder="Find a province, zone or parish"
        />
      }
    >
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

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 p-3">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : roots.length === 0 ? (
            <EmptyState
              art="sitting"
              title="There is no tree for you to browse"
              message="Seeing the church tree is part of a coordinating role. This is normal for a Teacher."
            />
          ) : visibleIds && visibleIds.size === 0 ? (
            <EmptyState
              title={`Nothing is called “${query.trim()}”`}
              message="Search looks at names in the part of the church you can see."
              action={
                <Btn size="md" onClick={() => setQuery('')}>
                  Clear search
                </Btn>
              }
            />
          ) : (
            roots.map((r) => renderNode(r, 0))
          )}
        </Card>

        {selected ? (
          <NodeDetails
            key={selected.id}
            node={selected}
            path={pathOf(selected)}
            counts={subtreeCounts(selected.id)}
            onClose={() => setSelectedId(null)}
            onEdit={() => setEditing({ mode: 'edit', node: selected })}
            onAdd={() => setEditing({ mode: 'add', node: selected })}
          />
        ) : (
          roots.length > 0 &&
          !isLoading && (
            <Card className="w-full shrink-0 p-5 xl:w-[400px]">
              <p className="text-[17px] font-bold leading-6 text-console-text">
                Choose a part of the church
              </p>
              <p className="mt-1 text-[14px] leading-5 text-console-body">
                Its members, the people who lead there and its events appear here
                {canManage ? ', with the controls to edit it or add beneath it.' : '.'}
              </p>
            </Card>
          )
        )}
      </div>

      {editing && (
        <NodeEditor
          mode={editing.mode}
          node={editing.node}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setSaved(message);
            reload();
          }}
        />
      )}
    </ScreenShell>
  );
};

export default Hierarchy;
