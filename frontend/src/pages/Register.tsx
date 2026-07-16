import { useState, useMemo } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader } from 'lucide-react';
import faithTribeLogo from '../assets/faith_tribe_logo.jpg';
import rccgLogo from '../assets/logo.jpg';
import Stepper, { Step } from '../components/Stepper';
import './GlowAuth.css';

const PROVINCES = [
    { value: 'lagos_province_9',   label: 'Lagos Province 9' },
    { value: 'lagos_province_28',  label: 'Lagos Province 28' },
    { value: 'lagos_province_69',  label: 'Lagos Province 69' },
    { value: 'lagos_province_84',  label: 'Lagos Province 84' },
    { value: 'lagos_province_86',  label: 'Lagos Province 86' },
    { value: 'lagos_province_104', label: 'Lagos Province 104' },
    { value: 'regional_hq',        label: 'Regional Headquarter' },
];

function computeAgeGroup(dob: string): { label: string; color: string } | null {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    if (age < 6)  return { label: 'Toddler (under 6) — not yet eligible', color: '#888' };
    if (age <= 8)  return { label: 'Children (6–8)', color: '#a855f7' };
    if (age <= 12) return { label: 'Pre-Teen (9–12)', color: '#3b82f6' };
    if (age <= 19) return { label: 'Teen (13–19)', color: '#F59E0B' };
    return { label: 'Superteen (19+)', color: '#10b981' };
}

/* ─── Step heading helper ──────────────────────────────────────────────────── */
const StepHeading = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', color: '#F59E0B', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            {subtitle}
        </p>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>{title}</h2>
    </div>
);

