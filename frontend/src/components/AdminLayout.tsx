import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import {
    LayoutDashboard,
    BookOpen,
    FileText,
    PlayCircle,
    Calendar,
    Users,
    Settings,
    Search,
    Bell,
    ChevronDown,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import logo from '../assets/logo.jpg'; // Adjust path if needed

const AdminLayout = () => {
    const { user, logout } = useAuthContext();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Sidebar navigation items
    const navItems = [
        { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
        { name: 'Devotionals', path: '/admin/devotionals', icon: <BookOpen size={20} /> },
        { name: 'Manuals', path: '/admin/manuals', icon: <FileText size={20} /> },
        { name: 'Media', path: '/admin/media', icon: <PlayCircle size={20} /> },
        { name: 'Events', path: '/admin/events', icon: <Calendar size={20} /> },
        { name: 'Users', path: '/admin/users', icon: <Users size={20} /> },
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans">

            {/* Mobile Sidebar Overlay */}
            {!isSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(true)}></div>
            )}

            {/* Sidebar */}
            <aside
                className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 transform 
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:translate-x-0`} // Always show on desktop? Or toggleable? 
            // Let's assume toggleable on both for max screen space, but default open on desktop. 
            // Actually sticking to standard admin dashboard behavior:
            // Mobile: Hidden by default, slides in. Desktop: Fixed.
            >
                <div className="h-full flex flex-col">
                    {/* Brand */}
                    <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
                        <img src={logo} alt="RCCG" className="w-8 h-8 rounded-full mr-3" />
                        <div>
                            <h1 className="font-bold text-lg text-gray-900 dark:text-white leading-none">RCCG R63 Teens</h1>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Admin Panel</span>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
                                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                    }`}
                            >
                                {item.icon}
                                {item.name}
                            </Link>
                        ))}
                    </div>

                    {/* Bottom Settings */}
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                        <Link
                            to="/admin/settings"
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50`}
                        >
                            <Settings size={20} />
                            Settings
                        </Link>
                    </div>
                </div>
            </aside>


            {/* Main Content */}
            <div className={`flex-1 flex flex-col min-w-0 transition-margin duration-300`}>

                {/* Topbar */}
                <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
                        >
                            <Menu size={20} />
                        </button>

                        {/* Search Bar */}
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="pl-10 pr-4 py-2 w-64 bg-gray-100 dark:bg-gray-700/50 border-none rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="relative text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
                        </button>

                        {/* Profile Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-3 focus:outline-none"
                            >
                                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">
                                    {user?.first_name?.charAt(0) || 'A'}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-none">
                                        {user?.first_name || 'Admin'} {user?.last_name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Admin</p>
                                </div>
                                <ChevronDown size={16} className="text-gray-500" />
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50 animate-fade-in-up">
                                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 md:hidden">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {user?.first_name || 'Admin'}
                                        </p>
                                        <p className="text-xs text-gray-500">Admin</p>
                                    </div>
                                    <Link to="/dashboard" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        User Dashboard
                                    </Link>
                                    <button
                                        onClick={logout}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
                                    >
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
