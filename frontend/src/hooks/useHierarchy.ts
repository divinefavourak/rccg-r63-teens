/**
 * Loads the org tree the current user may see and shapes it for the UI.
 *
 * The API returns nodes flat, ordered by materialized path — which is
 * depth-first tree order — so nesting is a single pass with a stack, not a sort
 * plus repeated lookups.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import type { HierarchyNodeDto, NodeType } from '../types/console';

export interface TreeNode extends HierarchyNodeDto {
  /** False for ancestors returned only for breadcrumb context. */
  selectable: boolean;
  parent_id: string | null;
  children: TreeNode[];
}

interface NodeListResponse {
  count: number;
  results: (HierarchyNodeDto & { selectable: boolean; parent_id: string | null })[];
}

/** treebeard's path segment width. Must match `HierarchyNode.steplen`. */
const STEPLEN = 4;

/** Every ancestor path of `path`, excluding the node itself. */
export function ancestorPaths(path: string): string[] {
  const out: string[] = [];
  for (let len = STEPLEN; len < path.length; len += STEPLEN) {
    out.push(path.slice(0, len));
  }
  return out;
}

export function useHierarchy() {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<NodeListResponse>('/hierarchy/nodes/');
      setNodes(
        data.results.map((n) => ({ ...n, children: [] as TreeNode[] })),
      );
      setError(null);
    } catch {
      setError('Could not load the church hierarchy.');
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Fast lookups the tree UI needs on every render. */
  const byId = useMemo(() => {
    const map = new Map<string, TreeNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const byPath = useMemo(() => {
    const map = new Map<string, TreeNode>();
    for (const n of nodes) map.set(n.path, n);
    return map;
  }, [nodes]);

  /**
   * Roots of the visible forest, with children attached.
   *
   * Usually one root. It can legitimately be several when a user holds
   * assignments in two unrelated subtrees and no common ancestor was returned.
   */
  const roots = useMemo(() => {
    // Rebuild children fresh each time so repeated renders cannot accumulate.
    const fresh = new Map<string, TreeNode>();
    for (const n of nodes) fresh.set(n.id, { ...n, children: [] });

    const tops: TreeNode[] = [];
    for (const n of nodes) {
      const node = fresh.get(n.id)!;
      const parent = n.parent_id ? fresh.get(n.parent_id) : undefined;
      if (parent) parent.children.push(node);
      else tops.push(node);
    }
    return tops;
  }, [nodes]);

  /** The path from the visible root down to `nodeId`, inclusive. Breadcrumbs. */
  const pathTo = useCallback(
    (nodeId: string): TreeNode[] => {
      const node = byId.get(nodeId);
      if (!node) return [];
      const chain = ancestorPaths(node.path)
        .map((p) => byPath.get(p))
        .filter((n): n is TreeNode => Boolean(n));
      return [...chain, node];
    },
    [byId, byPath],
  );

  /** Node ids on the path to `nodeId`, excluding it — for `permissionsAt`. */
  const ancestorIdsOf = useCallback(
    (nodeId: string): Set<string> => {
      const node = byId.get(nodeId);
      if (!node) return new Set();
      return new Set(
        ancestorPaths(node.path)
          .map((p) => byPath.get(p)?.id)
          .filter((id): id is string => Boolean(id)),
      );
    },
    [byId, byPath],
  );

  /** Descendant count per node type, for the "12 parishes" style summaries. */
  const subtreeCounts = useCallback(
    (nodeId: string): Partial<Record<NodeType, number>> => {
      const node = byId.get(nodeId);
      if (!node) return {};
      const counts: Partial<Record<NodeType, number>> = {};
      for (const n of nodes) {
        if (n.id === node.id) continue;
        if (!n.path.startsWith(node.path)) continue;
        counts[n.node_type] = (counts[n.node_type] ?? 0) + 1;
      }
      return counts;
    },
    [byId, nodes],
  );

  return {
    nodes,
    roots,
    byId,
    byPath,
    pathTo,
    ancestorIdsOf,
    subtreeCounts,
    isLoading,
    error,
    reload: load,
  };
}
