/**
 * Console UI primitives.
 *
 * Small, unopinionated pieces every screen shares, so that a table row, a badge
 * or an empty state looks and behaves the same in People as it does in Events.
 * They follow the Console kit in the Figma file (Components → Console kit) and
 * are styled from the `--console-*` tokens; no raw hex.
 *
 * Note there is no `disabled` variant of `Btn` for permission reasons. If the
 * holder lacks authority the button should not be rendered at all — see
 * `PermissionGate`. `disabled` remains for genuinely transient states: a form
 * mid-submit, a control awaiting a selection.
 */
import { useEffect } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  FileText,
  GitBranch,
  Minus,
  ScanLine,
  Search,
  Users,
  X,
} from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ILLUSTRATIONS } from '../../assets/site/library';

// ─── Button ───────────────────────────────────────────────────────────────────

/**
 * One `primary` per view. `go` is the green button for the thing a person came
 * to do (check in). `danger` is the outlined destructive button.
 */
type BtnVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'go' | 'danger';
type BtnSize = 'sm' | 'md';

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary:
    'bg-console-action text-console-on-action hover:bg-console-action-hover border-[1.5px] border-transparent',
  secondary:
    'bg-transparent text-console-text border-[1.5px] border-console-border-strong hover:bg-console-tinted',
  soft: 'bg-console-tinted text-console-text border-[1.5px] border-transparent hover:bg-console-border',
  ghost:
    'bg-transparent text-console-body border-[1.5px] border-transparent hover:bg-console-tinted hover:text-console-text',
  go: 'bg-console-go text-console-on-go border-[1.5px] border-transparent hover:brightness-95',
  danger:
    'bg-transparent text-console-danger border-[1.5px] border-console-danger hover:bg-console-danger-bg',
};

// The kit's button is 40px. `sm` is the same pill for table rows and toolbars,
// where a 40px control would set the row height.
const BTN_SIZES: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-[14px] gap-1.5',
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
      'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full font-semibold leading-5 transition-colors',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text',
      'disabled:cursor-not-allowed disabled:opacity-40',
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
    className={`overflow-hidden rounded-console-xl bg-console-surface shadow-console-card ${className}`}
  >
    {children}
  </div>
);

export const CardHeader = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-console-border px-5 py-3.5">
    {children}
  </div>
);

/**
 * A number with the scope it is true for. `scope` is not optional decoration:
 * 1,842 members means something different at a parish than at a region.
 */
export const MetricTile = ({
  label,
  value,
  change,
  scope,
  loading = false,
  className = '',
}: {
  label: string;
  /** Leave undefined when there is not enough data; the tile says so. */
  value?: ReactNode;
  change?: ReactNode;
  scope?: string;
  loading?: boolean;
  className?: string;
}) => (
  <div
    className={`flex flex-col items-start gap-1 rounded-console-xl bg-console-surface p-5 shadow-console-card ${className}`}
  >
    {loading ? (
      <>
        <Skeleton className="h-3 w-[90px]" />
        <Skeleton className="h-9 w-[120px]" />
        <Skeleton className="h-3.5 w-[140px]" />
      </>
    ) : (
      <>
        <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted">
          {label}
        </p>
        <p className="text-[32px] font-extrabold leading-10 tracking-[-0.02em] tabular-nums text-console-text">
          {value ?? '—'}
        </p>
        <p className="text-[14px] leading-5 text-console-body">
          {value === undefined ? 'Not enough data yet' : change}
        </p>
        {scope && (
          <p className="text-[12px] font-medium leading-4 text-console-muted">
            {scope}
          </p>
        )}
      </>
    )}
  </div>
);

// ─── Badges ───────────────────────────────────────────────────────────────────

type Tone = 'neutral' | 'action' | 'info' | 'caution' | 'danger' | 'success';

