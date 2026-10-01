/**
 * Console UI primitives.
 *
 * Small, unopinionated pieces every screen shares, so that a table row, a badge
 * or an empty state looks and behaves the same in People as it does in Events.
 * Everything here is styled from the `--console-*` tokens; no raw hex.
 *
 * Note there is no `disabled` variant of `Btn` for permission reasons. If the
 * holder lacks authority the button should not be rendered at all — see
 * `PermissionGate`. `disabled` remains for genuinely transient states: a form
 * mid-submit, a control awaiting a selection.
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// ─── Button ───────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md';

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary:
    'bg-console-action text-white hover:bg-console-action-hover border border-transparent',
  secondary:
    'bg-console-surface text-console-text border border-console-border hover:bg-console-tinted',
  ghost:
    'bg-transparent text-console-body border border-transparent hover:bg-console-tinted',
  danger:
    'bg-transparent text-console-danger border border-transparent hover:bg-console-danger-bg',
};

const BTN_SIZES: Record<BtnSize, string> = {
  sm: 'px-2.5 py-1.5 text-[12px] gap-1.5',
  md: 'px-3.5 py-2 text-[13px] gap-2',
};

export const Btn = ({
  variant = 'secondary',
  size = 'sm',
  className = '',
  children,
  ...rest
}: {
  variant?: BtnVariant;
  size?: BtnSize;
} & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={[
      'inline-flex items-center justify-center rounded-console-md font-medium transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-50',
      BTN_VARIANTS[variant],
      BTN_SIZES[size],
      className,
    ].join(' ')}
    {...rest}
  >
    {children}
  </button>
);

// ─── Surfaces ─────────────────────────────────────────────────────────────────

export const Card = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-console-lg border border-console-border bg-console-surface ${className}`}
  >
    {children}
  </div>
);

export const CardHeader = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-console-border px-4 py-2.5">
    {children}
  </div>
);

// ─── Badges ───────────────────────────────────────────────────────────────────

type Tone = 'neutral' | 'action' | 'info' | 'caution' | 'danger' | 'success';

const TONES: Record<Tone, string> = {
  neutral: 'bg-console-tinted text-console-muted',
  action: 'bg-console-action-light text-console-action',
  info: 'bg-console-info-bg text-console-info',
  caution: 'bg-console-caution-bg text-console-caution',
  danger: 'bg-console-danger-bg text-console-danger',
  success: 'bg-console-success-bg text-console-success',
};

export const Badge = ({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 rounded-console-sm px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}
  >
    {children}
  </span>
);

/** Person avatar. Initials only — the Console never needs a photo to identify. */
export const Avatar = ({
  name,
  size = 28,
}: {
  name: string;
  size?: number;
}) => {
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-console-tinted font-semibold text-console-muted"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
};

// ─── Table ────────────────────────────────────────────────────────────────────

export const Table = ({ children }: { children: ReactNode }) => (
  <div className="console-scroll overflow-x-auto">
    <table className="w-full border-collapse text-[13px]">{children}</table>
  </div>
);

export const Th = ({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) => (
  <th
    className={`border-b border-console-border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-console-subtle ${className}`}
  >
    {children}
  </th>
);

export const Td = ({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) => (
  <td className={`border-b border-console-border px-3 py-2.5 align-middle ${className}`}>
    {children}
  </td>
);

// ─── States ───────────────────────────────────────────────────────────────────

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-console-tinted ${className}`} />
);

/** Loading placeholder shaped like the table it replaces, to avoid a jump. */
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2 p-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    ))}
  </div>
);

/**
 * Nothing to show. Distinct from "not built" (see the stubs' Placeholder) and
 * from "not yours to see" (see PermissionDenied) — conflating the three sends
 * people hunting for problems that do not exist.
 */
export const EmptyState = ({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) => (
  <div className="px-6 py-12 text-center">
    {title && (
      <p className="text-[13px] font-medium text-console-text">{title}</p>
    )}
    <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-console-muted">
      {message}
    </p>
    {action && <div className="mt-3 flex justify-center">{action}</div>}
  </div>
);

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="px-6 py-12 text-center">
    <p className="text-[13px] font-medium text-console-danger">
      Something went wrong
    </p>
    <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-console-muted">
      {message}
    </p>
    {onRetry && (
      <div className="mt-3 flex justify-center">
        <Btn variant="secondary" onClick={onRetry}>
          Try again
        </Btn>
      </div>
    )}
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────

export const Modal = ({
  title,
  subtitle,
  onClose,
  footer,
  children,
  width = 560,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}) => {
  // Escape closes. A modal that traps you is a modal you resent.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full overflow-hidden rounded-console-lg border border-console-border bg-console-raised shadow-2xl"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-console-border px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-console-text">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] text-console-muted">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-console-sm p-1 text-console-muted transition-colors hover:bg-console-tinted hover:text-console-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="console-scroll max-h-[65vh] overflow-y-auto px-4 py-3">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-console-border px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export const Tabs = <T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) => (
  <div
    role="tablist"
    className="mb-4 flex items-center gap-1 border-b border-console-border"
  >
    {tabs.map((t) => (
      <button
        key={t.id}
        role="tab"
        aria-selected={active === t.id}
        onClick={() => onChange(t.id)}
        className={[
          '-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
          active === t.id
            ? 'border-console-action text-console-action'
            : 'border-transparent text-console-muted hover:text-console-text',
        ].join(' ')}
      >
        {t.label}
        {typeof t.count === 'number' && (
          <span className="ml-1.5 text-[11px] tabular-nums text-console-subtle">
            {t.count}
          </span>
        )}
      </button>
    ))}
  </div>
);
