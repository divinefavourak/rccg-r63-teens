import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    MapPin,
    Users,
    Calendar,
    MoreVertical
} from 'lucide-react';
import api from '../api/axios';
import type { Event } from '../types';
import toast from 'react-hot-toast';

const AdminEvents = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeType, setActiveType] = useState('All Types');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/events/');
            setEvents(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch events", error);
            toast.error("Failed to load events");
        } finally {
            setLoading(false);
        }
    };

    // Calculate Stats
    const upcomingCount = events.filter(e => new Date(e.start_date) > new Date()).length;
    const totalRegistrations = events.reduce((sum, e) => sum + (e.registration_count || 0), 0);
    const capacityRate = events.length > 0 ? Math.round((totalRegistrations / (events.reduce((sum, e) => sum + (e.available_seats || 100), 0))) * 100) : 0;

    const stats = [
        { title: 'Upcoming Events', value: upcomingCount, icon: <Calendar size={20} />, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
        { title: 'Total Registrations', value: totalRegistrations, icon: <Users size={20} />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        { title: 'Capacity Used', value: `${capacityRate}%`, icon: <MapPin size={20} />, color: 'text-green-600', bg: 'bg-gray-50 dark:bg-gray-800' }, // MapPin as placeholder for location/capacity
    ];

    const filteredEvents = events.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Events Management</h2>
                    <p className="text-gray-500 dark:text-gray-400">Create and manage teen events and activities</p>
                </div>
                <button className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                    <Plus size={20} /> Create Event
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-2">{stat.title}</p>
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
                        </div>
                        <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                            {stat.icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search events..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:border-green-500"
                        value={activeType}
                        onChange={(e) => setActiveType(e.target.value)}
                    >
                        <option>All Types</option>
                        <option>Conference</option>
                        <option>Concert</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Event Name</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Registrations</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading events...</td></tr>
                            ) : filteredEvents.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No events found.</td></tr>
                            ) : filteredEvents.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900 dark:text-white">{item.title}</div>
                                        <div className="text-xs text-gray-500">{item.price > 0 ? `₦${item.price}` : 'Free'}</div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                        <div className="font-medium text-gray-900 dark:text-white">{new Date(item.start_date).toLocaleDateString()}</div>
                                        <div className="text-xs">{new Date(item.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{item.location}</td>
                                    <td className="p-4 w-48">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">{item.registration_count}/{item.available_seats || 100}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full"
                                                style={{ width: `${Math.min(((item.registration_count || 0) / (item.available_seats || 100)) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${new Date(item.start_date) > new Date() ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {new Date(item.start_date) > new Date() ? 'Upcoming' : 'Past'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg">
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminEvents;
