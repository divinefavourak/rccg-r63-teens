
import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Bell, Search, Sun, Moon, Settings, LogOut, ChevronDown, X } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuthContext } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Notification Panel ───────────────────────────────────────────────────────
const NotificationPanel = ({ onClose }: { onClose: () => void }) => {
    const { notifications, loading, markRead, markAllRead, unreadCount } = useNotifications();

    return (
        <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-3 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                            Mark all read
                        </button>
                    )}
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Notification list */}
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                {loading ? (
                    <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">No notifications yet</div>
                ) : notifications.map(n => (
                    <div
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!n.read ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''}`}
                    >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${n.iconColor}`}>
                            <n.icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm text-gray-900 dark:text-white ${!n.read ? 'font-bold' : 'font-semibold'}`}>{n.title}</p>
                                <span className="text-xs text-gray-400 flex-shrink-0">{n.time}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5 line-clamp-2">{n.body}</p>
                        </div>
                        {!n.read && (
                            <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
                        )}
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

// ─── Avatar Dropdown ──────────────────────────────────────────────────────────
const AvatarDropdown = ({ onClose }: { onClose: () => void }) => {
    const { user, logout } = useAuthContext();

    const displayName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || 'Guest';

    const initials = displayName.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

    const handleLogout = () => {
        onClose();
        logout();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-3 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50"
        >
            {/* Profile Info */}
            <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-2 ring-primary-200 dark:ring-primary-800">
                        {initials}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{displayName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
                        {user?.role && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                {user.role}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
                <Link
                    to="/dashboard/settings"
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <Settings size={16} className="text-gray-400" />
                    <span>Settings</span>
                </Link>
            </div>

            {/* Logout */}
            <div className="border-t border-gray-100 dark:border-gray-700 py-2">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </motion.div>
    );
};

// ─── DashboardLayout ──────────────────────────────────────────────────────────
const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showAvatarMenu, setShowAvatarMenu] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const { user } = useAuthContext();
    const { unreadCount } = useNotifications();

    const displayName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || 'Guest';

    const initials = displayName.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

    const toggleNotifications = () => {
        setShowNotifications(prev => !prev);
        setShowAvatarMenu(false);
    };

    const toggleAvatarMenu = () => {
        setShowAvatarMenu(prev => !prev);
        setShowNotifications(false);
    };

    return (
        <div
            className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300 overflow-hidden"
            onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('[data-panel]')) {
                    setShowNotifications(false);
                    setShowAvatarMenu(false);
                }
            }}
        >
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-4 lg:px-8 z-20 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white lg:hidden">Faith Tribe</h2>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Search */}
                        <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2 border border-transparent focus-within:border-primary-500 transition-all w-64">
                            <Search size={16} className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="bg-transparent border-none outline-none text-sm ml-2 w-full text-gray-700 dark:text-gray-200 placeholder-gray-400"
                            />
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        {/* Notification Bell */}
                        <div className="relative" data-panel="notifications">
                            <button
                                onClick={toggleNotifications}
                                className="p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white dark:ring-gray-800" />
                                )}
                            </button>
                            <AnimatePresence>
                                {showNotifications && (
                                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Avatar */}
                        <div className="relative" data-panel="avatar">
                            <button
                                onClick={toggleAvatarMenu}
                                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-primary-200 dark:ring-primary-800">
                                    {initials}
                                </div>
                                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
                                    {displayName.split(' ')[0]}
                                </span>
                                <ChevronDown size={14} className={`text-gray-400 transition-transform ${showAvatarMenu ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                                {showAvatarMenu && (
                                    <AvatarDropdown onClose={() => setShowAvatarMenu(false)} />
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
