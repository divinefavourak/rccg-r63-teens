
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, FileText, Headphones, Calendar, Settings, LogOut, X, Star, Award, Gift, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '../../context/AuthContext';
import rccgLogo from '../../assets/logo.jpg';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const getNavItems = (ageGroup: string, role: string) => {
    if (role === 'teacher') {
        return [
            { name: 'Overview',    icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Manuals',     icon: FileText,        path: '/dashboard/manuals' },
            { name: 'Devotionals', icon: BookOpen,        path: '/dashboard/devotionals' },
            { name: 'Events',      icon: Calendar,        path: '/dashboard/events' },
            { name: 'Settings',    icon: Settings,        path: '/dashboard/settings' },
        ];
    }
    if (ageGroup === 'toddler') {
        return [
            { name: 'Home',     icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Stories',  icon: BookOpen,        path: '/dashboard/devotionals' },
            { name: 'Events',   icon: Calendar,        path: '/dashboard/events' },
            { name: 'Settings', icon: Settings,        path: '/dashboard/settings' },
        ];
    }
    if (ageGroup === 'children') {
        return [
            { name: 'Home',        icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Devotionals', icon: BookOpen,        path: '/dashboard/devotionals' },
            { name: 'Events',      icon: Calendar,        path: '/dashboard/events' },
            { name: 'My Badges',   icon: Award,           path: '/dashboard/badges' },
            { name: 'Settings',    icon: Settings,        path: '/dashboard/settings' },
        ];
    }
    // pre_teen, teen, superteen
    return [
        { name: 'Overview',    icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Devotionals', icon: BookOpen,        path: '/dashboard/devotionals' },
        { name: 'Manuals',     icon: FileText,        path: '/dashboard/manuals' },
        { name: 'Podcasts',    icon: Headphones,      path: '/dashboard/podcasts' },
        { name: 'Events',      icon: Calendar,        path: '/dashboard/events' },
        { name: 'Settings',    icon: Settings,        path: '/dashboard/settings' },
    ];
};

const getTheme = (ageGroup: string, role: string) => {
    if (ageGroup === 'toddler') {
        return {
            bg: 'bg-emerald-600',
            text: 'text-white',
            activeLink: 'bg-amber-400 text-emerald-900 font-bold shadow',
            inactiveLink: 'text-emerald-100 hover:bg-emerald-500 hover:text-white',
            border: 'border-emerald-500',
            accent: 'text-amber-300',
            logo: 'ring-amber-400',
            subtitle: 'Faith Tribe Kids',
        };
    }
    if (ageGroup === 'children') {
        return {
            bg: 'bg-purple-700',
            text: 'text-white',
            activeLink: 'bg-amber-400 text-purple-900 font-bold shadow',
            inactiveLink: 'text-purple-100 hover:bg-purple-600 hover:text-white',
            border: 'border-purple-600',
            accent: 'text-amber-300',
            logo: 'ring-amber-400',
            subtitle: 'Faith Tribe Kids',
        };
    }
    if (role === 'teacher') {
        return {
            bg: 'bg-white dark:bg-gray-800',
            text: 'text-gray-900 dark:text-white',
            activeLink: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm',
            inactiveLink: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-emerald-600',
            border: 'border-gray-200 dark:border-gray-700',
            accent: 'text-emerald-600 dark:text-emerald-400',
            logo: 'ring-emerald-200 dark:ring-emerald-800',
            subtitle: 'Teacher Portal',
        };
    }
    // teen / superteen / pre_teen — new growth-coaching theme
    return {
        bg: 'bg-white dark:bg-gray-800',
        text: 'text-gray-900 dark:text-white',
        activeLink: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 shadow-sm',
        inactiveLink: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-300',
        border: 'border-gray-200 dark:border-gray-700',
        accent: 'text-indigo-600 dark:text-indigo-400',
        logo: 'ring-indigo-200 dark:ring-indigo-800',
        subtitle: 'Teens Platform',
    };
};

const SidebarContent = ({ onClose }: { onClose: () => void }) => {
    const { user, logout, ageGroup } = useAuthContext();
    const role = user?.role || 'teen';
    const theme = getTheme(ageGroup, role);
    const navItems = getNavItems(ageGroup, role);

    return (
        <div className={`flex flex-col h-full ${theme.bg} transition-colors duration-300`}>
            {/* Header */}
            <div className={`p-6 flex items-center justify-between border-b ${theme.border}`}>
                <div className="flex items-center gap-3">
                    <img src={rccgLogo} alt="Logo" className={`w-10 h-10 rounded-full ring-2 ${theme.logo}`} />
                    <div>
                        <h1 className={`font-bold text-base tracking-wide ${theme.text}`}>FAITH TRIBE</h1>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent}`}>{theme.subtitle}</p>
                    </div>
                </div>
                <button onClick={onClose} className={`lg:hidden ${theme.inactiveLink} transition-colors p-1 rounded`}>
                    <X size={24} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        end={item.path === '/dashboard'}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm ${
                                isActive ? theme.activeLink : theme.inactiveLink
                            }`
                        }
                    >
                        <item.icon size={20} />
                        <span>{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className={`p-4 border-t ${theme.border}`}>
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-xl transition-all text-sm"
                >
                    <LogOut size={20} />
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    );
};

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const baseClasses = "w-64 border-r border-gray-200 dark:border-gray-700 transition-colors duration-300";

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Desktop Sidebar — always visible, no animation */}
            <aside className={`hidden lg:flex lg:flex-col h-full shadow-sm ${baseClasses}`}>
                <SidebarContent onClose={onClose} />
            </aside>

            {/* Mobile Sidebar — slides in from left */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'tween', duration: 0.25 }}
                        className={`fixed top-0 left-0 z-50 h-full flex flex-col shadow-xl lg:hidden ${baseClasses}`}
                    >
                        <SidebarContent onClose={onClose} />
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
};

export default Sidebar;
