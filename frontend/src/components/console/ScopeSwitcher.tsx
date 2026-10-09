/**
 * Scope switcher — "which part of the church am I looking at?"
 *
 * Everything in the Console is scoped to a position in the tree. The switcher is
 * the control that moves it, and it enforces the **scope ceiling**: an operator
 * may look at their own node and anything beneath it, never above.
 *
 * Ancestors above the ceiling are still *shown*, greyed and unselectable, so a
 * Province Coordinator can see their province sits under Region 63 without being
 * able to scope to the region. Hiding them entirely would leave a rooted
 * operator with no sense of where they are; making them clickable would leak the
 * ceiling. `hierarchy/scoping.py` decides which is which and marks each node
 * `selectable`.
 *
 * When only one node is selectable the control renders as a static label, not a
 * dropdown — a menu with one choice is a lie about the options available.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, GitBranch, Search } from 'lucide-react';
import type { NodeRef, NodeType } from '../../types/console';
import { NODE_TYPE_LABELS } from '../../types/console';
import type { TreeNode } from '../../hooks/useHierarchy';

const LEVEL_DOT: Record<NodeType, string> = {
  national: 'var(--level-national-dot)',
  region: 'var(--level-region-dot)',
  province: 'var(--level-province-dot)',
  zone: 'var(--level-zone-dot)',
  area: 'var(--level-area-dot)',
  parish: 'var(--level-parish-dot)',
  department: 'var(--level-dept-dot)',
};

interface ScopeSwitcherProps {
  roots: TreeNode[];
  current: NodeRef | null;
  onSelect: (node: NodeRef) => void;
  isLoading?: boolean;
}

export const ScopeSwitcher = ({
  roots,
  current,
  onSelect,
  isLoading,
}: ScopeSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const flat = useMemo(() => flatten(roots), [roots]);
  const selectableCount = useMemo(
    () => flat.filter((r) => r.node.selectable).length,
    [flat],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    // Keep a matching node's ancestors so the result stays readable as a tree
    // rather than collapsing into a flat list of orphans.
    const matches = flat.filter((r) => r.node.name.toLowerCase().includes(q));
    const keep = new Set<string>();
    for (const m of matches) {
      keep.add(m.node.id);
      for (const a of m.ancestors) keep.add(a);
    }
    return flat.filter((r) => keep.has(r.node.id));
  }, [flat, query]);

  // "National → Region 63": where the scope sits, not just what it is called.
  // Past two ancestors the start is elided, as the kit's deep-path state does.
  const path = useMemo(() => {
    const row = flat.find((r) => r.node.id === current?.id);
    if (!row || !current) return null;
    const names = new Map(flat.map((r) => [r.node.id, r.node.name]));
    const trail = [...row.ancestors.map((id) => names.get(id) ?? ''), current.name];
    return trail.length > 3
      ? `… → ${trail.slice(-2).join(' → ')}`
      : trail.join(' → ');
  }, [flat, current]);

  if (isLoading) {
    return (
      <div className="h-[52px] w-56 animate-pulse rounded-full bg-console-skeleton" />
    );
  }

  const label = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-console-go text-console-on-go"
        aria-hidden="true"
      >
        <GitBranch size={18} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block max-w-[200px] truncate text-[14px] font-semibold leading-5 text-console-text">
          {current?.name ?? 'Choose a scope'}
        </span>
        <span className="block max-w-[200px] truncate text-[12px] font-medium leading-4 text-console-muted">
          {path ?? (current ? NODE_TYPE_LABELS[current.node_type] : 'No scope')}
        </span>
      </span>
    </>
  );

  // Nothing to switch between — a Teacher is pinned to one parish.
  if (selectableCount <= 1) {
    return (
      <div className="flex h-[52px] items-center gap-2.5 rounded-full bg-console-tinted pl-2 pr-4">
        {label}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-[52px] items-center gap-2.5 rounded-full border-[1.5px] border-console-border-strong bg-console-surface pl-2 pr-3.5 transition-colors hover:bg-console-tinted"
      >
        {label}
        <ChevronDown size={18} className="shrink-0 text-console-text" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[340px] overflow-hidden rounded-console-lg bg-console-raised shadow-console-dialog">
          <div className="flex items-center gap-2 border-b border-console-border px-4 py-3">
            <Search size={16} className="shrink-0 text-console-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a parish, area, province…"
              className="w-full bg-transparent text-[14px] text-console-text outline-none placeholder:text-console-muted"
            />
          </div>

          <ul
            role="listbox"
            className="console-scroll max-h-80 overflow-y-auto p-1.5"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-[14px] text-console-body">
                Nothing matches “{query}”.
              </li>
            )}
            {filtered.map(({ node, depth }) => {
              const isCurrent = node.id === current?.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    disabled={!node.selectable}
                    onClick={() => {
                      if (!node.selectable) return;
                      onSelect({
                        id: node.id,
                        name: node.name,
                        node_type: node.node_type,
                      });
                      setOpen(false);
                      setQuery('');
                    }}
                    style={{ paddingLeft: 12 + depth * 16 }}
                    className={[
                      'flex h-10 w-full items-center gap-2.5 rounded-full pr-3 text-left text-[14px] font-semibold transition-colors',
                      node.selectable
                        ? 'text-console-text hover:bg-console-tinted'
                        : // Above the ceiling: shown for context, not reachable.
                          'cursor-default text-console-disabled',
                      isCurrent ? 'bg-console-action-light' : '',
                    ].join(' ')}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: node.selectable
                          ? LEVEL_DOT[node.node_type]
                          : 'var(--console-text-disabled)',
                      }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{node.name}</span>
                    <span className="shrink-0 text-[12px] font-medium text-console-muted">
                      {NODE_TYPE_LABELS[node.node_type]}
                    </span>
                    {isCurrent && (
                      <Check size={16} className="shrink-0 text-console-text" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

interface FlatRow {
  node: TreeNode;
  depth: number;
  ancestors: string[];
}

/** Depth-first flatten, carrying ancestor ids so search can keep context rows. */
function flatten(roots: TreeNode[]): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (node: TreeNode, depth: number, ancestors: string[]) => {
    out.push({ node, depth, ancestors });
    for (const child of node.children) {
      walk(child, depth + 1, [...ancestors, node.id]);
    }
  };
  for (const r of roots) walk(r, 0, []);
  return out;
}

export default ScopeSwitcher;
