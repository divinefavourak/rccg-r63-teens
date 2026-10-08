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
  /** The section's name for the breadcrumb, when the title is not it. */
  crumb?: string;
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
  crumb,
  subtitle,
  actions,
  readOnly,
  hideScope,
  children,
}: ScreenShellProps) => {
  const { scopeNode } = useConsoleAuth();

  return (
    <div className="w-full pb-6">
      <p className="mb-5 text-[12px] font-medium uppercase leading-4 tracking-[0.04em] text-console-muted">
        Console&nbsp;&nbsp;/&nbsp;&nbsp;{crumb ?? title}
      </p>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[32px] font-extrabold leading-10 tracking-[-0.02em] text-console-text">
              {title}
            </h1>
            {readOnly && (
              <span
                className="inline-flex h-[26px] items-center rounded-full bg-console-tinted px-2.5 text-[12px] font-semibold leading-4 text-console-muted"
                title="Your role can open this, but not change it"
              >
                Read-only for your role
              </span>
            )}
          </div>

          {subtitle && (
            <p className="mt-1 max-w-3xl text-[16px] leading-6 text-console-body">
              {subtitle}
            </p>
          )}

          {!hideScope && scopeNode && (
            <p className="mt-1.5 text-[12px] font-medium leading-4 text-console-muted">
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
