/**
 * Create an account.
 *
 * Three steps, because asking for ten fields on one screen is how sign-ups get
 * abandoned. The step state is local rather than the shared `Stepper` component:
 * that component's CSS hardcodes a dark navy palette, and Register was its only
 * consumer, so inlining the behaviour was cheaper than retheming it.
 *
 * Validation is **inline and per-field**, not toasts. A toast that says
 * "Passwords don't match" and then vanishes leaves the user staring at two
 * fields with no indication which one to fix.
 *
 * NOTE — `PROVINCES` is a hardcoded list of seven Lagos strings. This is the
 * hard-coded region the backend audit flagged: the real hierarchy is a seven-
 * level tree (`hierarchy.HierarchyNode`) and registration should eventually pick
 * a node from it. Left as-is here because changing it means changing what the
 * registration endpoint accepts, which is a backend change, not a styling one.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import AuthShell, {
  AuthError,
  authButton,
  authInput,
  authLabel,
} from '../components/AuthShell';
import Loader from '../components/Loader';
import Seo from '../components/Seo';
import { todayISO } from '../utils/dates';

const PROVINCES = [
  { value: 'lagos_province_9', label: 'Lagos Province 9' },
  { value: 'lagos_province_28', label: 'Lagos Province 28' },
  { value: 'lagos_province_69', label: 'Lagos Province 69' },
  { value: 'lagos_province_84', label: 'Lagos Province 84' },
  { value: 'lagos_province_86', label: 'Lagos Province 86' },
  { value: 'lagos_province_104', label: 'Lagos Province 104' },
  { value: 'regional_hq', label: 'Regional Headquarter' },
];

const STEPS = ['About you', 'Your church', 'Sign-in details'];

/** Shown as soon as a birthday is entered, so the band is never a surprise. */
function computeAgeGroup(dob: string): { label: string; eligible: boolean } | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;

  if (age < 6) return { label: 'Under 6 — not yet eligible to join', eligible: false };
  if (age <= 8) return { label: 'Children (6–8)', eligible: true };
  if (age <= 12) return { label: 'Pre-teen (9–12)', eligible: true };
  if (age <= 19) return { label: 'Teen (13–19)', eligible: true };
  return { label: 'Superteen (19+)', eligible: true };
}

const MIN_PASSWORD = 8;

