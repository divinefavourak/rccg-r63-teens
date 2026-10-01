/**
 * Request a password reset link.
 *
 * The success state is shown **whether or not the email exists**, matching the
 * backend, which deliberately never confirms whether an address is registered.
 * Saying "no account with that email" would turn this form into a way to test
 * whether a given person is in the congregation.
 *
 * That is why the failure branch also sets `sent`: an error here would leak the
 * same thing by omission.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../api/axios';
import AuthShell, {
  authButton,
  authInput,
  authLabel,
} from '../components/AuthShell';
import Loader from '../components/Loader';
import Seo from '../components/Seo';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/', {
        email: email.trim().toLowerCase(),
      });
    } catch {
      // Intentionally swallowed — see the module docstring. The user sees the
      // same outcome either way.
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="If that address is registered, a reset link is on its way."
      >
        <div className="text-center">
          <CheckCircle
            size={36}
            className="mx-auto mb-3 text-console-success"
            aria-hidden="true"
          />
          <p className="text-[13px] leading-relaxed text-console-body">
            The link expires shortly, so use it soon. If nothing arrives in a few
            minutes, check your spam folder — and make sure you used the address
            you registered with.
          </p>
          <Link to="/login" className={authButton}>
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <>
      <Seo title="Reset your password" description="Request a password reset link." noindex />
    <AuthShell
      title="Forgot your password?"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium text-console-action hover:underline"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="email" className={authLabel}>
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={authInput}
        />

        <button type="submit" disabled={loading} className={authButton}>
          {loading ? (
            <Loader variant="inline" size={16} label="Sending…" />
          ) : (
            'Send reset link'
          )}
        </button>
      </form>
    </AuthShell>
    </>
  );
};

export default ForgotPassword;
