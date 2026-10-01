/**
 * Roles & permissions — the 21 × N matrix.
 *
 * This is the screen where the Console explains itself: every other screen's
 * shape is derived from what this table says. Read by anyone with `roles.view`;
 * in the seeded set only Super Admin holds `roles.manage`.
 *
 * The matrix is fetched, never hardcoded. Role→permission mappings live in the
 * database precisely so they can be changed without a deploy, so a compiled-in
 * copy would be wrong the first time someone edited a role.
 *
 * Editing is not wired yet — there is no write endpoint for role permissions —
 * so no toggles are rendered. The read view is the honest half.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Minus } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type ConsoleRole,
  type Permission,
} from '../../types/console';
import { isGrantableAnywhere } from '../../components/console/roleGrants';

/** Groups mirror the comment blocks in `permissions_registry.REGISTRY`. */
const DOMAINS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'People & authority',
    permissions: [
      'users.view',
      'users.manage',
      'profiles.view',
      'profiles.manage',
      'memberships.view',
      'memberships.manage',
      'roles.view',
      'roles.assign',
      'roles.manage',
    ],
  },
  { label: 'Structure', permissions: ['hierarchy.view', 'hierarchy.manage'] },
  {
    label: 'Content',
    permissions: [
      'content.view',
      'content.publish',
      'content.manage',
      'bible.manage',
      'media.manage',
    ],
  },
  {
    label: 'Events',
    permissions: ['events.view', 'events.manage', 'events.checkin'],
  },
  { label: 'Money', permissions: ['payments.view', 'payments.manage'] },
];

function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const results = (data as { results?: T[] } | null)?.results;
  return Array.isArray(results) ? results : [];
}

export const Roles = () => {
  const { can, refresh } = useConsoleAuth();
  const [roles, setRoles] = useState<ConsoleRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const canEdit = can('roles.manage');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/identity/roles/');
      setRoles(unwrap<ConsoleRole>(data));
    } catch {
      setError('Could not load the role catalogue.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Toggle one permission on one role.
   *
   * Sends the *complete* desired set rather than a delta, matching the PUT
   * endpoint: idempotent, and a lost concurrent edit cannot silently merge into
   * a role nobody intended.
   *
   * No optimistic update. This changes authority for every holder of the role
   * at once, so showing a tick before the server has agreed would be showing
   * someone a permission grant that may not have happened.
   */
  const toggle = useCallback(
    async (role: ConsoleRole, code: Permission) => {
      setSaving(`${role.id}:${code}`);
      setError(null);
      const current = new Set(role.permissions ?? []);
      if (current.has(code)) current.delete(code);
      else current.add(code);
      try {
        const { data } = await api.put<ConsoleRole>(
          `/identity/roles/${role.id}/permissions/`,
          { permissions: [...current] },
        );
        setRoles((prev) => prev.map((r) => (r.id === role.id ? data : r)));
        // If the edited role is one the current user holds, their own sidebar
        // may have just changed shape.
        await refresh();
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        setError(detail ?? 'That change was refused.');
      } finally {
        setSaving(null);
      }
    },
    [refresh],
  );

  // Most authority first, so the matrix reads as a descending ladder.
  const ordered = useMemo(
    () =>
      [...roles].sort(
        (a, b) => (b.permissions?.length ?? 0) - (a.permissions?.length ?? 0),
      ),
    [roles],
  );

  const held = useMemo(() => {
    const map = new Map<string, Set<Permission>>();
    for (const r of ordered) map.set(r.id, new Set(r.permissions ?? []));
    return map;
  }, [ordered]);

  return (
    <ScreenShell
      title="Roles & permissions"
      subtitle="What each role is allowed to do. Every other screen in the Console is derived from this table."
      readOnly={!canEdit}
      hideScope
    >
      {error && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {error}
        </div>
      )}

      <Card>
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : ordered.length === 0 ? (
          <EmptyState
            title="No roles seeded"
            message="The role catalogue is empty. Run `python manage.py seed_rbac` to reconcile the database against the code registry."
          />
        ) : (
          <div className="console-scroll overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 bg-console-surface">
                <tr>
                  <th className="sticky left-0 z-10 min-w-[260px] border-b border-console-border bg-console-surface px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
                    Permission
                  </th>
                  {ordered.map((r) => (
                    <th
                      key={r.id}
                      className="min-w-[92px] border-b border-console-border px-2 py-2 text-center align-bottom"
                    >
                      <span className="block text-[11px] font-semibold leading-tight text-console-text">
                        {r.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] tabular-nums text-console-subtle">
                        {r.permissions?.length ?? 0}/21
                      </span>
                      {!isGrantableAnywhere(r) && (
                        <span
                          className="mt-1 inline-block text-[9px] uppercase tracking-wide text-console-subtle"
                          title="No allowed node types, so this role cannot be assigned anywhere — by anyone, including a superuser."
                        >
                          not assignable
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {DOMAINS.map((domain) => (
                  // Fragment, not <>, because the key belongs on the group.
                  <Fragment key={domain.label}>
                    <tr>
                      <td
                        colSpan={ordered.length + 1}
                        className="sticky left-0 border-b border-console-border bg-console-tinted px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-console-muted"
                      >
                        {domain.label}
                      </td>
                    </tr>
                    {domain.permissions.map((code) => (
                      <tr key={code} className="hover:bg-console-tinted">
                        <td className="sticky left-0 z-10 border-b border-console-border bg-console-surface px-3 py-2">
                          <span className="block font-medium text-console-text">
                            {PERMISSION_LABELS[code]}
                          </span>
                          <code className="block font-mono text-[10px] text-console-subtle">
                            {code}
                          </code>
                        </td>
                        {ordered.map((r) => {
                          const yes = held.get(r.id)?.has(code);
                          const busy = saving === `${r.id}:${code}`;
                          const mark = yes ? (
                            <Check
                              size={15}
                              className="mx-auto text-console-action"
                              aria-label="granted"
                            />
                          ) : (
                            <Minus
                              size={13}
                              className="mx-auto text-console-disabled"
                              aria-label="not granted"
                            />
                          );
                          return (
                            <td
                              key={r.id}
                              className="border-b border-console-border px-2 py-2 text-center"
                            >
                              {canEdit ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => toggle(r, code)}
                                  title={`${yes ? 'Remove' : 'Add'} ${code} for every ${r.label}`}
                                  className="w-full rounded-console-sm py-0.5 transition-colors hover:bg-console-tinted disabled:opacity-40"
                                >
                                  {mark}
                                </button>
                              ) : (
                                mark
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Anything in the registry that no domain lists would silently vanish
          from the matrix, so surface it rather than hide it. */}
      {(() => {
        const grouped = new Set(DOMAINS.flatMap((d) => d.permissions));
        const missing = ALL_PERMISSIONS.filter((p) => !grouped.has(p));
        return missing.length ? (
          <p className="mt-3 text-[12px] text-console-caution">
            Not shown above (add them to a domain group): {missing.join(', ')}
          </p>
        ) : null;
      })()}

      {canEdit && (
        <p className="mt-3 text-[12px] leading-relaxed text-console-caution">
          Every cell is a toggle. Changing one changes what that role means for
          <strong> everyone who holds it</strong>, immediately and everywhere —
          with no audit row per affected person, because none of their
          assignments changed. You cannot add a permission you do not hold
          yourself; the server refuses that.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          {ordered.length} roles · 21 permissions
        </Badge>
        <span className="text-[11px] text-console-subtle">
          Permission codes are defined in code; which role holds which is stored
          in the database and editable without a deploy.
        </span>
      </div>
    </ScreenShell>
  );
};

export default Roles;
