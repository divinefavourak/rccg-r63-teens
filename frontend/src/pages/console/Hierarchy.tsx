/**
 * Hierarchy — the church tree, from where you sit downward.
 *
 * Two designs in one screen, chosen by permission:
 *
 * * **Explorer** (`hierarchy.view`) — navigate, search, see counts, scope to a
 *   node. Five of the six seeded roles land here.
 * * **Editor** (`hierarchy.manage`) — the explorer plus structural edits. Two
 *   roles. The write endpoints do not exist yet, so those controls are not
 *   rendered: a button that cannot work is worse than its absence.
 *
 * Ancestors above the caller's ceiling arrive from the API marked
 * `selectable: false`. They are drawn greyed and inert so an operator can see
 * where they sit without being able to climb.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, Crosshair, Pencil, Plus, Search } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useHierarchy, type TreeNode } from '../../hooks/useHierarchy';
import {
  NODE_TYPE_LABELS,
  NODE_TYPE_ORDER,
  type NodeType,
} from '../../types/console';

const LEVEL_DOT: Record<NodeType, string> = {
  national: 'var(--level-national-dot)',
  region: 'var(--level-region-dot)',
  province: 'var(--level-province-dot)',
  zone: 'var(--level-zone-dot)',
  area: 'var(--level-area-dot)',
  parish: 'var(--level-parish-dot)',
  department: 'var(--level-dept-dot)',
};

/**
 * The single node type permitted directly beneath `parent`.
 *
 * Mirrors `hierarchy.child_type_of`. Returns null for Department, which is the
 * bottom of the tree and cannot have children.
 */
function childLevelOf(parent: NodeType): NodeType | null {
  const i = NODE_TYPE_ORDER.indexOf(parent);
  return i >= 0 && i + 1 < NODE_TYPE_ORDER.length
    ? NODE_TYPE_ORDER[i + 1]
    : null;
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
  onSaved: () => void;
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
      } else {
        await api.patch(`/hierarchy/nodes/${node.id}/`, {
          name: name.trim(),
          code: code.trim(),
          is_active: active,
        });
      }
      onSaved();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })
        ?.response?.data;
      const detail =
        (typeof data?.detail === 'string' && data.detail) ||
        (data && Object.values(data).flat().find((v) => typeof v === 'string'));
      setError((detail as string) ?? 'That change was refused.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={mode === 'add' ? `Add under ${node.name}` : `Edit ${node.name}`}
      subtitle={
        mode === 'add' && childType
          ? `This will create a ${NODE_TYPE_LABELS[childType]}. A node's type is always exactly one level below its parent's, so it is not a choice.`
          : undefined
      }
      onClose={onClose}
      width={480}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={busy || !name.trim()} onClick={save}>
            {busy ? 'Saving…' : mode === 'add' ? 'Add node' : 'Save'}
          </Btn>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {error}
        </div>
      )}

      <label className="block text-[11px] font-medium text-console-body">
        Name
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-console-md border border-console-border bg-console-surface px-2.5 py-2 text-[13px] text-console-text outline-none focus:border-console-action"
      />

      <label className="mt-3 block text-[11px] font-medium text-console-body">
        Church code <span className="text-console-subtle">(optional)</span>
      </label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Used to match rows during CSV reconciliation"
        className="mt-1 w-full rounded-console-md border border-console-border bg-console-surface px-2.5 py-2 text-[13px] text-console-text outline-none placeholder:text-console-subtle focus:border-console-action"
      />

      {mode === 'edit' && (
        <>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-console-body">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
          <p className="mt-1 text-[11px] leading-relaxed text-console-subtle">
            Nodes are deactivated, never deleted — memberships and role
            assignments reference them, so removing one would erase the record of
            who belonged where.
          </p>
        </>
      )}
    </Modal>
  );
};

