import { useAuthContext } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import {
    Users,
    BookOpen,
    PlayCircle,
    Calendar,
    Plus,
    TrendingUp,
    RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart } from 'recharts';

const AdminDashboard = () => {
    useAuthContext(); // Verify authentication

    const [statsData, setStatsData] = useState({
        users: 0,
        devotionals: 0,
        media: 0,
        events: 0
    });
    const [loading, setLoading] = useState(true);
    const [roleStats, setRoleStats] = useState<Record<string, number>>({});
    const [chartData, setChartData] = useState<{ name: string; active: number }[]>([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState('7');

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchActivityData();
    }, [selectedPeriod]);

    const fetchStats = async () => {
        try {
            // CORRECTED ENDPOINTS based on url configs
            const [usersRes, devotionalsRes, mediaRes, eventsRes] = await Promise.all([
                api.get('/auth/users/'),
                api.get('/content/devotionals/'),
                api.get('/media/episodes/'),
                api.get('/events/events/')
            ]);

            const getCount = (res: any) => {
                if (Array.isArray(res.data)) return res.data.length;
                if (res.data?.count !== undefined) return res.data.count;
                if (Array.isArray(res.data?.results)) return res.data.results.length;
                return 0;
            };

            const upcomingEvents = (eventsRes.data.results || eventsRes.data || []).filter((e: any) => new Date(e.start_date || e.date) > new Date()).length;

            setStatsData({
                users: getCount(usersRes),
                devotionals: getCount(devotionalsRes),
                media: getCount(mediaRes),
                events: upcomingEvents
            });
            try {
                // Pagination is disabled on UserViewSet — this returns the full list
                const users: any[] = Array.isArray(usersRes.data)
                    ? usersRes.data
                    : usersRes.data?.results || [];
                const counts: Record<string, number> = {};
                users.forEach((u: any) => {
                    counts[u.role] = (counts[u.role] || 0) + 1;
                });
                setRoleStats(counts);
            } catch {}
        } catch (error) {
            console.error("Failed to fetch dashboard stats", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivityData = async () => {
        setChartLoading(true);
        try {
            // Try to fetch login history for activity data
            const response = await api.get('/auth/login-history/');
            const logins = response.data.results || response.data || [];

            // Group logins by day
            const days = parseInt(selectedPeriod);
            const activityMap: Record<string, number> = {};
            const today = new Date();

            // Initialize all days with 0
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const key = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                activityMap[key] = 0;
            }

            // Count logins per day
            logins.forEach((login: any) => {
                const loginDate = new Date(login.login_time || login.created_at || login.timestamp);
                const diffDays = Math.floor((today.getTime() - loginDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < days) {
                    const key = loginDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    if (activityMap[key] !== undefined) {
                        activityMap[key]++;
                    }
                }
            });

            // Convert to chart data format
            const chartDataArr = Object.entries(activityMap).map(([name, active]) => ({
                name: name.split(',')[0], // Just show day name for shorter labels
                active
            }));

            setChartData(chartDataArr);
        } catch (error) {
            console.error("Failed to fetch activity data, using placeholder", error);
            // Fallback to placeholder data if endpoint not available
            const days = parseInt(selectedPeriod);
            const placeholderData = [];
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const today = new Date();

            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                placeholderData.push({
                    name: dayNames[date.getDay()],
                    active: Math.floor(Math.random() * 50) + 10
                });
            }
            setChartData(placeholderData);
        } finally {
            setChartLoading(false);
        }
    };

    const stats = [
        { title: 'Total Users', value: loading ? '...' : statsData.users, change: '+12%', icon: <Users size={20} />, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
        { title: 'Devotionals', value: loading ? '...' : statsData.devotionals, change: '+8%', icon: <BookOpen size={20} />, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
        { title: 'Media Items', value: loading ? '...' : statsData.media, change: '+24%', icon: <PlayCircle size={20} />, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
        { title: 'Upcoming Events', value: loading ? '...' : statsData.events, change: '+2', icon: <Calendar size={20} />, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h2>
                <p className="text-gray-500 dark:text-gray-400">Welcome back! Here's what's happening with RCCG R63 Teens.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                {stat.icon}
                            </div>
                            <div className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                                <TrendingUp size={12} />
                                {stat.change}
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{stat.title}</p>
                    </div>
                ))}
            </div>

            {/* Role Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4">Users by Role</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {[
                        { role: 'toddler', label: 'Toddlers', color: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400' },
                        { role: 'child', label: 'Children', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' },
                        { role: 'teen', label: 'Teens', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
                        { role: 'teacher', label: 'Teachers', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' },
                        { role: 'coordinator', label: 'Coordinators', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' },
                        { role: 'admin', label: 'Admins', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
                        { role: 'individual', label: 'Individual', color: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
                    ].map(({ role, label, color }) => (
                        <div key={role} className={`${color} rounded-xl p-3 text-center`}>
                            <p className="text-2xl font-black">{roleStats[role] || 0}</p>
                            <p className="text-xs font-semibold mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">User Activity</h3>
                            {chartLoading && <RefreshCw size={16} className="animate-spin text-gray-400" />}
                        </div>
                        <select
                            className="bg-gray-50 dark:bg-gray-700 border-none rounded-lg text-sm px-3 py-1 focus:ring-0 text-gray-600 dark:text-gray-300 outline-none cursor-pointer"
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                        >
                            <option value="7">Last 7 days</option>
                            <option value="14">Last 14 days</option>
                            <option value="30">Last 30 days</option>
                        </select>
                    </div>

                    <div className="h-[300px] w-full" style={{ minHeight: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="active" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Actions & Recent */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <Link to="/admin/devotionals" className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                                        <BookOpen size={18} />
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-400">Add Devotional</span>
                                </div>
                                <Plus size={16} className="text-gray-400 group-hover:text-green-600" />
                            </Link>

                            <Link to="/admin/media" className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg">
                                        <PlayCircle size={18} />
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400">Upload Media</span>
                                </div>
                                <Plus size={16} className="text-gray-400 group-hover:text-amber-600" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
