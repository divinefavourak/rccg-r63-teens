/**
 * Console top bar — identity, scope and the global controls.
 *
 * The scope switcher lives here rather than in the sidebar because scope is
 * orthogonal to section: changing from People to Events should not change which
 * province you are looking at, and putting the two controls in the same column
 * implies otherwise.
 *
 * The role shown next to the user is their *highest* active assignment, with the
 * node it is held at. "Regional Coordinator · Region 63" answers both "what am I"
 * and "where", which is the pair that determines everything else on screen.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, Moon, Sun, User } from 'lucide-react';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useAuthContext } from '../../context/AuthContext';
import ScopeSwitcher from './ScopeSwitcher';
import type { TreeNode } from '../../hooks/useHierarchy';

interface TopBarProps {
  roots: TreeNode[];
  hierarchyLoading: boolean;
  onToggleSidebar: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export const TopBar = ({
  roots,
  hierarchyLoading,
  onToggleSidebar,
  dark,
  onToggleDark,
}: TopBarProps) => {
  const { me, assignments, scopeNode, setScopeNode } = useConsoleAuth();
  const { logout } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // `assignments` is sorted most-authoritative first by the context.
  const primary = assignments[0];
  const roleLabel = me?.is_superuser
    ? 'Superuser'
    : (primary?.role_detail?.label ?? 'No role assigned');
  const roleNode = primary?.node_detail?.name;

  const displayName =
    me?.profile?.display_name ||
    [me?.first_name, me?.last_name].filter(Boolean).join(' ') ||
    me?.username ||
    '';

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-console-border bg-console-surface px-3">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
        className="rounded-console-md p-1.5 text-console-muted transition-colors hover:bg-console-tinted hover:text-console-text"
      >
        <Menu size={17} />
      </button>

      <span className="text-[13px] font-semibold tracking-tight text-console-text">
        Faith Tribe
        <span className="ml-1.5 font-normal text-console-subtle">Console</span>
      </span>

      <div className="mx-1 h-5 w-px bg-console-border" aria-hidden="true" />

      <ScopeSwitcher
        roots={roots}
        current={scopeNode}
        onSelect={setScopeNode}
        isLoading={hierarchyLoading}
      />

      <div className="flex-1" />

      <button
        type="button"
        onClick={onToggleDark}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="rounded-console-md p-1.5 text-console-muted transition-colors hover:bg-console-tinted hover:text-console-text"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-console-md py-1 pl-1 pr-2 transition-colors hover:bg-console-tinted"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-console-action text-[11px] font-semibold text-white">
            {initials}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-[12px] font-medium text-console-text">
              {displayName}
            </span>
            <span className="block text-[10px] text-console-subtle">
              {roleLabel}
              {roleNode ? ` · ${roleNode}` : ''}
            </span>
          </span>
          <ChevronDown size={13} className="text-console-muted" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-console-lg border border-console-border bg-console-raised py-1 shadow-xl"
          >
            <div className="border-b border-console-border px-3 py-2">
              <p className="text-[12px] font-medium text-console-text">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-console-subtle">
                {me?.email}
              </p>
            </div>

            {/* Every active assignment, not just the highest — someone who holds
                two roles should be able to see both without leaving the shell. */}
            {assignments.length > 0 && (
              <div className="border-b border-console-border px-3 py-2">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-console-subtle">
                  Your authority
                </p>
                {assignments.map((a) => (
                  <p key={a.id} className="text-[11px] text-console-body">
                    {a.role_detail?.label}
                    {a.node_detail ? (
                      <span className="text-console-subtle">
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
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-console-body transition-colors hover:bg-console-tinted"
            >
              <User size={14} /> Your profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-console-danger transition-colors hover:bg-console-danger-bg"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;
