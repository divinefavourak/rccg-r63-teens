import { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader, Eye, EyeOff } from 'lucide-react';
import faithTribeLogo from '../assets/faith_tribe_logo.jpg';
import rccgLogo from '../assets/logo.jpg';
import './GlowAuth.css';

const Login = () => {
    const { login } = useAuthContext();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(formData);
            toast.success('Welcome back!');
            const stored = localStorage.getItem('rccg_user');
            const role = stored ? JSON.parse(stored)?.role : null;
            if (role === 'admin') navigate('/admin/dashboard');
            else if (role === 'coordinator') navigate('/coordinator/dashboard');
            else navigate('/dashboard');
        } catch {
            toast.error('Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glow-page">
            <div className="glow-box">
                <div className="glow-login">
                    <div className="glow-login-bx">

                        {/* Logos + Title inline */}
                        <div className="glow-header-row">
                            <img src={rccgLogo} alt="RCCG" className="glow-logo-sm" />
                            <img src={faithTribeLogo} alt="Faith Tribe" className="glow-logo-sm" />
                            <h2 className="glow-title">
                                <i className="glow-icon">✦</i>
                                Login
                                <i className="glow-icon">♥</i>
                            </h2>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'contents' }}>
                        <input
                            type="text"
                            className="glow-input"
                            placeholder="Username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                            autoComplete="username"
                        />

                        <div className="glow-input-wrap">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="glow-input"
                                placeholder="Password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="glow-eye-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        <button type="submit" className="glow-submit" disabled={loading}>
                            {loading ? <Loader size={16} className="animate-spin" /> : 'Sign in'}
                        </button>
                        </form>

                        {/* Footer */}
                        <div className="glow-group">
                            <a href="#">Forgot Password</a>
                            <Link to="/register" className="glow-accent">Sign up</Link>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
