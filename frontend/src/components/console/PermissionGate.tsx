/**
 * Permission gating primitives for the Console.
 *
 * ## The rule: absent, not disabled
 *
 * A control the user has no authority to use is **not rendered at all** — not
 * greyed out, not shown with a padlock. A disabled button is a promise the
 * product cannot keep: it advertises a capability, invites the click, and
 * answers with nothing. A Province Coordinator does not have a broken Publish
 * button; they have a Console without one.
 *
 * ## The two exceptions
 *
 * There are exactly two places where a control IS shown but blocked, because the
 * block is a fact about the *item*, not the *person* — the same user, one edit
 * later, may proceed:
 *
 *  1. **Approve, on content you submitted yourself.** The two-person rule
 *     (`content/services/review.py:94`) refuses the submitter as approver.
 *     Hiding the button would misrepresent it as "you cannot approve", when the
 *     truth is "not this item".
 *  2. **Publish, on a devotional with no memory verse.**
 *     (`content/services/review.py:51` -> `validate_publishable`). The memory
 *     verse is the Verse of the Day; without it the day has no verse.
 *
 * Both render via `ExplanatoryChip`, which states the reason and — where there
 * is one — the way forward. Use `PermissionGate` for authority; use
 * `ExplanatoryChip` for item state. Do not blur the two.
 */
import type { ReactNode } from 'react';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import type { Permission } from '../../types/console';

interface PermissionGateProps {
  /** Render children only if the user holds this permission. */
  permission?: Permission;
  /** ...or every one of these. */
  all?: Permission[];
  /** ...or at least one of these. */
  any?: Permission[];
  /**
   * What to render when the check fails. Defaults to nothing, which is the
   * rule. Pass a fallback only for whole-screen states (see
   * `PermissionDenied`), never to substitute a disabled control.
   */
  fallback?: ReactNode;
  children: ReactNode;
}

export const PermissionGate = ({
  permission,
  all,
  any,
  fallback = null,
  children,
}: PermissionGateProps) => {
  const { can, canAll, canAny } = useConsoleAuth();

  let allowed = true;
  if (permission) allowed = allowed && can(permission);
  if (all && all.length) allowed = allowed && canAll(...all);
  if (any && any.length) allowed = allowed && canAny(...any);

  return <>{allowed ? children : fallback}</>;
};

/**
 * A stated reason why an otherwise-available action is blocked right now.
 *
 * This is for item state, not authority. If the user could never do this, the
 * control should not be on screen at all — see the module docstring.
 */
export const ExplanatoryChip = ({
  message,
  variant = 'default',
}: {
  message: string;
  variant?: 'default' | 'caution';
}) => (
  <span
    className={[
      'inline-flex items-center gap-1.5 rounded-console-sm px-2.5 py-1.5',
      'text-[11px] font-medium leading-tight',
      variant === 'caution'
        ? 'bg-console-caution-bg text-console-caution'
        : 'bg-console-tinted text-console-muted',
    ].join(' ')}
    role="note"
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
    {message}
  </span>
);

/**
 * Whole-screen state for a route the user cannot open.
 *
 * Reached only by deep link or a stale bookmark — the sidebar never offers an
 * unreachable screen, so arriving here is an accident rather than a refusal.
 * Worded accordingly: it names who can help rather than what the user did wrong.
 */
export const PermissionDenied = ({
  screenName,
  requiredPermission,
}: {
  screenName: string;
  requiredPermission?: Permission;
}) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-console-tinted">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-console-muted"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
    <h2 className="text-[15px] font-semibold text-console-text">
      {screenName} is not part of your Console
    </h2>
    <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-console-muted">
      Your role does not include this area. If you need it, ask whoever appointed
      you — they can grant the access, or tell you who can.
    </p>
    {requiredPermission && (
      <p className="mt-3 font-mono text-[11px] text-console-subtle">
        requires {requiredPermission}
      </p>
    )}
  </div>
);

export default PermissionGate;
