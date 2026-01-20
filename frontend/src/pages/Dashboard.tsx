import { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import FavoritesList from '../components/FavoritesList';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const { user, logout, updateProfile } = useAuthContext();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'profile' | 'favorites'>('profile');
    const [isEditing, setIsEditing] = useState(false);

    const { register, handleSubmit, reset } = useForm({
        defaultValues: {
            username: user?.username || '',
            email: user?.email || '',
            first_name: user?.first_name || '',
            last_name: user?.last_name || ''
        }
    });

    useEffect(() => {
        if (!user) {
            // navigate('/login'); 
        } else {
            reset({
                username: user.username,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name
            });
        }
    }, [user, navigate, reset]);

    const onUpdateProfile = async (data: any) => {
        try {
            await updateProfile(data);
            toast.success("Profile updated successfully!");
            setIsEditing(false);
        } catch (error) {
            toast.error("Failed to update profile.");
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="container mx-auto px-4 py-24">

                {/* Welcome Header */}
                <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Hello, <span className="text-primary-600">{user.username}</span>!
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">Welcome to your dashboard.</p>
                    </div>
                    <button
                        onClick={logout}
                        className="btn-secondary py-2 px-6 text-sm"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-8">
                    <button
                        className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'profile'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'
                            }`}
                        onClick={() => setActiveTab('profile')}
                    >
                        My Profile
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'favorites'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'
                            }`}
                        onClick={() => setActiveTab('favorites')}
                    >
                        Favorites
                    </button>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    {activeTab === 'profile' && (
                        <div className="space-y-6 max-w-2xl">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile Details</h2>
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="text-primary-600 hover:text-primary-700 font-bold text-sm underline"
                                >
                                    {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                                </button>
                            </div>

                            {isEditing ? (
                                <form onSubmit={handleSubmit(onUpdateProfile)} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                                            <input
                                                {...register("first_name")}
                                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                                            <input
                                                {...register("last_name")}
                                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                                        <input
                                            {...register("username")}
                                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white opaque-50 hover:cursor-not-allowed"
                                            readOnly
                                            title="Username cannot be changed"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                        <input
                                            {...register("email")}
                                            type="email"
                                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                                        />
                                    </div>

                                    <button type="submit" className="btn-primary py-2 px-6 rounded-lg font-bold shadow-md">
                                        Save Changes
                                    </button>
                                </form>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                                            {user.first_name} {user.last_name || ''}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                                            {user.username}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                                            {user.email || 'N/A'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 uppercase text-xs font-bold tracking-wider">
                                            {user.role}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'favorites' && (
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">My Favorites</h2>
                            <div className="py-4">
                                <FavoritesList />
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
