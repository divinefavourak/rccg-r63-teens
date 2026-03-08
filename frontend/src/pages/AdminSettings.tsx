import { useState, useEffect } from 'react';
import {
    User, Lock, Bell, Shield, Save, Loader,
    Eye, EyeOff, CheckCircle
} from 'lucide-react';
import api from '../api/axios';
import { useAuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'security' | 'notifications';

const AdminSettings = () => {
    const { user, updateProfile } = useAuthContext();
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [saving, setSaving] = useState(false);

    // Profile form
    const [profile, setProfile] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        bio: '',
    });

    // Security form
    const [security, setSecurity] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    // Notifications form
    const [notifications, setNotifications] = useState({
        email_notifications: true,
        sms_notifications: false,
    });

    useEffect(() => {
        if (user) {
            setProfile({
                first_name: (user as any).first_name || '',
                last_name: (user as any).last_name || '',
                email: user.email || '',
                phone: (user as any).phone || '',
                bio: (user as any).bio || '',
            });
            setNotifications({
                email_notifications: (user as any).email_notifications !== false,
                sms_notifications: !!(user as any).sms_notifications,
            });
        }
    }, [user]);

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateProfile(profile as any);
            toast.success('Profile updated successfully');
        } catch {
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (security.new_password !== security.confirm_password) {
            toast.error("New passwords don't match");
            return;
        }
        if (security.new_password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setSaving(true);
        try {
            await api.post('/auth/change-password/', {
                current_password: security.current_password,
                new_password: security.new_password,
            });
            toast.success('Password changed successfully');
            setSecurity({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Failed to change password';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleNotificationsSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateProfile(notifications as any);
            toast.success('Notification preferences saved');
        } catch {
            toast.error('Failed to save preferences');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all";

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'profile',       label: 'Profile',       icon: <User size={16} /> },
        { id: 'security',      label: 'Security',      icon: <Lock size={16} /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    ];

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
                <p className="text-gray-500 dark:text-gray-400">Manage your account preferences</p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Profile Tab ── */}
            {activeTab === 'profile' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                            <User size={20} className="text-primary-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Profile Information</h3>
                            <p className="text-sm text-gray-500">Update your personal details</p>
                        </div>
                    </div>
                    <form onSubmit={handleProfileSave} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">First Name</label>
                                <input className={inputCls} value={profile.first_name}
                                    onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Last Name</label>
                                <input className={inputCls} value={profile.last_name}
                                    onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Email Address</label>
                            <input type="email" className={inputCls} value={profile.email}
                                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Phone</label>
                            <input type="tel" className={inputCls} value={profile.phone}
                                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Bio</label>
                            <textarea rows={3} className={inputCls} value={profile.bio}
                                onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} />
                        </div>
                        <div className="pt-2 flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                            <Shield size={16} className="text-gray-400 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Role</p>
                                <p className="text-xs text-gray-500 capitalize">{user?.role || 'admin'}</p>
                            </div>
                            <div className="ml-auto">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 capitalize">
                                    {user?.role || 'admin'}
                                </span>
                            </div>
                        </div>
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
                            Save Profile
                        </button>
                    </form>
                </div>
            )}

            {/* ── Security Tab ── */}
            {activeTab === 'security' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                            <Lock size={20} className="text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Change Password</h3>
                            <p className="text-sm text-gray-500">Use a strong password with at least 8 characters</p>
                        </div>
                    </div>
                    <form onSubmit={handlePasswordSave} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    className={inputCls + ' pr-10'}
                                    value={security.current_password}
                                    onChange={e => setSecurity(s => ({ ...s, current_password: e.target.value }))}
                                    required
                                />
                                <button type="button" onClick={() => setShowCurrent(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    className={inputCls + ' pr-10'}
                                    value={security.new_password}
                                    onChange={e => setSecurity(s => ({ ...s, new_password: e.target.value }))}
                                    required
                                    minLength={8}
                                />
                                <button type="button" onClick={() => setShowNew(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Confirm New Password</label>
                            <input
                                type="password"
                                className={`${inputCls} ${security.confirm_password && security.new_password !== security.confirm_password ? 'border-red-400 focus:ring-red-400' : ''}`}
                                value={security.confirm_password}
                                onChange={e => setSecurity(s => ({ ...s, confirm_password: e.target.value }))}
                                required
                            />
                            {security.confirm_password && security.new_password !== security.confirm_password && (
                                <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                            )}
                        </div>
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? <Loader size={15} className="animate-spin" /> : <Lock size={15} />}
                            Change Password
                        </button>
                    </form>
                </div>
            )}

            {/* ── Notifications Tab ── */}
            {activeTab === 'notifications' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <Bell size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Notification Preferences</h3>
                            <p className="text-sm text-gray-500">Control how you receive updates</p>
                        </div>
                    </div>
                    <form onSubmit={handleNotificationsSave} className="p-6 space-y-4">
                        {[
                            {
                                key: 'email_notifications' as const,
                                label: 'Email Notifications',
                                desc: 'Receive account updates, welcome emails, and system alerts via email',
                                icon: '✉️',
                            },
                            {
                                key: 'sms_notifications' as const,
                                label: 'SMS Notifications',
                                desc: 'Receive important updates and reminders via SMS',
                                icon: '📱',
                            },
                        ].map(item => (
                            <label key={item.key}
                                className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors">
                                <span className="text-2xl mt-0.5">{item.icon}</span>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                                </div>
                                <div className="relative mt-0.5">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={notifications[item.key]}
                                        onChange={e => setNotifications(n => ({ ...n, [item.key]: e.target.checked }))}
                                    />
                                    <div
                                        onClick={() => setNotifications(n => ({ ...n, [item.key]: !n[item.key] }))}
                                        className={`w-11 h-6 rounded-full cursor-pointer transition-colors ${notifications[item.key] ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-transform ${notifications[item.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </div>
                                </div>
                            </label>
                        ))}

                        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <CheckCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                                Password reset emails are always sent regardless of notification preferences — they are a security requirement.
                            </p>
                        </div>

                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
                            Save Preferences
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;
