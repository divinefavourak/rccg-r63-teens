import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Loader, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import faithTribeLogo from '../assets/faith_tribe_logo.jpg';
import rccgLogo from '../assets/logo.jpg';
import './GlowAuth.css';

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password/', { uid, token, new_password: password });
            setDone(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Reset link is invalid or has expired.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glow-page">
            <div className="glow-box">
                <div className="glow-login">
                    <div className="glow-login-bx">

                        {/* Logos + Title */}
                        <div className="glow-header-row">
                            <img src={rccgLogo} alt="RCCG" className="glow-logo-sm" />
                            <img src={faithTribeLogo} alt="Faith Tribe" className="glow-logo-sm" />
                            <h2 className="glow-title">
                                <i className="glow-icon">✦</i>
                                New Pass
                                <i className="glow-icon">♥</i>
                            </h2>
                        </div>

                        {invalidLink ? (
                            /* Invalid / missing token */
                            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                                <AlertCircle size={40} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', marginBottom: 16 }}>
                                    This reset link is invalid or missing.<br />
                                    Please request a new one.
                                </p>
                                <Link to="/forgot-password" className="glow-submit" style={{ display: 'inline-block', textDecoration: 'none' }}>
                                    Request New Link
                                </Link>
                            </div>

                        ) : done ? (
                            /* Success */
                            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                                <CheckCircle size={40} style={{ color: '#FFD700', margin: '0 auto 12px' }} />
                                <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: 16 }}>
                                    Password reset successfully!<br />
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>Redirecting to login…</span>
                                </p>
                                <Link to="/login" className="glow-submit" style={{ display: 'inline-block', textDecoration: 'none' }}>
                                    Go to Login
                                </Link>
                            </div>

                        ) : (
                            /* New password form */
                            <>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', textAlign: 'center', marginBottom: 8 }}>
                                    Enter your new password below.
                                </p>

                                {error && (
                                    <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                                        <p style={{ color: '#fca5a5', fontSize: '0.82rem', margin: 0 }}>{error}</p>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} style={{ width: '100%', display: 'contents' }}>
                                    <div className="glow-input-wrap"> 
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            className="glow-input"
                                            placeholder="New password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            autoComplete="new-password"
                                        />
                                        <button type="button" className="glow-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>

                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="glow-input"
                                        placeholder="Confirm new password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                    />

                                    <button type="submit" className="glow-submit" disabled={loading}>
                                        {loading ? <Loader size={16} className="animate-spin" /> : 'Set New Password'}
                                    </button>
                                </form>

                                <div className="glow-group">
                                    <Link to="/login" className="glow-accent">Back to Login</Link>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
