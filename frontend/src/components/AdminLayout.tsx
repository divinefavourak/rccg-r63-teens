import { useState, useEffect, useRef } from 'react';
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
    Clock,
    UserPlus,
    CheckCircle,
    X
} from 'lucide-react';
import api from '../api/axios';
import logo from '../assets/logo.jpg';

interface NotifItem {
    id: string;
    type: 'pending_reg' | 'audit';
    title: string;
    subtitle: string;
    time: string;
    icon: React.ReactNode;
}

const AdminLayout = () => {
    const { user, logout } = useAuthContext();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Notifications
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifs, setNotifs] = useState<NotifItem[]>([]);
    const [notifLoading, setNotifLoading] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const notifRef = useRef<HTMLDivElement>(null);

    // Close notification panel when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch pending count on mount for badge
    useEffect(() => {
        api.get('/events/registrations/?status=pending&page_size=1')
            .then(res => {
                const count = res.data?.count ?? (Array.isArray(res.data) ? res.data.length : 0);
                setPendingCount(count);
            })
            .catch(() => {});
    }, []);

    const fetchNotifications = async () => {
        setNotifLoading(true);
        try {
            const [pendingRes, auditRes] = await Promise.all([
                api.get('/events/registrations/?status=pending&page_size=5'),
                api.get('/auth/audit-logs/?page_size=5'),
            ]);

            const pendingRegs: NotifItem[] = (pendingRes.data?.results ?? pendingRes.data ?? [])
                .map((r: any) => ({
                    id: `reg-${r.id}`,
                    type: 'pending_reg' as const,
                    title: `Pending: ${r.attendee_name || 'Unknown'}`,
                    subtitle: r.event_title || r.event || 'Event registration',
                    time: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
                    icon: <Clock size={14} className="text-amber-500" />,
                }));

            const auditLogs: NotifItem[] = (auditRes.data?.results ?? auditRes.data ?? [])
                .map((a: any) => ({
                    id: `audit-${a.id}`,
                    type: 'audit' as const,
                    title: `${a.action_display || a.action} — ${a.entity_type}`,
                    subtitle: `by ${a.user_display || 'System'}`,
                    time: a.timestamp ? new Date(a.timestamp).toLocaleString() : '',
                    icon: a.action === 'create'
                        ? <UserPlus size={14} className="text-green-500" />
                        : <CheckCircle size={14} className="text-primary-500" />,
                }));

            setNotifs([...pendingRegs, ...auditLogs].slice(0, 8));
            setPendingCount(pendingRes.data?.count ?? pendingRegs.length);
        } catch {
            // silently fail — notifications are not critical
        } finally {
            setNotifLoading(false);
        }
    };

    const handleBellClick = () => {
        if (!notifOpen) fetchNotifications();
        setNotifOpen(o => !o);
        setIsProfileOpen(false);
    };

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
                        {/* ── Notification Bell ── */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={handleBellClick}
                                className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <Bell size={20} />
                                {pendingCount > 0 && (
                                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-800">
                                        {pendingCount > 9 ? '9+' : pendingCount}
                                    </span>
                                )}
                            </button>

                            {notifOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                                    {/* Panel header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-white">Notifications</p>
                                            {pendingCount > 0 && (
                                                <p className="text-xs text-amber-600 font-medium">{pendingCount} pending registration{pendingCount !== 1 ? 's' : ''}</p>
                                            )}
                                        </div>
                                        <button onClick={() => setNotifOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {/* List */}
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifLoading ? (
                                            <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
                                        ) : notifs.length === 0 ? (
                                            <div className="py-8 text-center text-sm text-gray-400">
                                                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                                                No notifications
                                            </div>
                                        ) : notifs.map(n => (
                                            <Link
                                                key={n.id}
                                                to={n.type === 'pending_reg' ? '/admin/events' : '/admin/dashboard'}
                                                onClick={() => setNotifOpen(false)}
                                                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                                                    {n.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{n.title}</p>
                                                    <p className="text-xs text-gray-500 truncate">{n.subtitle}</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{n.time}</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>

                                    {/* Footer */}
                                    <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                                        <Link
                                            to="/admin/events"
                                            onClick={() => setNotifOpen(false)}
                                            className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                                        >
                                            View all registrations →
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

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
