/**
 * Standard chrome for a Console screen: title, subtitle, scope line, actions.
 *
 * Every screen uses this so the header block is in the same place at the same
 * size everywhere — an operator moving between People and Events should not have
 * to re-find the page title.
 *
 * The scope line is not decoration. Almost everything in the Console is filtered
 * to a node, and a list of 40 members means something different at a parish than
 * at a region. Stating the scope in the header is what makes the number
 * interpretable.
 */
import type { ReactNode } from 'react';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { NODE_TYPE_LABELS } from '../../types/console';

interface ScreenShellProps {
  title: string;
  subtitle?: string;
  /** Right-aligned controls. Gate these with PermissionGate, not `disabled`. */
  actions?: ReactNode;
  /** Set when the screen is readable but not editable for this holder. */
  readOnly?: boolean;
  /** Suppress the scope line on screens that are genuinely global (Bible). */
  hideScope?: boolean;
  children: ReactNode;
}

export const ScreenShell = ({
  title,
  subtitle,
  actions,
  readOnly,
  hideScope,
  children,
}: ScreenShellProps) => {
  const { scopeNode } = useConsoleAuth();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[19px] font-semibold tracking-tight text-console-text">
              {title}
            </h1>
            {readOnly && (
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-console-subtle ring-1 ring-console-border"
                title="Your role can open this, but not change it"
              >
                View only
              </span>
            )}
          </div>

          {subtitle && (
            <p className="mt-1 text-[13px] leading-relaxed text-console-muted">
              {subtitle}
            </p>
          )}

          {!hideScope && scopeNode && (
            <p className="mt-1.5 text-[11px] text-console-subtle">
              {NODE_TYPE_LABELS[scopeNode.node_type]} · {scopeNode.name}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
};

export default ScreenShell;
