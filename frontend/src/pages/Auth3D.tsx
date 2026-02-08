import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod'; // Import zod as a namespace to avoid conflicts
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, Phone, MapPin, Layers, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { CHURCH_INFO_FIELDS } from '../constants/formFields';
import './Auth3D.css';

// --- Validation Schemas ---
const loginSchema = z.object({
    login: z.string().min(1, "Username or Email is required"),
    password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
    // Step 1: Basic Info
    fullName: z.string().min(2, "Full Name is required"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),

    // Step 2: Security
    password: z.string().min(6, "Password must be at least 6 characters"),
    password_confirm: z.string().min(6, "Confirm Password is required"),

    // Step 3: Additional Details
    phone: z.string().optional(),
    province: z.string().optional(),
    role: z.string().optional(), // Mapped to Category
}).refine((data) => data.password === data.password_confirm, {
    message: "Passwords don't match",
    path: ["password_confirm"],
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
    const [showPassword, setShowPassword] = useState(false);

    // Multi-step State
    const [signupStep, setSignupStep] = useState(1);
    const totalSteps = 3;

    // Login Form
    const {
        register: loginReg,
        handleSubmit: handleLoginSubmit,
        formState: { errors: loginErrors }
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    // Signup Form
    const {
        register: signupReg,
        handleSubmit: handleSignupSubmit,
        trigger,
        formState: { errors: signupErrors }
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        mode: "onChange"
    });

    // Handlers
    const onLogin = async (data: LoginFormValues) => {
        setIsSubmitting(true);
        try {
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
            const names = data.fullName.split(' ');
            const first_name = names[0];
            const last_name = names.slice(1).join(' ') || '';

            await register({
                username: data.username,
                email: data.email,
                password: data.password,
                password_confirm: data.password_confirm,
                first_name,
                last_name,
                phone: data.phone,
                province: data.province,
                role: data.role // Category
            });

            toast.success("Account created! Logging you in...");
        } catch (error: any) {
            toast.error(error.message || "Registration failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const nextStep = async () => {
        let fieldsToValidate: (keyof RegisterFormValues)[] = [];
        if (signupStep === 1) fieldsToValidate = ['fullName', 'username', 'email'];
        if (signupStep === 2) fieldsToValidate = ['password', 'password_confirm'];

        const isStepValid = await trigger(fieldsToValidate);
        if (isStepValid) setSignupStep(prev => prev + 1);
    };

    const prevStep = () => setSignupStep(prev => prev - 1);

    const toggleAuth = () => {
        setIsSignUp(!isSignUp);
        setShowPassword(false);
        setSignupStep(1); // Reset step on toggle
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

                    <input
                        className="checkbox-hidden"
                        type="checkbox"
                        id="reg-log"
                        name="reg-log"
                        checked={isSignUp}
                        onChange={toggleAuth}
                    />
                    <label htmlFor="reg-log" className="checkbox-label">
                        <div className={`absolute top-[-10px] left-[-10px] w-[36px] h-[36px] rounded-full bg-[#102770] text-[#ffeba7] flex items-center justify-center transition-all duration-500 z-20 ${isSignUp ? 'transform translate-x-[44px] -rotate-90' : ''}`}>
                            <ArrowRight size={20} />
                        </div>
                    </label>

                    <div className="card-3d-wrap mx-auto">
                        <div className={`card-3d-wrapper ${isSignUp ? 'card-flipped' : ''}`}>

                            {/* LOGIN CARD (FRONT) */}
                            <div className="card-front backdrop-blur-md bg-white/10 border border-white/20 shadow-xl rounded-xl">
                                <div className="center-wrap">
                                    <div className="section text-center">
                                        <h4 className="mb-4 pb-3 auth-3d-h4 text-white text-2xl">Log In</h4>
                                        <form onSubmit={handleLoginSubmit(onLogin)}>
                                            <div className="form-group relative">
                                                <input
                                                    type="text"
                                                    className="form-style pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all"
                                                    placeholder="Username or Email"
                                                    autoComplete="username"
                                                    {...loginReg("login")}
                                                />
                                                <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                    <User size={20} />
                                                </i>
                                                {loginErrors.login && <p className="text-red-400 text-xs text-left mt-1 pl-4">{loginErrors.login.message}</p>}
                                            </div>
                                            <div className="form-group mt-2 relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    className="form-style pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all"
                                                    placeholder="Your Password"
                                                    autoComplete="current-password"
                                                    {...loginReg("password")}
                                                />
                                                <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                    <Lock size={20} />
                                                </i>
                                                <div
                                                    className="absolute right-4 top-3 text-[#ffeba7] cursor-pointer z-30"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </div>
                                                {loginErrors.password && <p className="text-red-400 text-xs text-left mt-1 pl-4">{loginErrors.password.message}</p>}
                                            </div>
                                            <button type="submit" className="btn-3d mt-4 bg-[#ffeba7] text-[#102770] hover:bg-[#ffeba7]/90 transition-colors" disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="animate-spin" /> : "SUBMIT"}
                                            </button>
                                        </form>
                                        <p className="mb-0 mt-4 text-center">
                                            <a href="#0" className="auth-3d-link text-[#ffeba7]/80 hover:text-[#ffeba7]">Forgot your password?</a>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* SIGNUP CARD (BACK) - Progressive Form */}
                            <div className="card-back backdrop-blur-md bg-white/10 border border-white/20 shadow-xl rounded-xl">
                                <div className="center-wrap">
                                    <div className="section text-center">
                                        <div className="flex justify-between items-center mb-4 px-4">
                                            <h4 className="auth-3d-h4 text-white text-2xl m-0">Sign Up</h4>
                                            <span className="text-xs text-[#ffeba7] font-semibold bg-[#102770]/50 px-2 py-1 rounded-full border border-[#ffeba7]/30">
                                                Step {signupStep} of {totalSteps}
                                            </span>
                                        </div>

                                        <form onSubmit={handleSignupSubmit(onRegister)}>

                                            {/* STEP 1: Basic Info */}
                                            {signupStep === 1 && (
                                                <div className="animate-in fade-in slide-in-from-right duration-300">
                                                    <div className="form-group relative">
                                                        <input
                                                            type="text"
                                                            className="form-style pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all"
                                                            placeholder="Full Name"
                                                            autoComplete="name"
                                                            {...signupReg("fullName")}
                                                        />
                                                        <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                            <User size={20} />
                                                        </i>
                                                        {signupErrors.fullName && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.fullName.message}</p>}
                                                    </div>
                                                    <div className="form-group mt-2 relative">
                                                        <input
                                                            type="text"
                                                            className="form-style pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all"
                                                            placeholder="Username"
                                                            autoComplete="username"
                                                            {...signupReg("username")}
                                                        />
                                                        <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                            <User size={20} />
                                                        </i>
                                                        {signupErrors.username && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.username.message}</p>}
                                                    </div>
                                                    <div className="form-group mt-2 relative">
                                                        <input
                                                            type="email"
                                                            className="form-style pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all"
                                                            placeholder="Your Email"
                                                            autoComplete="email"
                                                            {...signupReg("email")}
                                                        />
                                                        <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                            <Mail size={20} />
                                                        </i>
                                                        {signupErrors.email && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.email.message}</p>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* STEP 2: Security */}
                                            {signupStep === 2 && (
                                                <div className="animate-in fade-in slide-in-from-right duration-300">
                                                    <div className="form-group relative">
                                                        <input
                                                            type={showPassword ? "text" : "password"}
                                                            className="form-style pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all"
                                                            placeholder="Password"
                                                            {...signupReg("password")}
                                                        />
                                                        <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                            <Lock size={20} />
                                                        </i>
                                                        <div className="absolute right-4 top-3 text-[#ffeba7] cursor-pointer z-30" onClick={() => setShowPassword(!showPassword)}>
                                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                        </div>
                                                        {signupErrors.password && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.password.message}</p>}
                                                    </div>
                                                    <div className="form-group mt-2 relative">
                                                        <input
                                                            type={showPassword ? "text" : "password"}
                                                            className="form-style pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all"
                                                            placeholder="Confirm Password"
                                                            {...signupReg("password_confirm")}
                                                        />
                                                        <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                            <Lock size={20} />
                                                        </i>
                                                        {signupErrors.password_confirm && <p className="text-red-400 text-xs text-left mt-1 pl-4">{signupErrors.password_confirm.message}</p>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* STEP 3: Details */}
                                            {signupStep === 3 && (
                                                <div className="animate-in fade-in slide-in-from-right duration-300">
                                                    <div className="form-group relative">
                                                        <input
                                                            type="tel"
                                                            className="form-style pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all"
                                                            placeholder="Phone Number (Optional)"
                                                            {...signupReg("phone")}
                                                        />
                                                        <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                            <Phone size={20} />
                                                        </i>
                                                    </div>
                                                    <div className="form-group mt-2 relative">
                                                        <select
                                                            className="form-style pl-10 bg-[#2a2b38] border-white/10 text-white focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all appearance-none"
                                                            {...signupReg("province")}
                                                        >
                                                            <option value="">Select Province (Optional)</option>
                                                            {CHURCH_INFO_FIELDS.find(f => f.name === 'province')?.options?.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                        <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                            <MapPin size={20} />
                                                        </i>
                                                    </div>
                                                    <div className="form-group mt-2 relative">
                                                        <select
                                                            className="form-style pl-10 bg-[#2a2b38] border-white/10 text-white focus:border-[#ffeba7] focus:ring-1 focus:ring-[#ffeba7] transition-all appearance-none"
                                                            {...signupReg("role")}
                                                        >
                                                            <option value="">Select Category (Optional)</option>
                                                            <option value="teen">Teenager</option>
                                                            <option value="coordinator">Coordinator</option>
                                                            <option value="individual">Individual</option>
                                                        </select>
                                                        <i className="input-icon absolute left-3 top-3 text-[#ffeba7]">
                                                            <Layers size={20} />
                                                        </i>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Navigation Buttons */}
                                            <div className="flex gap-2 mt-4">
                                                {signupStep > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={prevStep}
                                                        className="btn-3d flex-1 bg-gray-600 hover:bg-gray-500 text-white flex items-center justify-center gap-2"
                                                    >
                                                        <ChevronLeft size={16} /> Back
                                                    </button>
                                                )}

                                                {signupStep < totalSteps ? (
                                                    <button
                                                        type="button"
                                                        onClick={nextStep}
                                                        className="btn-3d flex-1 bg-[#ffeba7] text-[#102770] hover:bg-[#ffeba7]/90 flex items-center justify-center gap-2"
                                                    >
                                                        Next <ChevronRight size={16} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="submit"
                                                        className="btn-3d flex-1 bg-[#ffeba7] text-[#102770] hover:bg-[#ffeba7]/90 flex items-center justify-center gap-2"
                                                        disabled={isSubmitting}
                                                    >
                                                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Finish"}
                                                    </button>
                                                )}
                                            </div>

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
