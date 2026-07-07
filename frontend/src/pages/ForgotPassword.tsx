import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import faithTribeLogo from '../assets/faith_tribe_logo.jpg';
import rccgLogo from '../assets/logo.jpg';
import './GlowAuth.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true);
        try {
            await api.post('/auth/forgot-password/', { email: email.trim().toLowerCase() });
            setSent(true);
        } catch {
            // Always show success — backend never reveals whether email exists
            setSent(true);
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
                                Reset
                                <i className="glow-icon">♥</i>
                            </h2>
                        </div>

                        {sent ? (
                            /* Success state */
                            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                                <CheckCircle size={40} style={{ color: '#FFD700', margin: '0 auto 12px' }} />
                                <p style={{ color: '#fff', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 16 }}>
                                    If that email is registered, a reset link has been sent.<br />
                                    Check your inbox (and spam folder).
                                </p>
                                <Link to="/login" className="glow-submit" style={{ display: 'inline-block', textDecoration: 'none' }}>
                                    Back to Login
                                </Link>
                            </div>
                        ) : (
                            /* Email entry form */
                            <>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', textAlign: 'center', marginBottom: 8 }}>
                                    Enter your registered email and we'll send a reset link.
                                </p>
                                <form onSubmit={handleSubmit} style={{ width: '100%', display: 'contents' }}>
                                    <div className="glow-input-wrap">
                                        <input
                                            type="email"
                                            className="glow-input"
                                            placeholder="Email address"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            autoComplete="email"
                                        />
                                        <Mail size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                                    </div>

                                    <button type="submit" className="glow-submit" disabled={loading}>
                                        {loading ? <Loader size={16} className="animate-spin" /> : 'Send Reset Link'}
                                    </button>
                                </form>

                                <div className="glow-group">
                                    <Link to="/login" className="glow-accent" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <ArrowLeft size={14} /> Back to Login
                                    </Link>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
