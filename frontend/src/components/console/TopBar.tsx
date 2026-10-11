/**
 * Console top row — scope and the global controls.
 *
 * The scope switcher lives here rather than in the sidebar because scope is
 * orthogonal to section: changing from People to Events should not change which
 * province you are looking at, and putting the two controls in the same column
 * implies otherwise.
 *
 * The Figma frames also carry a search field across the middle of this row.
 * There is no search endpoint behind it yet, so it is left out: a field that
 * accepts a query and finds nothing is worse than no field.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useAuthContext } from '../../context/AuthContext';
import ScopeSwitcher from './ScopeSwitcher';
import { Avatar } from './primitives';
import { useAccountLabel } from './account';
import type { TreeNode } from '../../hooks/useHierarchy';

interface TopBarProps {
  roots: TreeNode[];
  hierarchyLoading: boolean;
  onToggleSidebar: () => void;
  /** Whether the holder can open the Notifications screen. */
  showNotifications: boolean;
  dark: boolean;
  onToggleDark: () => void;
}

// 40px on a phone, where four 52px circles and the scope pill do not fit in a row.
const ROUND =
  'flex h-10 w-10 md:h-[52px] md:w-[52px] shrink-0 items-center justify-center rounded-full bg-console-tinted text-console-text transition-colors hover:bg-console-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text';

export const TopBar = ({
  roots,
  hierarchyLoading,
  onToggleSidebar,
  showNotifications,
  dark,
  onToggleDark,
}: TopBarProps) => {
  const { me, assignments, scopeNode, setScopeNode } = useConsoleAuth();
  const { logout } = useAuthContext();
  const { displayName } = useAccountLabel();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="flex shrink-0 items-center gap-2 md:gap-3">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
        className={`${ROUND} lg:hidden`}
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <ScopeSwitcher
          roots={roots}
          current={scopeNode}
          onSelect={setScopeNode}
          isLoading={hierarchyLoading}
        />
      </div>

      {showNotifications && (
        <Link
          to="/admin/notifications"
          aria-label="Notifications"
          className={ROUND}
        >
          <Bell size={20} />
        </Link>
      )}

      <button
        type="button"
        onClick={onToggleDark}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={ROUND}
      >
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Your account"
          className="block rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text"
        >
          <span className="md:hidden">
            <Avatar name={displayName} size={40} />
          </span>
          <span className="hidden md:block">
            <Avatar name={displayName} size={52} />
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-24px)] overflow-hidden rounded-console-lg bg-console-raised py-1.5 shadow-console-dialog"
          >
            <div className="border-b border-console-border px-4 py-2.5">
              <p className="text-[14px] font-semibold leading-5 text-console-text">
                {displayName}
              </p>
              <p className="truncate text-[12px] font-medium leading-4 text-console-muted">
                {me?.email}
              </p>
            </div>

            {/* Every active assignment, not just the highest — someone who holds
                two roles should be able to see both without leaving the shell. */}
            {assignments.length > 0 && (
              <div className="border-b border-console-border px-4 py-2.5">
                <p className="mb-1 text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted">
                  Your authority
                </p>
                {assignments.map((a) => (
                  <p key={a.id} className="text-[13px] leading-5 text-console-body">
                    {a.role_detail?.label}
                    {a.node_detail ? (
                      <span className="text-console-muted">
                        {' '}
                        · {a.node_detail.name}
                      </span>
                    ) : null}
                  </p>
                ))}
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] font-semibold text-console-danger transition-colors hover:bg-console-danger-bg"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;
