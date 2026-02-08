
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Bell, Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-[#0a0202] text-gray-900 dark:text-white transition-colors duration-500 overflow-hidden">
            {/* Sidebar */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Dashboard Header */}
                <header className="bg-white dark:bg-[#1a0505] border-b border-gray-200 dark:border-yellow-500/10 h-16 flex items-center justify-between px-4 lg:px-8 z-20">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white lg:hidden">Faith Tribe</h2>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Search (Hidden on mobile for now) */}
                        <div className="hidden md:flex items-center bg-gray-100 dark:bg-white/5 rounded-full px-4 py-2 border border-transparent focus-within:border-yellow-500/50 transition-all w-64">
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
                            className="p-2 rounded-full text-gray-500 dark:text-orange-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        {/* Notifications */}
                        <button className="p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>

                        {/* User Profile */}
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 to-red-500 p-[2px] cursor-pointer">
                            <div className="h-full w-full rounded-full bg-white dark:bg-black overflow-hidden">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="h-full w-full object-cover" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Scrollable Main Content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
