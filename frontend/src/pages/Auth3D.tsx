import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod'; // Import zod as a namespace to avoid conflicts
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import './Auth3D.css';

// --- Validation Schemas ---
const loginSchema = z.object({
    // Accept username OR email. Use a generic string check, or refine if needed.
    login: z.string().min(1, "Username or Email is required"),
    password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
    fullName: z.string().min(2, "Full Name is required"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

interface Auth3DProps {
    initialIsSignUp?: boolean;
}

const Auth3D = ({ initialIsSignUp = false }: Auth3DProps) => {
    const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
    const { login, register } = useAuthContext();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false); // Toggle state

    // Forms
    const {
        register: loginReg,
        handleSubmit: handleLoginSubmit,
        formState: { errors: loginErrors }
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const {
        register: signupReg,
        handleSubmit: handleSignupSubmit,
        formState: { errors: signupErrors }
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
    });

    // Handlers
    const onLogin = async (data: LoginFormValues) => {
        setIsSubmitting(true);
        try {
            // Pass the 'login' field (username or email) to the username parameter of AuthContext
            // Backend should be configured to accept email in username field or we handle it here.
            // Assuming existing backend or standard Django Auth handles username. 
            // If we need to detect email vs username, we can do it here, but typically sending as 'username' payload works if backend checks both.
            await login({ username: data.login, password: data.password });
            toast.success("Welcome back!");
            navigate('/dashboard');
        } catch (error: any) {
            toast.error(error.message || "Login failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const onRegister = async (data: RegisterFormValues) => {
        setIsSubmitting(true);
        try {
            // Split full name
            const names = data.fullName.split(' ');
            const first_name = names[0];
            const last_name = names.slice(1).join(' ') || '';

            await register({
                username: data.username,
                email: data.email,
                password: data.password,
                first_name,
                last_name
            });

            toast.success("Account created! Logging you in...");
        } catch (error: any) {
            toast.error(error.message || "Registration failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleAuth = () => {
        setIsSignUp(!isSignUp);
        setShowPassword(false); // Reset password visibility on toggle
    };

    return (
        <AuthLayout
            title={isSignUp ? "Join the Tribe" : "Welcome Back"}
            subtitle={isSignUp ? "Start your journey with us today." : "Log in to access your dashboard."}
        >
            <div className="auth-3d-container">
                <div className="section text-center">

                    <h6 className="mb-0 pb-3 auth-3d-h6 text-white uppercase tracking-wider">
                        <span
                            onClick={() => setIsSignUp(false)}
                            className={`cursor-pointer transition-opacity ${!isSignUp ? 'opacity-100 text-[#ffeba7]' : 'opacity-50'}`}
                        >
                            Log In
                        </span>
                        <span
                            onClick={() => setIsSignUp(true)}
                            className={`cursor-pointer transition-opacity ${isSignUp ? 'opacity-100 text-[#ffeba7]' : 'opacity-50'}`}
                        >
                            Sign Up
                        </span>
                    </h6>

                    {/* Toggle Checkbox (Visual only, controlled by React state) */}
                    <input
                        className="checkbox-hidden"
                        type="checkbox"
                        id="reg-log"
                        name="reg-log"
                        checked={isSignUp}
                        onChange={toggleAuth}
                    />
                    <label htmlFor="reg-log" className="checkbox-label">
                        {/* Arrow Icon injected here */}
                        <div className={`absolute top-[-10px] left-[-10px] w-[36px] h-[36px] rounded-full bg-[#102770] text-[#ffeba7] flex items-center justify-center transition-all duration-500 z-20 ${isSignUp ? 'transform translate-x-[44px] -rotate-90' : ''}`}>
                            <ArrowRight size={20} />
                        </div>
                    </label>

                    <div className="card-3d-wrap mx-auto">
                        <div className={`card-3d-wrapper ${isSignUp ? 'card-flipped' : ''}`}>

                            {/* LOGIN CARD (FRONT) */}
                            <div className="card-front">
                                <div className="center-wrap">
                                    <div className="section text-center">
                                        <h4 className="mb-4 pb-3 auth-3d-h4 text-white text-2xl">Log In</h4>
                                        <form onSubmit={handleLoginSubmit(onLogin)}>
                                            <div className="form-group">
                                                <input
                                                    type="text"
                                                    className="form-style"
                                                    placeholder="Username or Email"
                                                    autoComplete="username"
                                                    {...loginReg("login")}
                                                />
                                                <i className="input-icon">
                                                    <User size={20} />
                                                </i>
                                                {loginErrors.login && <p className="text-red-400 text-xs text-left mt-1 pl-4">{loginErrors.login.message}</p>}
                                            </div>
                                            <div className="form-group mt-2">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    className="form-style"
                                                    placeholder="Your Password"
                                                    autoComplete="current-password"
                                                    {...loginReg("password")}
                                                />
                                                <i className="input-icon">
                                                    <Lock size={20} />
                                                </i>
                                                {/* Password Toggle Icon */}
                                                <div
                                                    className="absolute right-4 top-3 text-[#ffeba7] cursor-pointer z-30"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </div>

                                                {loginErrors.password && <p className="text-red-400 text-xs text-left mt-1 pl-4">{loginErrors.password.message}</p>}
                                            </div>
                                            <button type="submit" className="btn-3d mt-4" disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="animate-spin" /> : "SUBMIT"}
                                            </button>
                                        </form>
                                        <p className="mb-0 mt-4 text-center">
                                            <a href="#0" className="auth-3d-link">Forgot your password?</a>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* SIGNUP CARD (BACK) */}
                            <div className="card-back">
                                <div className="center-wrap">
                                    <div className="section text-center">
                                        <h4 className="mb-4 pb-3 auth-3d-h4 text-white text-2xl">Sign Up</h4>
                                        <form onSubmit={handleSignupSubmit(onRegister)}>
                                            <div className="form-group">
                                                <input
                                                    type="text"
                                                    className="form-style"
                                                    placeholder="Full Name"
                                                    autoComplete="name"
                                                    {...signupReg("fullName")}
                                                />
                                                <i className="input-icon">
                                                    <User size={20} />
                                                </i>
                                                {signupErrors.fullName && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.fullName.message}</p>}
                                            </div>

                                            <div className="form-group mt-2">
                                                <input
                                                    type="text"
                                                    className="form-style"
                                                    placeholder="Username"
                                                    autoComplete="username"
                                                    {...signupReg("username")}
                                                />
                                                <i className="input-icon">
                                                    <User size={20} />
                                                </i>
                                                {signupErrors.username && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.username.message}</p>}
                                            </div>

                                            <div className="form-group mt-2">
                                                <input
                                                    type="email"
                                                    className="form-style"
                                                    placeholder="Your Email"
                                                    autoComplete="email"
                                                    {...signupReg("email")}
                                                />
                                                <i className="input-icon">
                                                    <Mail size={20} />
                                                </i>
                                                {signupErrors.email && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.email.message}</p>}
                                            </div>

                                            <div className="form-group mt-2">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    className="form-style"
                                                    placeholder="Your Password"
                                                    autoComplete="new-password"
                                                    {...signupReg("password")}
                                                />
                                                <i className="input-icon">
                                                    <Lock size={20} />
                                                </i>
                                                {/* Password Toggle Icon */}
                                                <div
                                                    className="absolute right-4 top-3 text-[#ffeba7] cursor-pointer z-30"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </div>
                                                {signupErrors.password && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.password.message}</p>}
                                            </div>
                                            <button type="submit" className="btn-3d mt-4" disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="animate-spin" /> : "SUBMIT"}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </AuthLayout>
    );
};

export default Auth3D;
