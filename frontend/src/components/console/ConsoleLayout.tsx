/**
 * The Console shell.
 *
 * Composes the top bar, the computed sidebar and the routed screen, and owns the
 * two pieces of state that are global to the Console: which node you are scoped
 * to (via `ConsoleAuthContext`) and whether the sidebar is collapsed.
 *
 * Bootstrap order matters. Nothing renders until `/identity/me/` resolves,
 * because a Console drawn before permissions arrive would flash a sidebar and
 * then rearrange it — and on a slow connection that flash is long enough to
 * click. Authority is not a progressive enhancement.
 */
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AlertTriangle, ScanLine } from 'lucide-react';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import Loader from '../Loader';
import { useTheme } from '../../hooks/useTheme';
import { useHierarchy } from '../../hooks/useHierarchy';
import { computeNav } from './navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export const ConsoleLayout = () => {
  const { permissions, isLoading, error, me, scopeNode, setScopeNode, homeNode } =
    useConsoleAuth();
  const { theme, toggleTheme } = useTheme();
  const hierarchy = useHierarchy();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const nav = useMemo(() => computeNav(permissions), [permissions]);

  // Default the scope to the user's home node once both have loaded. Doing this
  // here rather than in the context keeps the context free of tree knowledge.
  useEffect(() => {
    if (scopeNode || hierarchy.isLoading) return;
    if (homeNode) {
      setScopeNode(homeNode);
      return;
    }
    // No membership (a superuser, typically) — fall back to the topmost node
    // they can actually select.
    const firstSelectable = hierarchy.nodes.find((n) => n.selectable);
    if (firstSelectable) {
      setScopeNode({
        id: firstSelectable.id,
        name: firstSelectable.name,
        node_type: firstSelectable.node_type,
      });
    }
  }, [scopeNode, homeNode, hierarchy.isLoading, hierarchy.nodes, setScopeNode]);

  /**
   * A Teacher holds `events.checkin` but not `events.view`, so check-in cannot
   * be reached by drilling into an event list they cannot open. It needs a
   * standing entry point of its own — this is that entry point.
   *
   * Rendered as a floating action rather than a nav item because for a Teacher
   * it is not a section of the Console, it is the thing they came to do.
   */
  const needsCheckinShortcut =
    permissions.has('events.checkin') && !permissions.has('events.view');

  if (isLoading) {
    return <Loader label="Checking your access…" />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-console-canvas px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-console-danger-bg">
            <AlertTriangle size={20} className="text-console-danger" />
          </div>
          <h1 className="text-[15px] font-semibold text-console-text">
            The Console could not start
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-console-muted">
            {error}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-console-md bg-console-action px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-console-action-hover"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /**
   * Authenticated, but holding no authority anywhere.
   *
   * Distinct from an error: nothing failed. This is what a teen or a newly
   * created account correctly sees, and what an admin sees before
   * `derive_hierarchy` has mapped their legacy role onto a RoleAssignment. The
   * message names the fix rather than blaming the user.
   */
  if (!me?.is_superuser && permissions.size === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-console-canvas px-6">
        <div className="max-w-md text-center">
          <h1 className="text-[15px] font-semibold text-console-text">
            You don’t hold a role yet
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-console-muted">
            The Console shows you what your role allows, and yours has not been
            assigned. Whoever appointed you can grant it — until then there is
            nothing here for you to manage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-console-canvas text-console-body">
      <TopBar
        roots={hierarchy.roots}
        hierarchyLoading={hierarchy.isLoading}
        onToggleSidebar={() => setCollapsed((v) => !v)}
        dark={theme === 'dark'}
        onToggleDark={toggleTheme}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar items={nav} collapsed={collapsed} />

        <main className="console-scroll relative flex-1 overflow-y-auto">
          <Outlet />

          {needsCheckinShortcut && (
            <button
              type="button"
              onClick={() => navigate('/admin/my-class')}
              className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-console-xl bg-console-action px-4 py-3 text-[13px] font-semibold text-white shadow-lg transition-colors hover:bg-console-action-hover"
            >
              <ScanLine size={16} /> Check in
            </button>
          )}
        </main>
      </div>
    </div>
  );
};

export default ConsoleLayout;
