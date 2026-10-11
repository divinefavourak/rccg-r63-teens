/**
 * Console sidebar — rendered from `computeNav`, never authored per role.
 *
 * A Super Admin and a Teacher get the same component; they get different lists
 * because they hold different permissions. Items the holder cannot reach are
 * absent, not disabled.
 *
 * Read-only areas carry a small "read-only" note. That is not a disabled state —
 * the screen genuinely works, it just has no editing affordances — and saying so
 * up front is kinder than letting someone open it and hunt for a button that was
 * never going to be there.
 */
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  Cross,
  FileText,
  GitBranch,
  GraduationCap,
  Headphones,
  ScanLine,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';
import LogoLockup from '../site/LogoLockup';
import { Avatar } from './primitives';
import { useAccountLabel } from './account';
import type { ResolvedNavItem } from './navigation';

const ICONS: Record<string, LucideIcon> = {
  Sun,
  Users,
  GitBranch,
  ShieldCheck,
  FileText,
  CheckSquare,
  BookOpen,
  Headphones,
  Cross,
  Calendar,
  ScanLine,
  GraduationCap,
  Bell,
  BarChart3,
  SlidersHorizontal,
  ScrollText,
};

interface SidebarProps {
  items: ResolvedNavItem[];
  collapsed?: boolean;
  /**
   * Below `md` the sidebar is not a column but a drawer over the screen, shown
   * only while this is set. `collapsed` does not apply to the drawer: when it is
   * open there is room for the labels.
   */
  drawerOpen?: boolean;
  /**
   * The green way to the door, for someone who works one but has no Events
   * section to reach it through (a Teacher).
   */
  showCheckIn?: boolean;
}

export const Sidebar = ({
  items,
  collapsed: collapsedProp = false,
  drawerOpen = false,
  showCheckIn = false,
}: SidebarProps) => {
  const { displayName, roleLabel } = useAccountLabel();
  const isDrawer = useMediaQuery('(max-width: 767px)');
  const collapsed = isDrawer ? false : collapsedProp;

  return (
    <aside
      className={[
        'flex shrink-0 flex-col rounded-console-xl bg-console-ink px-3 pb-4 pt-5 text-console-on-ink transition-[width]',
        collapsed ? 'w-[68px]' : 'w-[236px]',
        // The drawer: pinned over the screen's left edge, off it until opened.
        'max-md:fixed max-md:inset-y-3 max-md:left-3 max-md:z-50 max-md:w-[min(260px,calc(100vw-48px))] max-md:transition-[transform,visibility]',
        drawerOpen ? 'max-md:translate-x-0' : 'max-md:invisible max-md:-translate-x-[calc(100%+24px)]',
      ].join(' ')}
      aria-hidden={isDrawer && !drawerOpen ? true : undefined}
    >
      <div
        className={`flex shrink-0 items-center pb-4 ${collapsed ? 'justify-center' : 'px-2'}`}
      >
        {!collapsed && (
          <span className="origin-left scale-[0.8]">
            <LogoLockup />
          </span>
        )}
        <span
          className={`text-[20px] font-bold leading-7 tracking-[-0.01em] ${collapsed ? 'sr-only' : '-ml-1'}`}
        >
          Console
        </span>
      </div>

      <nav
        aria-label="Console sections"
        className="console-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? Sun;
          return (
            <NavLink
              key={item.id || 'overview'}
              to={item.to}
              // `end` on the index route only, so /admin does not stay active
              // while a child route is open.
              end={item.id === ''}
              title={collapsed ? item.label : undefined}
              // Collapsed, the link is an icon alone; `title` is not a name a
              // screen reader can rely on.
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  'flex h-11 shrink-0 items-center gap-3 rounded-full text-[14px] font-semibold leading-5 transition-[background-color,opacity]',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-console-on-ink',
                  isActive
                    ? 'bg-console-on-ink text-console-ink'
                    : 'opacity-[0.78] hover:opacity-100',
                  collapsed ? 'justify-center px-0' : 'px-3.5',
                ].join(' ')
              }
            >
              <Icon size={20} className="shrink-0" strokeWidth={2} aria-hidden="true" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.result === 'readonly' && (
                    <span
                      className="shrink-0 text-[12px] font-medium leading-4 opacity-70"
                      title="You can open this, but not change anything in it"
                    >
                      read-only
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {showCheckIn && (
          <NavLink
            to="/admin/check-in"
            title={collapsed ? 'Check in' : undefined}
            className={[
              'mt-1 flex h-11 shrink-0 items-center gap-3 rounded-full bg-console-go text-[14px] font-semibold leading-5 text-console-on-go transition-[filter] hover:brightness-95',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-on-ink',
              collapsed ? 'justify-center px-0' : 'px-3.5',
            ].join(' ')}
          >
            <ScanLine size={20} className="shrink-0" strokeWidth={2} />
            {!collapsed && <span>Check in</span>}
          </NavLink>
        )}
      </nav>

      {/* Who you are and in what capacity: the pair that decides what the list
          above contains. */}
      <div
        className={[
          'mt-3 flex shrink-0 items-center gap-2.5 rounded-console-lg',
          collapsed ? 'justify-center' : 'border p-2.5',
        ].join(' ')}
        style={{
          borderColor:
            'color-mix(in srgb, var(--console-on-ink) 22%, transparent)',
        }}
        title={collapsed ? `${displayName} · ${roleLabel}` : undefined}
      >
        <Avatar name={displayName} size={36} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-5">
              {displayName}
            </p>
            <p className="truncate text-[12px] font-medium leading-4 opacity-70">
              {roleLabel}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export default Sidebar;
