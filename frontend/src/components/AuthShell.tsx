/**
 * Shared frame for every sign-in / sign-up / recovery page.
 *
 * There are five of these (login, coordinator login, register, forgot password,
 * reset password) and they were drifting apart — three carried the "glow"
 * treatment, two did not, and each had its own logo markup. A user moving from
 * Login to Forgot Password should not feel like they changed products
 * mid-recovery.
 *
 * Deliberately not in `components/console/`: these pages are the door for
 * everyone, teens included, so they sit one step warmer and more spacious than
 * the Console's dense working screens even though they draw on the same tokens.
 */
import type { ReactNode } from 'react';
import { BRAND } from '../constants/brand';

const faithTribeLogo = BRAND.faithTribe;
const rccgLogo = BRAND.rccg;

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered under the card — sign-up prompts, "back to login", etc. */
  footer?: ReactNode;
  /** Wider for the multi-field registration form. */
  width?: number;
}

export const AuthShell = ({
  title,
  subtitle,
  children,
  footer,
  width = 400,
}: AuthShellProps) => (
  <div className="flex min-h-screen items-center justify-center bg-console-canvas px-4 py-10">
    <div className="w-full" style={{ maxWidth: width }}>
      <div className="mb-7 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <img
            src={rccgLogo}
            alt="RCCG"
            className="h-11 w-11 rounded-full object-cover"
          />
          <img
            src={faithTribeLogo}
            alt="Faith Tribe"
            className="h-11 w-11 rounded-full object-cover"
          />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-console-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[14px] leading-relaxed text-console-muted">
            {subtitle}
          </p>
        )}
      </div>

      <div className="rounded-console-xl border border-console-border bg-console-surface p-6">
        {children}
      </div>

      {footer && (
        <div className="mt-5 text-center text-[13px] text-console-muted">
          {footer}
        </div>
      )}
    </div>
  </div>
);

/** Shared input styling, so a field looks the same on every auth page. */
export const authInput =
  'mt-1.5 w-full rounded-console-md border border-console-border bg-console-canvas px-3 py-2.5 text-[14px] text-console-text outline-none transition-colors focus:border-console-action';

export const authLabel = 'block text-[12px] font-medium text-console-body';

export const authButton =
  'mt-6 flex w-full items-center justify-center gap-2 rounded-console-md bg-console-action py-3 text-[14px] font-medium text-white transition-colors hover:bg-console-action-hover disabled:opacity-60';

/** An error the user needs to read and act on — never a toast. */
export const AuthError = ({ message }: { message: string }) => (
  <div
    role="alert"
    className="mb-4 rounded-console-md bg-console-danger-bg px-3 py-2.5 text-[13px] leading-relaxed text-console-danger"
  >
    {message}
  </div>
);

export default AuthShell;