// The kit's status pill: a pop colour carries the state, the text stays ink.
// Danger is the exception, as in the kit's "Failed": error text on its surface.
const TONES: Record<Tone, string> = {
  neutral: 'bg-console-tinted text-console-muted',
  action: 'bg-pop-violet text-pop-on',
  info: 'bg-pop-sky text-pop-on',
  caution: 'bg-pop-amber text-pop-on',
  danger: 'bg-console-danger-bg text-console-danger',
  success: 'bg-pop-lime text-pop-on',
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
    className={`inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold leading-4 ${TONES[tone]}`}
  >
    {children}
  </span>
);

type PublishStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived';

// The kit's pipeline pills, one per value of the backend's
// PublishableMixin.Status. Colour and icon together, never colour alone.
const PUBLISH_PILLS: Record<
  PublishStatus,
  { label: string; tone: string; Icon: typeof Check }
> = {
  draft: { label: 'Draft', tone: 'bg-console-tinted text-console-body', Icon: FileText },
  in_review: { label: 'In review', tone: 'bg-console-info-bg text-console-info', Icon: Search },
  approved: { label: 'Approved', tone: 'bg-pop-lime text-pop-on', Icon: Check },
  scheduled: { label: 'Scheduled', tone: 'bg-pop-violet text-pop-on', Icon: CalendarDays },
  published: { label: 'Published', tone: 'bg-pop-green text-pop-on', Icon: Check },
  archived: { label: 'Archived', tone: 'bg-console-tinted text-console-muted', Icon: FileText },
};

/** Where a piece of content is in draft, review, approve, schedule, publish. */
export const PublishPill = ({ status }: { status: string }) => {
  const pill = PUBLISH_PILLS[status as PublishStatus];
  if (!pill) return <Badge>{status}</Badge>;
  return (
    <span
      className={`inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full pl-1.5 pr-2.5 text-[12px] font-semibold leading-4 ${pill.tone}`}
    >
      <pill.Icon size={14} strokeWidth={2.5} />
      {pill.label}
    </span>
  );
};

const AVATAR_COLOURS = [
  'bg-pop-pink',
  'bg-pop-sky',
  'bg-pop-amber',
  'bg-pop-violet',
  'bg-pop-lime',
  'bg-pop-green',
];

/**
 * Person avatar. Initials on a pop colour chosen from the name, so the same
 * person is the same colour on every screen. The Console never needs a photo
 * to identify someone.
 */
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
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-pop-on ${AVATAR_COLOURS[hash % AVATAR_COLOURS.length]}`}
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
    <table className="w-full border-collapse text-[14px] [&_tbody_tr:last-child_td]:border-b-0">
      {children}
    </table>
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
    className={`border-b border-console-border px-3 py-2.5 text-left text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted first:pl-5 last:pr-5 ${className}`}
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
  <td
    className={`border-b border-console-border px-3 py-3 align-middle first:pl-5 last:pr-5 ${className}`}
  >
    {children}
  </td>
);

// ─── States ───────────────────────────────────────────────────────────────────

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-full bg-console-skeleton ${className}`} />
);

/** Loading placeholder shaped like the table it replaces, to avoid a jump. */
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="px-5 py-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex h-16 items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-[26px] w-[110px]" />
      </div>
    ))}
  </div>
);

const EMPTY_ART = {
  plant: { art: ILLUSTRATIONS.plant, stage: 'bg-pop-lime' },
  sitting: { art: ILLUSTRATIONS.sitting, stage: 'bg-pop-sky' },
};

/**
 * Nothing to show. Distinct from "not built" (see the stubs' Placeholder) and
 * from "not yours to see" (see PermissionDenied) — conflating the three sends
 * people hunting for problems that do not exist.
 *
 * `plant` is for "nothing here yet", `sitting` for "not part of your role".
 * Pass `art={null}` where the state sits inside something small.
 */