export const Hierarchy = () => {
  const { can, scopeNode, setScopeNode } = useConsoleAuth();
  const { roots, nodes, subtreeCounts, isLoading, error, reload } =
    useHierarchy();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const canManage = can('hierarchy.manage');
  const readOnly = can('hierarchy.view') && !canManage;
  const [editing, setEditing] = useState<{
    mode: 'add' | 'edit';
    node: TreeNode;
  } | null>(null);

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
    const isCurrent = node.id === scopeNode?.id;

    return (
      <div key={node.id}>
        <div
          className={[
            'group flex items-center gap-2 rounded-console-md py-1.5 pr-2 transition-colors',
            isCurrent ? 'bg-console-action-light' : 'hover:bg-console-tinted',
          ].join(' ')}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <button
            type="button"
            onClick={() => childCount && toggle(node.id)}
            aria-label={childCount ? (isOpen ? 'Collapse' : 'Expand') : undefined}
            className={`shrink-0 rounded p-0.5 ${childCount ? 'text-console-muted hover:bg-console-border' : 'invisible'}`}
          >
            <ChevronRight
              size={13}
              className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          </button>

          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              background: node.selectable
                ? LEVEL_DOT[node.node_type]
                : 'var(--console-text-disabled)',
            }}
            aria-hidden="true"
          />

          <span
            className={[
              'flex-1 truncate text-[13px]',
              node.selectable
                ? 'font-medium text-console-text'
                : 'text-console-disabled',
            ].join(' ')}
          >
            {node.name}
            {!node.is_active && (
              <span className="ml-1.5 text-[11px] text-console-subtle">
                inactive
              </span>
            )}
          </span>

          <span className="shrink-0 text-[10px] uppercase tracking-wide text-console-subtle">
            {NODE_TYPE_LABELS[node.node_type]}
          </span>

          {counts.parish ? (
            <Badge tone="neutral" title="Parishes beneath this node">
              {counts.parish}
            </Badge>
          ) : null}

          {/* Above the ceiling: shown for context, never scopeable. */}
          {node.selectable && !isCurrent && (
            <Btn
              variant="ghost"
              size="sm"
              title="Scope the Console to this node"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() =>
                setScopeNode({
                  id: node.id,
                  name: node.name,
                  node_type: node.node_type,
                })
              }
            >
              <Crosshair size={13} />
            </Btn>
          )}
          {isCurrent && <Badge tone="action">Current scope</Badge>}

          {/*
            Editing controls appear only where the caller holds hierarchy.manage.
            The child's type is never offered as a choice — exactly one type may
            sit beneath a given parent, so "Add" is labelled with the type it
            will create and the invalid move is unrepresentable.
          */}
          {canManage && node.selectable && (
            <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {childLevelOf(node.node_type) && (
                <Btn
                  variant="ghost"
                  size="sm"
                  title={`Add a ${NODE_TYPE_LABELS[childLevelOf(node.node_type)!]} under ${node.name}`}
                  onClick={() => setEditing({ mode: 'add', node })}
                >
                  <Plus size={13} />
                </Btn>
              )}
              <Btn
                variant="ghost"
                size="sm"
                title="Rename"
                onClick={() => setEditing({ mode: 'edit', node })}
              >
                <Pencil size={13} />
              </Btn>
            </span>
          )}
        </div>

        {isOpen && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <ScreenShell
      title="Hierarchy"
      subtitle="Seven levels: National, Region, Province, Zone, Area, Parish, Department. A node's type is always exactly one below its parent's."
      readOnly={readOnly}
      actions={
        <div className="flex items-center gap-2 rounded-console-md border border-console-border bg-console-surface px-2.5 py-1.5">
          <Search size={14} className="shrink-0 text-console-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a node…"
            className="w-52 bg-transparent text-[13px] text-console-text outline-none placeholder:text-console-subtle"
          />
        </div>
      }
    >
      <Card className="p-2">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : roots.length === 0 ? (
          <EmptyState
            title="No tree to show"
            message="You do not hold hierarchy.view anywhere, so there is no part of the tree you can browse. This is normal for a Teacher."
          />
        ) : (
          roots.map((r) => renderNode(r, 0))
        )}
      </Card>

      {editing && (
        <NodeEditor
          mode={editing.mode}
          node={editing.node}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </ScreenShell>
  );
};

export default Hierarchy;
