/**
 * Console sidebar — rendered from `computeNav`, never authored per role.
 *
 * A Super Admin and a Teacher get the same component; they get different lists
 * because they hold different permissions. Items the holder cannot reach are
 * absent, not disabled.
 *
 * Read-only areas carry a small "View" marker. That is not a disabled state — the
 * screen genuinely works, it just has no editing affordances — and saying so up
 * front is kinder than letting someone open it and hunt for a button that was
 * never going to be there.
 */
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  Cross,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Network,
  PlayCircle,
  ScanLine,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ResolvedNavItem } from './navigation';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Network,
  ShieldCheck,
  BookOpen,
  CheckSquare,
  FileText,
  PlayCircle,
  Cross,
  Calendar,
  ScanLine,
  GraduationCap,
  Bell,
  BarChart3,
  Settings,
  ScrollText,
};

interface SidebarProps {
  items: ResolvedNavItem[];
  collapsed?: boolean;
}

export const Sidebar = ({ items, collapsed = false }: SidebarProps) => (
  <nav
    aria-label="Console sections"
    className={[
      'console-scroll flex shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-console-border bg-console-surface py-3 transition-[width]',
      collapsed ? 'w-[60px] px-2' : 'w-[212px] px-2.5',
    ].join(' ')}
  >
    {items.map((item) => {
      const Icon = ICONS[item.icon] ?? LayoutDashboard;
      return (
        <div key={item.id || 'overview'}>
          {item.divider && (
            <div className="mx-1 my-2 border-t border-console-border" />
          )}
          <NavLink
            to={item.to}
            // `end` on the index route only, so /admin does not stay active
            // while a child route is open.
            end={item.id === ''}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              [
                'group flex items-center gap-2.5 rounded-console-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-console-action-light text-console-action'
                  : 'text-console-body hover:bg-console-tinted hover:text-console-text',
                collapsed ? 'justify-center px-0' : '',
              ].join(' ')
            }
          >
            <Icon size={16} className="shrink-0" strokeWidth={2} />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{item.label}</span>
                {item.result === 'readonly' && (
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-console-subtle"
                    title="You can open this, but not change anything in it"
                  >
                    View
                  </span>
                )}
              </>
            )}
          </NavLink>
        </div>
      );
    })}
  </nav>
);

export default Sidebar;
