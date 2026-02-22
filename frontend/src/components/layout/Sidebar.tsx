
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, FileText, Headphones, Calendar, Settings, LogOut, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import rccgLogo from '../../assets/logo.jpg';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const navItems = [
        { name: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Devotionals', icon: BookOpen, path: '/dashboard/devotionals' },
        { name: 'Manuals', icon: FileText, path: '/dashboard/manuals' },
        { name: 'Podcasts', icon: Headphones, path: '/dashboard/podcasts' },
        { name: 'Events', icon: Calendar, path: '/dashboard/events' },
        { name: 'Settings', icon: Settings, path: '/dashboard/settings' },
    ];

    const sidebarVariants = {
        open: { x: 0, opacity: 1 },
        closed: { x: '-100%', opacity: 0 },
    };

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <motion.aside
                variants={sidebarVariants}
                initial="closed"
                animate={isOpen ? 'open' : 'closed'}
                // On desktop (lg), we want it always visible. 
                // We'll handle desktop visibility via CSS classes instead of just motion for responsiveness
                className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-[#1a0505] border-r border-gray-200 dark:border-yellow-500/20 shadow-2xl lg:transform-none lg:opacity-100 lg:static transition-colors duration-300 ${!isOpen ? 'hidden lg:block' : ''}`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-yellow-500/10">
                        <div className="flex items-center gap-3">
                            <img src={rccgLogo} alt="Logo" className="w-10 h-10 rounded-full border border-yellow-500/50" />
                            <div>
                                <h1 className="font-['Impact'] text-red-900 dark:text-white text-lg tracking-wide">FAITH TRIBE</h1>
                                <p className="text-[10px] text-yellow-600 font-bold uppercase tracking-wider">Teens Platform</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-red-600">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => onClose()} // Close on mobile when clicked
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive
                                        ? 'bg-red-50 dark:bg-yellow-500/10 text-red-700 dark:text-yellow-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-yellow-200'
                                    }`
                                }
                            >
                                <item.icon size={20} />
                                <span>{item.name}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-100 dark:border-yellow-500/10">
                        <button className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 rounded-xl transition-all">
                            <LogOut size={20} />
                            <span className="font-medium">Sign Out</span>
                        </button>
                    </div>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;
