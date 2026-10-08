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
import { Outlet } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import Loader from '../Loader';
import { useTheme } from '../../hooks/useTheme';
import { useHierarchy } from '../../hooks/useHierarchy';
import { computeNav } from './navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export const ConsoleLayout = () => {
  const { permissions, isLoading, error, me, scopeNode, setScopeNode } =
    useConsoleAuth();
  const { theme, toggleTheme } = useTheme();
  const hierarchy = useHierarchy();
  // Icons only below the `lg` breakpoint, where a 236px column would crowd the
  // screen; the top row's menu button opens it.
  const [collapsed, setCollapsed] = useState(
    () => window.matchMedia('(max-width: 1023px)').matches,
  );

  const nav = useMemo(() => computeNav(permissions), [permissions]);

  // Default the scope to the user's home node once both have loaded. Doing this
  // here rather than in the context keeps the context free of tree knowledge.
  useEffect(() => {
    // Wait for both requests. Deciding on whichever answered first made the
    // starting scope depend on network timing.
    if (isLoading || scopeNode || hierarchy.isLoading) return;
    // The context already starts at the holder's authority or home node. This
    // is for someone with neither (a superuser, typically): fall back to the
    // topmost node they can actually select.
    const firstSelectable = hierarchy.nodes.find((n) => n.selectable);
    if (firstSelectable) {
      setScopeNode({
        id: firstSelectable.id,
        name: firstSelectable.name,
        node_type: firstSelectable.node_type,
      });
    }
  }, [isLoading, scopeNode, hierarchy.isLoading, hierarchy.nodes, setScopeNode]);

  /**
   * A Teacher holds `events.checkin` but not `events.view`, so check-in cannot
   * be reached by drilling into an event list they cannot open. It needs a
   * standing entry point of its own — this is that entry point.
   *
   * Drawn as the green entry at the foot of the sidebar's list, apart from the
   * sections: for a Teacher it is not a section, it is the thing they came to do.
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
          <h1 className="text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
            The Console could not start
          </h1>
          <p className="mt-1.5 text-[14px] leading-5 text-console-body">
            {error}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-10 items-center rounded-full bg-console-action px-4 text-[14px] font-semibold text-console-on-action transition-colors hover:bg-console-action-hover"
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
          <h1 className="text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
            You don’t hold a role yet
          </h1>
          <p className="mt-1.5 text-[14px] leading-5 text-console-body">
            The Console shows you what your role allows, and yours has not been
            assigned. Whoever appointed you can grant it — until then there is
            nothing here for you to manage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen gap-4 bg-console-canvas p-4 text-console-body">
      <Sidebar
        items={nav.filter((item) => item.inSidebar?.(permissions) ?? true)}
        collapsed={collapsed}
        showCheckIn={needsCheckinShortcut}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-5 px-2 pt-1">
        <TopBar
          roots={hierarchy.roots}
          hierarchyLoading={hierarchy.isLoading}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          showNotifications={nav.some((item) => item.id === 'notifications')}
          dark={theme === 'dark'}
          onToggleDark={toggleTheme}
        />

        <main className="console-scroll relative min-h-0 flex-1 overflow-y-auto">
          <Outlet />

        </main>
      </div>
    </div>
  );
};

export default ConsoleLayout;