const Register = () => {
  const { register } = useAuthContext();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    province: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageGroup = useMemo(
    () => computeAgeGroup(formData.date_of_birth),
    [formData.date_of_birth],
  );

  const set = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const mismatch =
    formData.password_confirm.length > 0 &&
    formData.password !== formData.password_confirm;
  const tooShort =
    formData.password.length > 0 && formData.password.length < MIN_PASSWORD;

  /** What is still missing on this step — drives the button, not a toast. */
  const blockers = useMemo(() => {
    if (step === 0) {
      const out: string[] = [];
      if (!formData.first_name.trim()) out.push('first name');
      if (!formData.last_name.trim()) out.push('last name');
      return out;
    }
    if (step === 1) {
      return formData.username.trim() ? [] : ['a username'];
    }
    const out: string[] = [];
    if (!formData.email.trim()) out.push('email');
    if (formData.password.length < MIN_PASSWORD) out.push('a longer password');
    if (formData.password !== formData.password_confirm)
      out.push('matching passwords');
    return out;
  }, [step, formData]);

  const canContinue = blockers.length === 0;

  const submit = async () => {
    if (loading || !canContinue) return;
    setLoading(true);
    setError(null);
    try {
      await register(formData);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })
        ?.response?.data;
      // DRF returns {field: [message]}; naming the field beats "Registration
      // failed" when the cause is usually "that username is taken".
      if (data && typeof data === 'object') {
        const [field, value] = Object.entries(data)[0] ?? [];
        const msg = Array.isArray(value) ? String(value[0]) : String(value);
        setError(field && field !== 'detail' ? `${field}: ${msg}` : msg);
      } else {
        setError('Could not create your account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Seo title="Create your account" description="Join the Faith Tribe — daily devotionals, Bible study manuals and events." noindex />
    <AuthShell
      title="Join Faith Tribe"
      subtitle={STEPS[step]}
      width={440}
      footer={
        step === 0 ? (
          <>
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-console-action hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : null
      }
    >
      {/* Progress. Three dots rather than a bar — with so few steps, a bar's
          precision implies more distance than there is. */}
      <div className="mb-5 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                i < step
                  ? 'bg-console-action text-white'
                  : i === step
                    ? 'bg-console-action-light text-console-action ring-1 ring-console-action'
                    : 'bg-console-tinted text-console-subtle'
              }`}
            >
              {i < step ? <Check size={11} /> : i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px flex-1 ${i < step ? 'bg-console-action' : 'bg-console-border'}`}
              />
            )}
          </div>
        ))}
      </div>

      {error && <AuthError message={error} />}

      {step === 0 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="first_name" className={authLabel}>
                First name
              </label>
              <input
                id="first_name"
                autoFocus
                autoComplete="given-name"
                value={formData.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                className={authInput}
              />
            </div>
            <div>
              <label htmlFor="last_name" className={authLabel}>
                Last name
              </label>
              <input
                id="last_name"
                autoComplete="family-name"
                value={formData.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                className={authInput}
              />
            </div>
          </div>

          <div>
            <label htmlFor="gender" className={authLabel}>
              Gender <span className="text-console-subtle">(optional)</span>
            </label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => set('gender', e.target.value)}
              className={authInput}
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div>
            <label htmlFor="dob" className={authLabel}>
              Date of birth{' '}
              <span className="text-console-subtle">(optional)</span>
            </label>
            <input
              id="dob"
              type="date"
              max={todayISO()}
              value={formData.date_of_birth}
              onChange={(e) => set('date_of_birth', e.target.value)}
              className={authInput}
            />
            {ageGroup && (
              <p
                className={`mt-1.5 text-[12px] ${
                  ageGroup.eligible
                    ? 'text-console-action'
                    : 'text-console-caution'
                }`}
              >
                {ageGroup.label}
              </p>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="province" className={authLabel}>
              Province <span className="text-console-subtle">(optional)</span>
            </label>
            <select
              id="province"
              autoFocus
              value={formData.province}
              onChange={(e) => set('province', e.target.value)}
              className={authInput}
            >
              <option value="">I'm not sure yet</option>
              {PROVINCES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-console-subtle">
              You can change this later, or ask your teacher.
            </p>
          </div>

          <div>
            <label htmlFor="phone" className={authLabel}>
              Phone <span className="text-console-subtle">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+234 801 234 5678"
              value={formData.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={authInput}
            />
          </div>

          <div>
            <label htmlFor="username" className={authLabel}>
              Username
            </label>
            <input
              id="username"
              autoComplete="username"
              value={formData.username}
              onChange={(e) => set('username', e.target.value)}
              className={authInput}
            />
            <p className="mt-1 text-[12px] text-console-subtle">
              This is how other members will see you.
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className={authLabel}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              value={formData.email}
              onChange={(e) => set('email', e.target.value)}
              className={authInput}
            />
          </div>

          <div>
            <label htmlFor="password" className={authLabel}>
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => set('password', e.target.value)}
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
            {tooShort && (
              <p className="mt-1 text-[12px] text-console-caution">
                {MIN_PASSWORD - formData.password.length} more character
                {MIN_PASSWORD - formData.password.length === 1 ? '' : 's'} needed.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password_confirm" className={authLabel}>
              Confirm password
            </label>
            <input
              id="password_confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formData.password_confirm}
              onChange={(e) => set('password_confirm', e.target.value)}
              className={authInput}
            />
            {mismatch && (
              <p className="mt-1 text-[12px] text-console-caution">
                These don't match yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-console-md border border-console-border px-3.5 py-3 text-[14px] font-medium text-console-body transition-colors hover:bg-console-tinted disabled:opacity-60"
          >
            <ArrowLeft size={15} /> Back
          </button>
        )}
        <button
          type="button"
          disabled={!canContinue || loading}
          onClick={() => (step < 2 ? setStep((s) => s + 1) : submit())}
          className={`${authButton} mt-0 flex-1`}
        >
          {loading ? (
            <Loader variant="inline" size={16} label="Creating your account…" />
          ) : step < 2 ? (
            'Continue'
          ) : (
            'Create account'
          )}
        </button>
      </div>

      {/* Says what is missing rather than just disabling the button, so nobody
          has to guess why they cannot move on. */}
      {!canContinue && (
        <p className="mt-2 text-center text-[12px] text-console-subtle">
          Still needed: {blockers.join(', ')}.
        </p>
      )}
    </AuthShell>
    </>
  );
};

export default Register;
