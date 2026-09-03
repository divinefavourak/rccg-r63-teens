/**
 * Set a new password from an emailed link.
 *
 * Three states, kept distinct because they need three different actions from the
 * user: the link is broken (request a new one), the form (set a password), and
 * done (sign in).
 *
 * The auto-redirect after success is kept but is no longer the only way out — a
 * three-second timer that fires while someone is still reading is a trap if it
 * is the sole exit.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';
import AuthShell, {
  AuthError,
  authButton,
  authInput,
  authLabel,
} from '../components/AuthShell';
import Loader from '../components/Loader';
import Seo from '../components/Seo';

const MIN_LENGTH = 8;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const invalidLink = !uid || !token;

  // Cleared on unmount so a redirect that already happened cannot fire twice.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate('/login', { replace: true }), 4000);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(`Your password needs at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password/', {
        uid,
        token,
        new_password: password,
      });
      setDone(true);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(
        detail ??
          'This reset link is no longer valid. Request a new one and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (invalidLink) {
    return (
      <AuthShell
        title="That link doesn't work"
        subtitle="It may have expired, or been copied incompletely."
      >
        <div className="text-center">
          <AlertCircle
            size={36}
            className="mx-auto mb-3 text-console-danger"
            aria-hidden="true"
          />
          <p className="text-[13px] leading-relaxed text-console-body">
            Reset links are single-use and expire quickly. Requesting a fresh one
            takes a moment.
          </p>
          <Link to="/forgot-password" className={authButton}>
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        title="Password changed"
        subtitle="You can sign in with it now."
      >
        <div className="text-center">
          <CheckCircle
            size={36}
            className="mx-auto mb-3 text-console-success"
            aria-hidden="true"
          />
          <p className="text-[13px] leading-relaxed text-console-body">
            Taking you to the sign-in page in a moment.
          </p>
          <Link to="/login" className={authButton}>
            Go there now
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <>
      <Seo title="Set a new password" description="Choose a new password for your account." noindex />
    <AuthShell
      title="Set a new password"
      subtitle={`At least ${MIN_LENGTH} characters.`}
      footer={
        <Link
          to="/login"
          className="font-medium text-console-action hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      {error && <AuthError message={error} />}

      <form onSubmit={handleSubmit}>
        <label htmlFor="password" className={authLabel}>
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={`${authInput} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
            className="absolute right-2 top-[calc(50%+3px)] -translate-y-1/2 rounded-console-sm p-1.5 text-console-subtle transition-colors hover:text-console-body"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {/* Inline as they type, not on submit — telling someone their password
            is too short only after they have typed it twice is unkind. */}
        {tooShort && (
          <p className="mt-1 text-[12px] text-console-caution">
            {MIN_LENGTH - password.length} more character
            {MIN_LENGTH - password.length === 1 ? '' : 's'} needed.
          </p>
        )}

        <label htmlFor="confirm" className={`${authLabel} mt-4`}>
          Confirm it
        </label>
        <input
          id="confirm"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={authInput}
        />
        {mismatch && (
          <p className="mt-1 text-[12px] text-console-caution">
            These don't match yet.
          </p>
        )}

        <button
          type="submit"
          disabled={loading || tooShort || mismatch}
          className={authButton}
        >
          {loading ? (
            <Loader variant="inline" size={16} label="Saving…" />
          ) : (
            'Set new password'
          )}
        </button>
      </form>
    </AuthShell>
    </>
  );
};

export default ResetPassword;
