/**
 * Console authorization context.
 *
 * Bootstraps the admin Console from `GET /api/v1/identity/me/` — identity,
 * belonging (memberships), authority (role assignments) and the effective
 * permission set — and holds the currently selected scope node.
 *
 * This deliberately does NOT replace `AuthContext`. That context owns the
 * session (token, login, logout) and the legacy `User.role` string used by the
 * teen app and the older admin pages. This one owns *authority*, which the
 * legacy role string cannot express.
 *
 * ## On union vs. per-node permissions
 *
 * `me.permissions` is the union of codes held at *any* node
 * (`authorization.effective_permissions`), not a per-node answer. The backend
 * enforces per-node via `has_permission(user, code, node)`; the union exists so
 * the client can decide what to render.
 *
 * For the overwhelmingly common case — one role at one node — union and
 * per-scope are the same set. They diverge only for someone holding roles at two
 * unrelated nodes, where the union over-reports for either scope taken alone.
 * We therefore gate *navigation* on the union (matching backend intent) and
 * expose `permissionsAt()` for screens that need to narrow to the active scope.
 * The server remains the enforcement boundary in every case: a control the UI
 * wrongly offers still fails server-side, which is the correct failure mode.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import api from '../api/axios';
import type {
  ConsoleRoleAssignment,
  MeResponse,
  NodeRef,
  Permission,
} from '../types/console';

interface ConsoleAuthContextType {
  /** Raw payload from /identity/me/, or null before it resolves. */
  me: MeResponse | null;
  /** Union of permissions held anywhere. Empty until loaded. */
  permissions: Set<Permission>;
  /** True while the initial bootstrap request is in flight. */
  isLoading: boolean;
  /** Set when the bootstrap failed; the Console shows an error state. */
  error: string | null;
  /** Does the user hold this permission anywhere? Nav-level gate. */
  can: (permission: Permission) => boolean;
  /** Does the user hold every one of these? */
  canAll: (...permissions: Permission[]) => boolean;
  /** Does the user hold at least one of these? */
  canAny: (...permissions: Permission[]) => boolean;
  /**
   * Permissions held at a specific node, narrowed from role assignments.
   * Requires `ancestorIds` — the set of node ids on the path from the root down
   * to (and including) the target — because the client cannot derive ancestry
   * from `node_detail` alone (it carries no materialized path).
   * Falls back to the union when ancestry is unknown.
   */
  permissionsAt: (nodeId: string, ancestorIds?: Set<string>) => Set<Permission>;
  /** The node the Console is currently scoped to, or null for "everywhere". */
  scopeNode: NodeRef | null;
  setScopeNode: (node: NodeRef | null) => void;
  /** The user's home node — primary membership. The default scope. */
  homeNode: NodeRef | null;
  /** Active role assignments, highest authority first. */
  assignments: ConsoleRoleAssignment[];
  /** Re-fetch /identity/me/ (after a role change affecting the current user). */
  refresh: () => Promise<void>;
}

const ConsoleAuthContext = createContext<ConsoleAuthContextType | undefined>(
  undefined,
);

/** Persisted so a reload keeps the operator where they were working. */
const SCOPE_STORAGE_KEY = 'console_scope_node';

export const ConsoleAuthProvider = ({ children }: { children: ReactNode }) => {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeNode, setScopeNodeState] = useState<NodeRef | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get<MeResponse>('/identity/me/');
      setMe(data);
      setError(null);
      return data;
    } catch (err) {
      // A 401 is already handled by the axios interceptor (refresh, then
      // redirect). Anything else means the Console cannot determine authority,
      // and rendering a Console with unknown authority would be worse than
      // rendering an error.
      setError(
        'Could not load your permissions. The Console needs them to decide what to show you.',
      );
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const data = await fetchMe();
      if (cancelled) return;

      // Restore the previously selected scope.
      //
      // Deliberately NOT validated against the user's own membership/assignment
      // nodes: authority flows *down* the tree, so a Regional Coordinator
      // legitimately scopes to any parish in their region — nodes they hold no
      // direct assignment at. Checking membership here would wipe the scope on
      // every reload for exactly the users the scope switcher exists for.
      //
      // Validating properly needs tree ancestry, which arrives with the
      // hierarchy fetch, not here. If authority was revoked between sessions the
      // server refuses and the screen shows its empty/denied state — the correct
      // failure mode, and one the server owns either way.
      if (data) {
        const stored = localStorage.getItem(SCOPE_STORAGE_KEY);
        if (stored) {
          try {
            setScopeNodeState(JSON.parse(stored) as NodeRef);
          } catch {
            localStorage.removeItem(SCOPE_STORAGE_KEY);
          }
        }
      }
      setIsLoading(false);
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  const setScopeNode = useCallback((node: NodeRef | null) => {
    setScopeNodeState(node);
    if (node) localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(node));
    else localStorage.removeItem(SCOPE_STORAGE_KEY);
  }, []);

  const permissions = useMemo(
    () => new Set<Permission>(me?.permissions ?? []),
    [me],
  );

  const assignments = useMemo(() => {
    const active = (me?.role_assignments ?? []).filter((a) => a.is_active);
    // Most authority first, so "your role" displays sensibly when someone holds
    // several. Permission count is a reasonable proxy for authority here.
    return active.sort(
      (a, b) =>
        (b.role_detail?.permissions.length ?? 0) -
        (a.role_detail?.permissions.length ?? 0),
    );
  }, [me]);

  const homeNode = useMemo(() => {
    const primary = (me?.memberships ?? []).find(
      (m) => m.is_primary && m.is_active,
    );
    return primary?.organization_node_detail ?? null;
  }, [me]);

  const can = useCallback(
    (permission: Permission) => permissions.has(permission),
    [permissions],
  );

  const canAll = useCallback(
    (...codes: Permission[]) => codes.every((c) => permissions.has(c)),
    [permissions],
  );

  const canAny = useCallback(
    (...codes: Permission[]) => codes.some((c) => permissions.has(c)),
    [permissions],
  );

  const permissionsAt = useCallback(
    (nodeId: string, ancestorIds?: Set<string>) => {
      // A superuser holds everything everywhere; no narrowing applies.
      if (me?.is_superuser) return permissions;
      if (!ancestorIds) return permissions;

      // Mirror `has_permission`: an assignment counts at `nodeId` when its node
      // is an ancestor-or-self of it. Authority flows down the tree, never up.
      const codes = new Set<Permission>();
      for (const a of assignments) {
        const assignedTo = a.node_detail?.id ?? a.node;
        if (assignedTo === nodeId || ancestorIds.has(assignedTo)) {
          for (const code of a.role_detail?.permissions ?? []) codes.add(code);
        }
      }
      return codes;
    },
    [me, permissions, assignments],
  );

  const refresh = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  const value: ConsoleAuthContextType = {
    me,
    permissions,
    isLoading,
    error,
    can,
    canAll,
    canAny,
    permissionsAt,
    scopeNode: scopeNode ?? homeNode,
    setScopeNode,
    homeNode,
    assignments,
    refresh,
  };

  return (
    <ConsoleAuthContext.Provider value={value}>
      {children}
    </ConsoleAuthContext.Provider>
  );
};

export const useConsoleAuth = () => {
  const ctx = useContext(ConsoleAuthContext);
  if (!ctx) {
    throw new Error('useConsoleAuth must be used within a ConsoleAuthProvider');
  }
  return ctx;
};
