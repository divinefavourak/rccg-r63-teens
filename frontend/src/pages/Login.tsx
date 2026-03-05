import { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, User, Lock, Loader, Eye, EyeOff } from 'lucide-react';

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
            // Route based on role (user state is updated by login())
            const stored = localStorage.getItem('rccg_user');
            const role = stored ? JSON.parse(stored)?.role : null;
            if (role === 'admin') {
                navigate('/admin/dashboard');
            } else if (role === 'coordinator') {
                navigate('/coordinator/dashboard');
            } else {
                navigate('/dashboard');
            }
        } catch (error) {
            toast.error('Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white dark:bg-gray-900 transition-colors">
            {/* Left Side - Form */}
            <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:max-w-md">
                    <div className="mb-10">
                        <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-8">
                            <ArrowLeft size={16} className="mr-2" /> Back to Home
                        </Link>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                            Welcome back
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            Please sign in to access your account.
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Username</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="Enter your username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="Enter your password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    Remember me
                                </label>
                            </div>

                            <div className="text-sm">
                                <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                                    Forgot your password?
                                </a>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <Loader className="animate-spin h-5 w-5" />
                                ) : (
                                    'Sign in'
                                )}
                            </button>
                        </div>
                    </form>

                    <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-bold text-primary-600 hover:text-primary-500">
                            Create free account
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Image/Decoration */}
            <div className="hidden lg:block relative w-0 flex-1 bg-primary-900 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1529070538774-1843cb3265df?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 to-primary-800/90"></div>
                <div className="absolute inset-0 flex flex-col justify-center px-12 text-white">
                    <h2 className="text-4xl font-black mb-6">Join the Digital Revolution</h2>
                    <p className="text-lg text-primary-100 max-w-lg leading-relaxed">
                        Connect with peers, access life-changing resources, and grow your spiritual walk in a modern, engaging way.
                    </p>
                    <div className="mt-12 flex gap-4">
                        <div className="w-12 h-1 bg-white/30 rounded-full"></div>
                        <div className="w-4 h-1 bg-white/30 rounded-full"></div>
                        <div className="w-4 h-1 bg-white/30 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
