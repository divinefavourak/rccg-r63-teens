/**
 * Main sign-in — the door for everyone.
 *
 * Replaces the "glow" treatment (neon box, ✦/♥ glyphs, `GlowAuth.css`), which
 * looked like a different product from the app behind it and fought the brand's
 * own palette.
 *
 * Kept deliberately warmer and more spacious than the Console's sign-in: this is
 * the teen-facing door. Same tokens, different rhythm.
 *
 * Two behavioural fixes:
 *
 * 1. It routed admins to `/admin/dashboard`, which stopped existing when
 *    `/admin` became the Console. Now `/admin`.
 * 2. Failures were a toast that vanished before a slow reader finished it. The
 *    error is now inline, next to the fields that caused it, and it
 *    distinguishes a wrong password from an unreachable server — one is the
 *    user's problem to fix, the other is not.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import Loader from '../components/Loader';
import { BRAND } from '../constants/brand';
import Seo from '../components/Seo';

const faithTribeLogo = BRAND.faithTribe;
const rccgLogo = BRAND.rccg;

interface FromState {
  from?: { pathname?: string };
}

const Login = () => {
  const { login } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intended = (location.state as FromState | null)?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(formData);

      // Where they were trying to go beats where their role would send them.
      if (intended) {
        navigate(intended, { replace: true });
        return;
      }

      const stored = localStorage.getItem('rccg_user');
      const role = stored ? JSON.parse(stored)?.role : null;
      if (role === 'admin') navigate('/admin', { replace: true });
      else if (role === 'coordinator')
        navigate('/coordinator/dashboard', { replace: true });
      else navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      setError(
        status === 401 || status === 400
          ? 'That username and password do not match.'
          : 'We could not reach the server. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Seo title="Log in" description="Log in to your Faith Tribe account." noindex />
    <div className="flex min-h-screen items-center justify-center bg-console-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
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
            Welcome back
          </h1>
          <p className="mt-1 text-[14px] text-console-muted">
            Sign in to pick up where you left off.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-console-xl border border-console-border bg-console-surface p-6"
        >
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-console-md bg-console-danger-bg px-3 py-2.5 text-[13px] text-console-danger"
            >
              {error}
            </div>
          )}

          <label
            htmlFor="username"
            className="block text-[12px] font-medium text-console-body"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoFocus
            value={formData.username}
            onChange={(e) => {
              setFormData({ ...formData, username: e.target.value });
              setError(null);
            }}
            required
            className="mt-1.5 w-full rounded-console-md border border-console-border bg-console-canvas px-3 py-2.5 text-[14px] text-console-text outline-none transition-colors focus:border-console-action"
          />

          <div className="mt-4 flex items-baseline justify-between">
            <label
              htmlFor="password"
              className="text-[12px] font-medium text-console-body"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[12px] text-console-action hover:underline"
            >
              Forgot it?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                setError(null);
              }}
              required
              className="w-full rounded-console-md border border-console-border bg-console-canvas px-3 py-2.5 pr-11 text-[14px] text-console-text outline-none transition-colors focus:border-console-action"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-console-sm p-1.5 text-console-subtle transition-colors hover:text-console-body"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-console-md bg-console-action py-3 text-[14px] font-medium text-white transition-colors hover:bg-console-action-hover disabled:opacity-60"
          >
            {loading ? (
              <Loader variant="inline" size={16} label="Signing in…" />
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-console-muted">
          New here?{' '}
          <Link
            to="/register"
            className="font-medium text-console-action hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
    </>
  );
};

export default Login;