export const EmptyState = ({
  title,
  message,
  action,
  art = 'plant',
}: {
  title?: string;
  message: string;
  action?: ReactNode;
  art?: keyof typeof EMPTY_ART | null;
}) => {
  const picture = art ? EMPTY_ART[art] : null;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      {picture && (
        <div
          className={`flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-full ${picture.stage}`}
          aria-hidden="true"
        >
          <div className="relative h-[150px] w-[150px]">
            <div className="absolute" style={{ inset: picture.art.inset }}>
              <img src={picture.art.src} alt="" className="block h-full w-full" />
            </div>
          </div>
        </div>
      )}
      {title && (
        <p className="text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
          {title}
        </p>
      )}
      <p className="max-w-sm text-[14px] leading-5 text-console-body">
        {message}
      </p>
      {action && <div className="mt-1 flex justify-center">{action}</div>}
    </div>
  );
};

type AlertKind = 'info' | 'caution' | 'error' | 'success';

const ALERT_KINDS: Record<AlertKind, { surface: string; icon: string }> = {
  info: { surface: 'bg-console-info-bg', icon: 'text-console-info' },
  caution: { surface: 'bg-console-caution-bg', icon: 'text-console-caution' },
  error: { surface: 'bg-console-danger-bg', icon: 'text-console-danger' },
  success: { surface: 'bg-console-success-bg', icon: 'text-console-success' },
};

