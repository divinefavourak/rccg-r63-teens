/**
 * Coordinator sign-in.
 *
 * Rewritten for three reasons, only one of them cosmetic:
 *
 * 1. **It could not have worked.** It called `login(username, password)` as two
 *    arguments, but `AuthContext.login` takes a single credentials object — so
 *    the POST body was a bare string and the request could only fail. It then
 *    checked `if (success)` on a function returning `void`, which is always
 *    falsy, so even a successful sign-in reported "Invalid credentials".
 * 2. **It printed a shared default password** on a public, unauthenticated page.
 *    Removed. See the note in the commit/handover — any account still using it
 *    should be treated as compromised and rotated.
 * 3. The dark-red "portal" styling predated the current brand.
 *
 * Redirection stays in the effect rather than after `login()`: the auth context
 * updates asynchronously, and navigating before it settles races the
 * `ProtectedRoute` on the destination.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/Loader';
import { BRAND } from '../constants/brand';
import Seo from '../components/Seo';

const rccgLogo = BRAND.rccg;
const faithLogo = BRAND.faith;

const CoordinatorLogin = () => {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    if (user.role === 'coordinator') {
      navigate('/coordinator/dashboard', { replace: true });
    } else if (user.role === 'admin') {
      // /admin is the Console now; /admin/dashboard no longer exists.
      navigate('/admin', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      // One object, not two arguments — this was the bug.
      await login({
        username: formData.username,
        password: formData.password,
      });
      // The effect above redirects once the context settles.
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      setError(
        status === 401 || status === 400
          ? 'That ID and password do not match.'
          : 'We could not reach the server. Check your connection and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Seo title="Coordinator login" description="Sign in as a coordinator." noindex />
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
              src={faithLogo}
              alt="Faith Tribe"
              className="h-11 w-11 rounded-full object-cover"
            />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-console-text">
            Coordinator sign-in
          </h1>
          <p className="mt-1 text-[14px] text-console-muted">
            Use the ID you were given for your province.
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
            Province ID or email
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

          <label
            htmlFor="password"
            className="mt-4 block text-[12px] font-medium text-console-body"
          >
            Password
          </label>
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
            disabled={isSubmitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-console-md bg-console-action py-3 text-[14px] font-medium text-white transition-colors hover:bg-console-action-hover disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader variant="inline" size={16} label="Signing in…" />
            ) : (
              'Sign in'
            )}
          </button>

          <p className="mt-4 text-center text-[12px] leading-relaxed text-console-subtle">
            Don't know your ID? Ask the coordinator who set up your province — it
            is not something we can send by email.
          </p>
        </form>
      </div>
    </div>
    </>
  );
};

export default CoordinatorLogin;
