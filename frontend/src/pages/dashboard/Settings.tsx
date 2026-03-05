import { useState } from 'react';
import { User, Mail, Phone, Lock, Eye, EyeOff, Save, Loader, Bell, Shield, LogOut } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// ─── Section Wrapper ──────────────────────────────────────────────────────────
const Section = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
        <div className="px-6 py-5">{children}</div>
    </div>
);

// ─── Field ────────────────────────────────────────────────────────────────────
const Field = ({
    label, icon: Icon, type = 'text', value, name, onChange, placeholder, disabled = false, required = false
}: {
    label: string; icon: React.ElementType; type?: string; value: string;
    name: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string; disabled?: boolean; required?: boolean;
}) => {
    const [show, setShow] = useState(false);
    const isPassword = type === 'password';
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon size={16} className="text-gray-400" />
                </div>
                <input
                    type={isPassword && show ? 'text' : type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {isPassword && (
                    <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Toggle ───────────────────────────────────────────────────────────────────
const Toggle = ({ label, description, checked, onChange }: {
    label: string; description: string; checked: boolean; onChange: () => void
}) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
        <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">{label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

// ─── Settings Page ────────────────────────────────────────────────────────────
const Settings = () => {
    const { user, logout } = useAuthContext();

    const [profileData, setProfileData] = useState({
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
    });
    const [profileLoading, setProfileLoading] = useState(false);

    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });
    const [passwordLoading, setPasswordLoading] = useState(false);

    const [notifications, setNotifications] = useState({
        devotional_reminders: true,
        event_alerts: true,
        weekly_digest: false,
        sms_notifications: false,
    });

    // Profile update
    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfileData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            await api.patch('/auth/me/', profileData);
            toast.success('Profile updated successfully!');
        } catch (err: any) {
            const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Failed to update profile';
            toast.error(msg);
        } finally {
            setProfileLoading(false);
        }
    };

    // Password change
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const savePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new_password !== passwordData.confirm_password) {
            toast.error("New passwords don't match");
            return;
        }
        if (passwordData.new_password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setPasswordLoading(true);
        try {
            await api.post('/auth/change-password/', {
                current_password: passwordData.current_password,
                new_password: passwordData.new_password,
            });
            toast.success('Password changed successfully!');
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Failed to change password';
            toast.error(detail);
        } finally {
            setPasswordLoading(false);
        }
    };

    const displayName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || 'User';

    const initials = displayName.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-12">
            {/* Page Header */}
            <div className="mb-2">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">Settings</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage your account and preferences</p>
            </div>

            {/* Avatar + Identity */}
            <Section title="Profile" description="Update your personal information">
                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xl ring-4 ring-primary-100 dark:ring-primary-900/50">
                        {initials}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white">{displayName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{user?.username}</p>
                        {user?.role && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                {user.role}
                            </span>
                        )}
                    </div>
                </div>

                <form onSubmit={saveProfile} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="First Name" icon={User} name="first_name" value={profileData.first_name} onChange={handleProfileChange} placeholder="John" />
                        <Field label="Last Name" icon={User} name="last_name" value={profileData.last_name} onChange={handleProfileChange} placeholder="Doe" />
                    </div>
                    <Field label="Email Address" icon={Mail} type="email" name="email" value={profileData.email} onChange={handleProfileChange} placeholder="you@example.com" required />
                    <Field label="Phone Number" icon={Phone} type="tel" name="phone" value={profileData.phone} onChange={handleProfileChange} placeholder="+234 800 000 0000" />

                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={profileLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            {profileLoading ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Profile
                        </button>
                    </div>
                </form>
            </Section>

            {/* Password Change */}
            <Section title="Change Password" description="Keep your account secure with a strong password">
                <form onSubmit={savePassword} className="space-y-4">
                    <Field label="Current Password" icon={Lock} type="password" name="current_password" value={passwordData.current_password} onChange={handlePasswordChange} placeholder="Enter current password" required />
                    <Field label="New Password" icon={Lock} type="password" name="new_password" value={passwordData.new_password} onChange={handlePasswordChange} placeholder="Min. 8 characters" required />
                    <Field
                        label="Confirm New Password"
                        icon={Lock}
                        type="password"
                        name="confirm_password"
                        value={passwordData.confirm_password}
                        onChange={handlePasswordChange}
                        placeholder="Repeat new password"
                        required
                    />
                    {passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password && (
                        <p className="text-xs text-red-500">Passwords don't match</p>
                    )}
                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={passwordLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            {passwordLoading ? <Loader size={16} className="animate-spin" /> : <Shield size={16} />}
                            Update Password
                        </button>
                    </div>
                </form>
            </Section>

            {/* Notifications */}
            <Section title="Notifications" description="Choose what you want to be notified about">
                <Toggle
                    label="Daily Devotional Reminders"
                    description="Get reminded when a new devotional is published"
                    checked={notifications.devotional_reminders}
                    onChange={() => setNotifications(p => ({ ...p, devotional_reminders: !p.devotional_reminders }))}
                />
                <Toggle
                    label="Event Alerts"
                    description="Be notified about upcoming events and registrations"
                    checked={notifications.event_alerts}
                    onChange={() => setNotifications(p => ({ ...p, event_alerts: !p.event_alerts }))}
                />
                <Toggle
                    label="Weekly Digest"
                    description="A weekly summary of content, events and highlights"
                    checked={notifications.weekly_digest}
                    onChange={() => setNotifications(p => ({ ...p, weekly_digest: !p.weekly_digest }))}
                />
                <Toggle
                    label="SMS Notifications"
                    description="Receive critical alerts via text message"
                    checked={notifications.sms_notifications}
                    onChange={() => setNotifications(p => ({ ...p, sms_notifications: !p.sms_notifications }))}
                />
            </Section>

            {/* Danger Zone */}
            <Section title="Account" description="Manage your session">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">Sign Out</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sign out of your account on this device</p>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl text-sm font-bold transition-colors"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </Section>
        </div>
    );
};

export default Settings;
