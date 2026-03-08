import { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader, Eye, EyeOff } from 'lucide-react';
import faithTribeLogo from '../assets/faith_tribe_logo.png';
import rccgLogo from '../assets/logo.jpg';
import './GlowAuth.css';

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
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.password_confirm) {
            toast.error("Passwords don't match");
            return;
        }

        if (formData.password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        setLoading(true);
        try {
            await register(formData);
            toast.success('Account created successfully!');
            navigate('/dashboard');
        } catch (error: any) {
            const data = error.response?.data;
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const passwordMismatch =
        formData.password_confirm.length > 0 && formData.password !== formData.password_confirm;

    return (
        <div className="glow-page">
            <div className="glow-box glow-box--register">
                <div className="glow-login">
                    <div className="glow-login-bx">

                        {/* Logos + Title inline */}
                        <div className="glow-header-row">
                            <img src={rccgLogo} alt="RCCG" className="glow-logo-sm" />
                            <img src={faithTribeLogo} alt="Faith Tribe" className="glow-logo-sm" />
                            <h2 className="glow-title">
                                <i className="glow-icon">✦</i>
                                Sign Up
                                <i className="glow-icon">♥</i>
                            </h2>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>

                        {/* First & Last Name */}
                        <div className="glow-input-grid">
                            <input
                                name="first_name"
                                type="text"
                                className="glow-input"
                                placeholder="First Name"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                                autoComplete="given-name"
                            />
                            <input
                                name="last_name"
                                type="text"
                                className="glow-input"
                                placeholder="Last Name"
                                value={formData.last_name}
                                onChange={handleChange}
                                required
                                autoComplete="family-name"
                            />
                        </div>

                        {/* Gender */}
                        <select
                            name="gender"
                            className="glow-select"
                            value={formData.gender}
                            onChange={handleChange}
                        >
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>

                        {/* Username */}
                        <input
                            name="username"
                            type="text"
                            className="glow-input"
                            placeholder="Username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            autoComplete="username"
                        />

                        {/* Email */}
                        <input
                            name="email"
                            type="email"
                            className="glow-input"
                            placeholder="Email Address"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            autoComplete="email"
                        />

                        {/* Password */}
                        <div className="glow-input-wrap">
                            <input
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                className="glow-input"
                                placeholder="Password (min. 8 chars)"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={8}
                                autoComplete="new-password"
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

                        {/* Confirm Password */}
                        <div className="glow-input-wrap">
                            <input
                                name="password_confirm"
                                type={showConfirm ? 'text' : 'password'}
                                className="glow-input"
                                placeholder="Confirm Password"
                                value={formData.password_confirm}
                                onChange={handleChange}
                                required
                                autoComplete="new-password"
                                style={passwordMismatch ? { borderColor: '#ff6b6b' } : {}}
                            />
                            <button
                                type="button"
                                className="glow-eye-btn"
                                onClick={() => setShowConfirm(!showConfirm)}
                                tabIndex={-1}
                            >
                                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {passwordMismatch && (
                            <span className="glow-error">Passwords don't match</span>
                        )}

                        <button type="submit" className="glow-submit" disabled={loading}>
                            {loading ? <Loader size={16} className="animate-spin" /> : 'Create Account'}
                        </button>
                        </form>

                        {/* Footer */}
                        <div className="glow-group">
                            <span>Already have an account?</span>
                            <Link to="/login" className="glow-accent">Sign in</Link>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