const Register = () => {
    const { register } = useAuthContext();
    const navigate = useNavigate();

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
    const [showConfirm, setShowConfirm] = useState(false);

    const ageGroupPreview = useMemo(() => computeAgeGroup(formData.date_of_birth), [formData.date_of_birth]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    /* Per-step validation — drives Next button disabled state */
    const validateCurrentStep = (step: number) => {
        if (step === 1 && (!formData.first_name.trim() || !formData.last_name.trim())) {
            toast.error('Please enter your first and last name to continue.');
            return false;
        }

        if (step === 2 && !formData.username.trim()) {
            toast.error('Please choose a username to continue.');
            return false;
        }

        if (step === 3) {
            if (!formData.email.trim()) {
                toast.error('Please enter your email address to continue.');
                return false;
            }

            if (formData.password.length < 8) {
                toast.error('Password must be at least 8 characters long.');
                return false;
            }

            if (!formData.password_confirm.trim()) {
                toast.error('Please confirm your password to continue.');
                return false;
            }

            if (formData.password !== formData.password_confirm) {
                toast.error("Passwords don't match.");
                return false;
            }
        }

        return true;
    };

    const passwordMismatch =
        formData.password_confirm.length > 0 && formData.password !== formData.password_confirm;

    const handleSubmit = async () => {
        if (loading || !validateCurrentStep(3)) return;
        setLoading(true);
        try {
            await register(formData);
            toast.success('Account created! Welcome to Faith Tribe 🎉');
            navigate('/dashboard');
        } catch (error: unknown) {
            const data =
                typeof error === 'object' &&
                error !== null &&
                'response' in error &&
                typeof error.response === 'object' &&
                error.response !== null &&
                'data' in error.response
                    ? (error.response.data as Record<string, unknown> | undefined)
                    : undefined;
            if (data) {
                const firstError = Object.values(data)[0];
                const msg = Array.isArray(firstError) ? firstError[0] : String(firstError);
                toast.error(msg || 'Registration failed');
            } else {
                toast.error('Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    /* Shared input style (matches glow aesthetic for dark bg) */
    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 18px',
        outline: 'none',
        fontSize: '0.88rem',
        color: '#fff',
        background: 'rgba(255,255,255,0.06)',
        border: '1.5px solid rgba(255,255,255,0.18)',
        borderRadius: '30px',
        fontFamily: 'Poppins, sans-serif',
        transition: 'border-color 0.3s',
        boxSizing: 'border-box',
    };

    const selectStyle: React.CSSProperties = {
        ...inputStyle,
        background: '#0a1628',
        appearance: 'none' as const,
        cursor: 'pointer',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '0.72rem',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: '5px',
        paddingLeft: '4px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase' as const,
    };

    const fieldGap = { display: 'flex', flexDirection: 'column' as const, gap: '0.9rem' };

    return (
        /* glow-page provides the dark background; the Stepper outer-container handles all scroll/layout */
        <div style={{ minHeight: '100vh', background: '#0a0f1a', fontFamily: 'Poppins, sans-serif' }}>
            <Stepper
                initialStep={1}
                onFinalStepCompleted={handleSubmit}
                validateStep={validateCurrentStep}
                disableStepIndicators
                backButtonText="← Back"
                nextButtonText="Continue →"
                nextButtonProps={{ disabled: loading }}
            >
                {/* ── Step 1: About You ──────────────────────────────────── */}
                <Step>
                    {/* Logos + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <img src={rccgLogo} alt="RCCG" className="glow-logo-sm" />
                        <img src={faithTribeLogo} alt="Faith Tribe" className="glow-logo-sm" />
                        <div>
                            <h1 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                FAITH TRIBE
                            </h1>
                            <p style={{ fontSize: '0.68rem', color: '#F59E0B', fontWeight: 700, margin: 0, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                Create Account
                            </p>
                        </div>
                    </div>

                    <StepHeading title="Tell us about you" subtitle="Step 1 of 3 — Personal" />

                    <div style={fieldGap}>
                        {/* First + Last name — flex-wrap so they stack on very small screens */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                                <label style={labelStyle}>First Name *</label>
                                <input name="first_name" type="text" placeholder="First" style={inputStyle}
                                    value={formData.first_name} onChange={handleChange} required autoComplete="given-name" />
                            </div>
                            <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                                <label style={labelStyle}>Last Name *</label>
                                <input name="last_name" type="text" placeholder="Last" style={inputStyle}
                                    value={formData.last_name} onChange={handleChange} required autoComplete="family-name" />
                            </div>
                        </div>

                        {/* Gender */}
                        <div>
                            <label style={labelStyle}>Gender</label>
                            <select name="gender" style={selectStyle} value={formData.gender} onChange={handleChange}>
                                <option value="">Select gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>

                        {/* Date of birth */}
                        <div>
                            <label style={labelStyle}>Date of Birth</label>
                            <input name="date_of_birth" type="date" style={inputStyle}
                                value={formData.date_of_birth} onChange={handleChange}
                                max={new Date().toISOString().split('T')[0]} />
                            {ageGroupPreview && (
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: ageGroupPreview.color, paddingLeft: '6px', marginTop: '4px', display: 'block' }}>
                                    ✦ {ageGroupPreview.label}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Footer link */}
                    <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: '1.25rem', textAlign: 'center' }}>
                        Have an account?{' '}
                        <Link to="/login" style={{ color: '#F59E0B', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
                    </p>
                </Step>

                {/* ── Step 2: Your Community ─────────────────────────────── */}
                <Step>
                    <StepHeading title="Connect your community" subtitle="Step 2 of 3 — Location" />

                    <div style={fieldGap}>
                        {/* Province */}
                        <div>
                            <label style={labelStyle}>Province</label>
                            <select name="province" style={selectStyle} value={formData.province} onChange={handleChange}>
                                <option value="">Select your province</option>
                                {PROVINCES.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Phone */}
                        <div>
                            <label style={labelStyle}>Phone (optional)</label>
                            <input name="phone" type="tel" placeholder="+2348012345678" style={inputStyle}
                                value={formData.phone} onChange={handleChange} autoComplete="tel" />
                        </div>

                        {/* Username */}
                        <div>
                            <label style={labelStyle}>Username *</label>
                            <input name="username" type="text" placeholder="Choose a username" style={inputStyle}
                                value={formData.username} onChange={handleChange} required autoComplete="username" />
                            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', paddingLeft: '6px', marginTop: '4px' }}>
                                This is how other members will see you.
                            </p>
                        </div>
                    </div>
                </Step>

                {/* ── Step 3: Secure It ─────────────────────────────────── */}
                <Step>
                    <StepHeading title="Secure your account" subtitle="Step 3 of 3 — Credentials" />

                    <div style={fieldGap}>
                        {/* Email */}
                        <div>
                            <label style={labelStyle}>Email Address *</label>
                            <input name="email" type="email" placeholder="you@example.com" style={inputStyle}
                                value={formData.email} onChange={handleChange} required autoComplete="email" />
                        </div>

                        {/* Password */}
                        <div>
                            <label style={labelStyle}>Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input name="password" type={showPassword ? 'text' : 'password'}
                                    placeholder="Min. 8 characters" style={{ ...inputStyle, paddingRight: '42px' }}
                                    value={formData.password} onChange={handleChange}
                                    required minLength={8} autoComplete="new-password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', padding: 0 }}>
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label style={labelStyle}>Confirm Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input name="password_confirm" type={showConfirm ? 'text' : 'password'}
                                    placeholder="Repeat password"
                                    style={{ ...inputStyle, paddingRight: '42px', borderColor: passwordMismatch ? '#f87171' : undefined }}
                                    value={formData.password_confirm} onChange={handleChange}
                                    required autoComplete="new-password" />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', padding: 0 }}>
                                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            {passwordMismatch && (
                                <span style={{ fontSize: '0.72rem', color: '#fca5a5', paddingLeft: '6px', marginTop: '3px', display: 'block' }}>
                                    Passwords don't match
                                </span>
                            )}
                        </div>

                        {loading && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#F59E0B', fontSize: '0.85rem' }}>
                                <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                Creating your account…
                            </div>
                        )}
                    </div>
                </Step>
            </Stepper>
        </div>
    );
};

export default Register;
