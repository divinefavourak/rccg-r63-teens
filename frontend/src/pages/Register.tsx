import { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, User, Mail, Lock, Loader, Heart } from 'lucide-react';

const Register = () => {
    const { register } = useAuthContext();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register(formData);
            toast.success('Account created successfully!');
            navigate('/dashboard');
        } catch (error: any) {
            const msg = error.response?.data?.username ? 'Username already exists' : 'Registration failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="min-h-screen flex bg-white dark:bg-gray-900 transition-colors">
            {/* Left Side - Form */}
            <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:max-w-md">
                    <div className="mb-8">
                        <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-8">
                            <ArrowLeft size={16} className="mr-2" /> Back to Home
                        </Link>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                            Join the Family
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            Create your account to start tracking your spiritual growth.
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">First Name</label>
                                <input
                                    name="first_name"
                                    type="text"
                                    className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="John"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
                                <input
                                    name="last_name"
                                    type="text"
                                    className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="Doe"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Username <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User size={18} className="text-gray-400" />
                                </div>
                                <input
                                    name="username"
                                    type="text"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="johndoe"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Address <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail size={18} className="text-gray-400" />
                                </div>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Password <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-400" />
                                </div>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="Create a strong password"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <Loader className="animate-spin h-5 w-5" />
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </div>
                    </form>

                    <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                        Already have an account?{' '}
                        <Link to="/login" className="font-bold text-primary-600 hover:text-primary-500">
                            Sign in here
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Image/Decoration */}
            <div className="hidden lg:block relative w-0 flex-1 bg-gray-900 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1511632765486-a01980e01a18?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-bl from-green-900/90 to-primary-900/90"></div>
                <div className="absolute inset-0 flex flex-col justify-center px-12 text-white">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-sm">
                        <Heart size={32} className="text-white" />
                    </div>
                    <h2 className="text-4xl font-black mb-6">"Let no one despise your youth"</h2>
                    <p className="text-lg text-primary-100 max-w-lg leading-relaxed italic">
                        1 Timothy 4:12 - "but be an example to the believers in word, in conduct, in love, in spirit, in faith, in purity."
                    </p>

                    <div className="mt-12 flex items-center gap-4">
                        <div className="flex -space-x-3">
                            <div className="w-10 h-10 rounded-full border-2 border-primary-900 bg-gray-300"></div>
                            <div className="w-10 h-10 rounded-full border-2 border-primary-900 bg-gray-400"></div>
                            <div className="w-10 h-10 rounded-full border-2 border-primary-900 bg-gray-500"></div>
                        </div>
                        <span className="text-sm font-medium text-white/80">Join 500+ teens already registered</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
