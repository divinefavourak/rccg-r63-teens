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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
  // Below `md` there is no room for a standing column at all: the sidebar is a
  // drawer the top row's menu button slides over the screen. From `md` to `lg`
  // it stands collapsed to icons; from `lg` up it stands open. The menu button
  // toggles whichever of the two applies at the current width.
  const [collapsed, setCollapsed] = useState(
    () => window.matchMedia('(max-width: 1023px)').matches,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  // Whatever opened the drawer, to hand focus back to when it closes.
  const returnFocus = useRef<HTMLElement | null>(null);
  const { pathname } = useLocation();

  // Choosing a section is the end of the drawer's job. Adjusted during render
  // rather than in an effect, so the new screen never paints under an open drawer.
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Crossing a breakpoint resets that layout's state. Without this, opening the
  // Console narrow and then widening it left the sidebar collapsed above `lg`,
  // where the button that expands it is hidden; and a drawer left open
  // reappeared on returning to phone width.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const phone = window.matchMedia('(max-width: 767px)');
    const onWide = () => setCollapsed(!wide.matches);
    const onPhone = () => {
      if (!phone.matches) {
        returnFocus.current = null;
        setDrawerOpen(false);
      }
    };
    wide.addEventListener('change', onWide);
    phone.addEventListener('change', onPhone);
    return () => {
      wide.removeEventListener('change', onWide);
      phone.removeEventListener('change', onPhone);
    };
  }, []);

  // The open drawer is modal: focus goes into it, the rest of the shell is
  // `inert` behind it (so Tab cannot reach what the backdrop covers), and focus
  // returns to whatever opened it once it closes, however it closes.
  useEffect(() => {
    if (drawerOpen) {
      sidebarRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    } else if (returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [drawerOpen]);

  const toggleSidebar = () => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      if (!drawerOpen) returnFocus.current = document.activeElement as HTMLElement;
      setDrawerOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  const nav = useMemo(() => computeNav(permissions), [permissions]);

  // Default the scope to the user's home node once both have loaded. Doing this
  // here rather than in the context keeps the context free of tree knowledge.
  useEffect(() => {
    // Wait for both requests. Deciding on whichever answered first made the
    // starting scope depend on network timing.
    if (isLoading || hierarchy.isLoading) return;

    // A scope remembered from another session can name a node this person can
    // no longer choose, or one that does not exist in this database at all.
    // Everything scoped would then be sent a node the server refuses, so drop
    // it and start again from where their authority is.
    if (
      scopeNode &&
      hierarchy.nodes.length > 0 &&
      !hierarchy.nodes.some((n) => n.id === scopeNode.id && n.selectable)
    ) {
      setScopeNode(null);
      return;
    }
    if (scopeNode) return;
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
    <div className="flex h-dvh gap-4 bg-console-canvas p-3 text-console-body md:p-4">
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        items={nav.filter((item) => item.inSidebar?.(permissions) ?? true)}
        ref={sidebarRef}
        collapsed={collapsed}
        drawerOpen={drawerOpen}
        showCheckIn={needsCheckinShortcut}
      />

      <div
        className="flex min-w-0 flex-1 flex-col gap-4 pt-1 md:gap-5 md:px-2"
        inert={drawerOpen}
      >
        <TopBar
          roots={hierarchy.roots}
          hierarchyLoading={hierarchy.isLoading}
          onToggleSidebar={toggleSidebar}
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
