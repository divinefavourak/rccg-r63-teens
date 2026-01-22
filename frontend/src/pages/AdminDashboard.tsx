import { useAuthContext } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import {
    Users,
    BookOpen,
    PlayCircle,
    Calendar,
    Plus,
    TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Mon', active: 400 },
    { name: 'Tue', active: 300 },
    { name: 'Wed', active: 550 },
    { name: 'Thu', active: 450 },
    { name: 'Fri', active: 600 },
    { name: 'Sat', active: 700 },
    { name: 'Sun', active: 900 },
];

const AdminDashboard = () => {
    useAuthContext(); // Verify authentication

    const [statsData, setStatsData] = useState({
        users: 0,
        devotionals: 0,
        media: 0,
        events: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const [usersRes, devotionalsRes, mediaRes, eventsRes] = await Promise.all([
                api.get('/users/'),
                api.get('/content/devotionals/'),
                api.get('/content/media/'),
                api.get('/content/events/')
            ]);

            const upcomingEvents = (eventsRes.data.results || eventsRes.data || []).filter((e: any) => new Date(e.start_date || e.date) > new Date()).length;

            setStatsData({
                users: (usersRes.data.results || usersRes.data || []).length,
                devotionals: (devotionalsRes.data.results || devotionalsRes.data || []).length,
                media: (mediaRes.data.results || mediaRes.data || []).length,
                events: upcomingEvents
            });
        } catch (error) {
            console.error("Failed to fetch dashboard stats", error);
        } finally {
            setLoading(false);
        }
    };

    const stats = [
        { title: 'Total Users', value: loading ? '...' : statsData.users, change: '+12%', icon: <Users size={20} />, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
        { title: 'Devotionals', value: loading ? '...' : statsData.devotionals, change: '+8%', icon: <BookOpen size={20} />, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' }, // Changed "Reads" to "Count" for now as we don't have analytics endpoint
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">User Activity</h3>
                        <select className="bg-gray-50 dark:bg-gray-700 border-none rounded-lg text-sm px-3 py-1 focus:ring-0 text-gray-600 dark:text-gray-300 outline-none">
                            <option>Last 7 days</option>
                            <option>Last 30 days</option>
                            <option>This Year</option>
                        </select>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} /> // Green-500
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