/** Inline banner with an optional single action. */
export const AlertBanner = ({
  kind = 'info',
  children,
  action,
  className = '',
}: {
  kind?: AlertKind;
  children: ReactNode;
  /** One button at most, usually a `soft` Btn at size `md`. */
  action?: ReactNode;
  className?: string;
}) => {
  const Icon = kind === 'success' ? Check : AlertCircle;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`flex items-center gap-2.5 rounded-console-lg py-3 pl-3 pr-3.5 ${ALERT_KINDS[kind].surface} ${className}`}
    >
      <Icon size={20} className={`shrink-0 ${ALERT_KINDS[kind].icon}`} />
      <p className="min-w-0 flex-1 text-[14px] leading-5 text-console-text">
        {children}
      </p>
      {action}
    </div>
  );
};

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="p-4">
    <AlertBanner
      kind="error"
      action={
        onRetry && (
          <Btn variant="soft" size="md" onClick={onRetry}>
            Try again
          </Btn>
        )
      }
    >
      {message}
    </AlertBanner>
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
        className="flex w-full flex-col gap-3.5 rounded-[32px] bg-console-raised p-6 shadow-console-dialog"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold leading-7 tracking-[-0.01em] text-console-text">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[14px] leading-5 text-console-body">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-console-muted transition-colors hover:bg-console-tinted hover:text-console-text"
          >
            <X size={18} />
          </button>
        </div>

        <div className="console-scroll -mx-1 max-h-[65vh] overflow-y-auto px-1">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2">{footer}</div>
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
  <div role="tablist" className="mb-4 flex flex-wrap items-center gap-2">
    {tabs.map((t) => (
      <button
        key={t.id}
        role="tab"
        aria-selected={active === t.id}
        onClick={() => onChange(t.id)}
        className={[
          'inline-flex h-10 items-center gap-1 rounded-full text-[14px] font-semibold leading-5 transition-colors',
          active === t.id
            ? 'bg-console-action pl-3 pr-4 text-console-on-action'
            : 'bg-console-tinted px-4 text-console-text hover:bg-console-border',
        ].join(' ')}
      >
        {active === t.id && <Check size={16} strokeWidth={2.5} />}
        {t.label}
        {typeof t.count === 'number' && (
          <span className="text-[12px] font-medium tabular-nums opacity-70">
            {t.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

// ─── Status pills ─────────────────────────────────────────────────────────────

type PillSpec = { label: string; tone: string; Icon?: typeof Check };

const NEUTRAL_PILL = 'bg-console-tinted text-console-muted';

// EventRegistration.Status, as the kit draws each one.
const REGISTRATION_PILLS: Record<string, PillSpec> = {
  pending: { label: 'Pending', tone: 'bg-pop-amber text-pop-on', Icon: AlertCircle },
  confirmed: { label: 'Confirmed', tone: 'bg-pop-green text-pop-on', Icon: Check },
  waitlisted: { label: 'Waitlisted', tone: 'bg-pop-sky text-pop-on', Icon: Users },
  checked_in: { label: 'Checked in', tone: 'bg-pop-lime text-pop-on', Icon: ScanLine },
  attended: { label: 'Attended', tone: 'bg-pop-lime text-pop-on', Icon: Check },
  cancelled: { label: 'Cancelled', tone: NEUTRAL_PILL, Icon: X },
  no_show: { label: 'No show', tone: NEUTRAL_PILL, Icon: Minus },
};

// EventRegistration.PaymentStatus.
const PAYMENT_PILLS: Record<string, PillSpec> = {
  not_required: { label: 'Not required', tone: NEUTRAL_PILL, Icon: Minus },
  pending: { label: 'Payment pending', tone: 'bg-pop-amber text-pop-on', Icon: AlertCircle },
  paid: { label: 'Paid', tone: 'bg-pop-green text-pop-on', Icon: Check },
  refunded: { label: 'Refunded', tone: 'bg-pop-violet text-pop-on', Icon: Minus },
  failed: { label: 'Failed', tone: 'bg-console-danger-bg text-console-danger', Icon: AlertCircle },
};

const Pill = ({ spec, fallback }: { spec?: PillSpec; fallback: string }) => {
  if (!spec) return <Badge>{fallback.replace(/_/g, ' ')}</Badge>;
  return (
    <span
      className={`inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full pr-2.5 text-[12px] font-semibold leading-4 ${spec.Icon ? 'pl-1.5' : 'pl-2.5'} ${spec.tone}`}
    >
      {spec.Icon && <spec.Icon size={14} strokeWidth={2.5} />}
      {spec.label}
    </span>
  );
};

/** Where a registration stands. Colour and icon together, never colour alone. */
export const RegistrationPill = ({ status }: { status: string }) => (
  <Pill spec={REGISTRATION_PILLS[status]} fallback={status} />
);

/** What has happened to the money for a registration. */
export const PaymentPill = ({ status }: { status: string }) => (
  <Pill spec={PAYMENT_PILLS[status]} fallback={status} />
);

/** Which part of the church something belongs to; `null` means all of it. */
export const ScopePill = ({ name }: { name: string | null | undefined }) => (
  <span
    className={`inline-flex h-[26px] max-w-full shrink-0 items-center gap-1 rounded-full pl-1.5 pr-2.5 text-[12px] font-semibold leading-4 text-pop-on ${name ? 'bg-pop-sky' : 'bg-pop-amber'}`}
  >
    <GitBranch size={14} strokeWidth={2.5} className="shrink-0" />
    <span className="truncate">{name ?? 'Everyone'}</span>
  </span>
);

/** A page of a list: what is showing, and the way to the next one. */
export const Pager = ({
  page,
  pageSize,
  count,
  shown,
  noun,
  where,
  onPage,
}: {
  page: number;
  pageSize: number;
  count: number;
  shown: number;
  /** Plural, as it reads after the total: "members", "events". */
  noun: string;
  where?: string;
  onPage: (page: number) => void;
}) => {
  const first = (page - 1) * pageSize + 1;
  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-2 border-t border-console-border px-5 py-1.5">
      <p className="min-w-0 flex-1 text-[14px] leading-5 text-console-muted">
        Showing {first.toLocaleString()}–{(first + shown - 1).toLocaleString()} of{' '}
        {count.toLocaleString()} {noun}
        {where ? ` in ${where}` : ''}
      </p>
      <Btn variant="soft" size="md" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Btn>
      <Btn
        variant="soft"
        size="md"
        disabled={page * pageSize >= count}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Btn>
    </div>
  );
};

/** A search field for the row above a table. The caller debounces. */
export const SearchField = ({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  /** For screen readers; the placeholder is not a label. */
  label: string;
  placeholder: string;
}) => (
  <label className="flex h-10 w-full items-center gap-2 rounded-full bg-console-tinted px-4 focus-within:outline focus-within:outline-2 focus-within:outline-console-text sm:w-72">
    <Search size={16} className="shrink-0 text-console-muted" />
    <span className="sr-only">{label}</span>
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-w-0 bg-transparent text-[14px] text-console-text outline-none placeholder:text-console-muted"
    />
  </label>
);
