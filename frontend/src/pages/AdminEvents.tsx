import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    MapPin,
    Users,
    Calendar,
    MoreVertical,
    X
} from 'lucide-react';
import api from '../api/axios';
import type { Event } from '../types';
import toast from 'react-hot-toast';

const AdminEvents = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeType, setActiveType] = useState('All Types');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        details: '',
        location: '',
        start_date: '',
        end_date: '',
        price: 0,
        available_seats: 100,
        image: null as File | null
    });

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/content/events/');
            setEvents(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch events", error);
            toast.error("Failed to load events");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, image: e.target.files![0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                const value = formData[key as keyof typeof formData];
                if (value !== null && value !== '') {
                    data.append(key, value as string | Blob);
                }
            });

            await api.post('/content/events/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Event created successfully');
            setIsModalOpen(false);
            setFormData({
                title: '',
                description: '',
                details: '',
                location: '',
                start_date: '',
                end_date: '',
                price: 0,
                available_seats: 100,
                image: null
            });
            fetchEvents();
        } catch (error) {
            console.error("Failed to create event", error);
            toast.error("Failed to create event");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate Stats
    const upcomingCount = events.filter(e => new Date(e.start_date) > new Date()).length;
    const totalRegistrations = events.reduce((sum, e) => sum + (e.registration_count || 0), 0);
    const capacityRate = events.length > 0 ? Math.round((totalRegistrations / (events.reduce((sum, e) => sum + (e.available_seats || 100), 0))) * 100) : 0;

    const stats = [
        { title: 'Upcoming Events', value: upcomingCount, icon: <Calendar size={20} />, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
        { title: 'Total Registrations', value: totalRegistrations, icon: <Users size={20} />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        { title: 'Capacity Used', value: `${capacityRate}%`, icon: <MapPin size={20} />, color: 'text-green-600', bg: 'bg-gray-50 dark:bg-gray-800' },
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
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                >
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

            {/* Create Event Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl my-8">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create New Event</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Title</label>
                                        <input 
                                            type="text" 
                                            name="title" 
                                            required
                                            className="form-input" 
                                            value={formData.title}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date & Time</label>
                                        <input 
                                            type="datetime-local" 
                                            name="start_date" 
                                            required
                                            className="form-input" 
                                            value={formData.start_date}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date & Time</label>
                                        <input 
                                            type="datetime-local" 
                                            name="end_date" 
                                            required
                                            className="form-input" 
                                            value={formData.end_date}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                                        <input 
                                            type="text" 
                                            name="location" 
                                            required
                                            className="form-input" 
                                            value={formData.location}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (₦)</label>
                                        <input 
                                            type="number" 
                                            name="price" 
                                            className="form-input" 
                                            value={formData.price}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity</label>
                                        <input 
                                            type="number" 
                                            name="available_seats" 
                                            className="form-input" 
                                            value={formData.available_seats}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short Description</label>
                                        <textarea 
                                            name="description" 
                                            rows={2} 
                                            required
                                            className="form-input" 
                                            value={formData.description}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Details</label>
                                        <textarea 
                                            name="details" 
                                            rows={4} 
                                            className="form-input" 
                                            value={formData.details}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Banner Image</label>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting}
                                        className="w-full btn-primary py-3 flex justify-center items-center gap-2"
                                    >
                                        {isSubmitting ? <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span> : <Plus size={20} />}
                                        {isSubmitting ? 'Creating...' : 'Create Event'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminEvents;
