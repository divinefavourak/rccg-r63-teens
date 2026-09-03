/**
 * Console sign-in.
 *
 * Restyled to the Console's own design language rather than the teen app's, on
 * the principle that the sign-in screen should look like the thing you are
 * signing in to. The previous version was a dark glass card with a neon glow and
 * "ENTER DASHBOARD" in caps, which set an expectation the Console does not meet.
 *
 * Two behavioural fixes alongside the styling:
 *
 * 1. It used to redirect to `/admin/dashboard`, which stopped existing when
 *    `/admin` became the Console. It now goes to `/admin`.
 * 2. It honours the location `ProtectedRoute` stashes in `state.from`, so a deep
 *    link into the Console survives the trip through sign-in instead of dumping
 *    everyone on the Overview.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/Loader';
import Seo from '../components/Seo';

interface FromState {
  from?: { pathname?: string };
}

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where they were headed before being asked to sign in.
  const intended =
    (location.state as FromState | null)?.from?.pathname ?? '/admin';

  useEffect(() => {
    if (isAuthenticated) navigate(intended, { replace: true });
  }, [isAuthenticated, navigate, intended]);

  if (isAuthenticated) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    toast.dismiss();

    try {
      await login({
        username: formData.username,
        password: formData.password,
      });
      // Navigation is handled by the effect above once isAuthenticated flips.
    } catch (err: unknown) {
      // Inline, not a toast. A sign-in failure belongs next to the fields that
      // caused it, and a toast disappears before a slow reader has finished it.
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      setError(
        status === 401
          ? 'That username and password do not match.'
          : 'Could not sign you in. Check your connection and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Seo title="Console login" description="Sign in to the Faith Tribe Console." noindex />
    <div className="flex min-h-screen items-center justify-center bg-console-canvas px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 text-center">
          <h1 className="text-[20px] font-semibold tracking-tight text-console-text">
            Faith Tribe{' '}
            <span className="font-normal text-console-muted">Console</span>
          </h1>
          <p className="mt-1 text-[13px] text-console-muted">
            Sign in to manage your part of the church.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-console-lg border border-console-border bg-console-surface p-5"
        >
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger"
            >
              {error}
            </div>
          )}

          <label
            htmlFor="username"
            className="block text-[11px] font-medium text-console-body"
          >
            Username or email
          </label>
          <div className="relative mt-1">
            <User
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-console-subtle"
            />
            <input
              id="username"
              type="text"
              name="username"
              autoComplete="username"
              value={formData.username}
              onChange={handleChange}
              required
              autoFocus
              className="w-full rounded-console-md border border-console-border bg-console-canvas py-2 pl-8 pr-3 text-[13px] text-console-text outline-none transition-colors focus:border-console-action"
            />
          </div>

          <label
            htmlFor="password"
            className="mt-4 block text-[11px] font-medium text-console-body"
          >
            Password
          </label>
          <div className="relative mt-1">
            <Lock
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-console-subtle"
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full rounded-console-md border border-console-border bg-console-canvas py-2 pl-8 pr-10 text-[13px] text-console-text outline-none transition-colors focus:border-console-action"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-console-sm p-1 text-console-subtle transition-colors hover:text-console-body"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-console-md bg-console-action py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-console-action-hover disabled:opacity-60"
          >
            {isLoading ? (
              <Loader variant="inline" size={15} label="Signing in…" />
            ) : (
              'Sign in'
            )}
          </button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-console-subtle">
            What you can see and do here is decided by the role you have been
            given. If something is missing, ask whoever appointed you.
          </p>
        </form>
      </div>
    </div>
    </>
  );
};

export default AdminLogin;
