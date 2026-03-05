
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, FileText, Headphones, Calendar, Settings, LogOut, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import rccgLogo from '../../assets/logo.jpg';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const navItems = [
    { name: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Devotionals', icon: BookOpen, path: '/dashboard/devotionals' },
    { name: 'Manuals', icon: FileText, path: '/dashboard/manuals' },
    { name: 'Podcasts', icon: Headphones, path: '/dashboard/podcasts' },
    { name: 'Events', icon: Calendar, path: '/dashboard/events' },
    { name: 'Settings', icon: Settings, path: '/dashboard/settings' },
];

const SidebarContent = ({ onClose }: { onClose: () => void }) => (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
                <img src={rccgLogo} alt="Logo" className="w-10 h-10 rounded-full ring-2 ring-primary-200 dark:ring-primary-800" />
                <div>
                    <h1 className="font-bold text-gray-900 dark:text-white text-base tracking-wide">FAITH TRIBE</h1>
                    <p className="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase tracking-wider">Teens Platform</p>
                </div>
            </div>
            <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
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
                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${isActive
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-300'
                        }`
                    }
                >
                    <item.icon size={20} />
                    <span>{item.name}</span>
                </NavLink>
            ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <button className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all font-medium text-sm">
                <LogOut size={20} />
                <span>Sign Out</span>
            </button>
        </div>
    </div>
);

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const baseClasses = "w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-colors duration-300";

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
