import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    MapPin,
    Users,
    Calendar,
    X,
    ChevronRight,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import api from '../api/axios';
import type { Event } from '../types';
import toast from 'react-hot-toast';

interface Registration {
    id: string;
    registration_id: string;
    attendee_name: string;
    attendee_email: string;
    attendee_phone: string;
    attendee_province: string;
    attendee_parish: string;
    attendee_age: number;
    attendee_gender: string;
    status: string;
    payment_status: string;
    created_at: string;
    checked_in_at: string | null;
}

const REG_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    confirmed:  { label: 'Confirmed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    cancelled:  { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    waitlisted: { label: 'Waitlisted',color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    checked_in: { label: 'Attended',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    no_show:    { label: 'No Show',   color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

const AdminEvents = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeType, setActiveType] = useState('All Types');
    const [searchQuery, setSearchQuery] = useState('');
    // Registrations panel
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [regLoading, setRegLoading] = useState(false);
    const [regSearch, setRegSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
    const [bulkConfirming, setBulkConfirming] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        event_type: 'other',
        short_description: '',
        description: '',
        venue: '',
        city: '',
        start_datetime: '',
        end_datetime: '',
        price: 0,
        is_free: false,
        max_attendees: 100,
        image: null as File | null
    });

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            // CORRECTED: Pointing to 'events' resource inside 'events' app
            const { data } = await api.get('/events/events/');
            setEvents(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch events", error);
            toast.error("Failed to load events");
        } finally {
            setLoading(false);
        }
    };

    const fetchRegistrations = async (event: Event) => {
        setSelectedEvent(event);
        setRegistrations([]);
        setRegSearch('');
        setSelectedIds([]);
        setRegLoading(true);
        try {
            const { data } = await api.get(`/events/events/${event.id}/registrations/`);
            const list = Array.isArray(data) ? data : data.results || [];
            setRegistrations(list);
        } catch (err) {
            toast.error('Failed to load registrations');
        } finally {
            setRegLoading(false);
        }
    };

    const updateRegStatus = async (regId: string, newStatus: string) => {
        try {
            await api.post(`/events/registrations/${regId}/update_status/`, { status: newStatus });
            toast.success(`Status updated to ${newStatus}`);
            if (selectedEvent) fetchRegistrations(selectedEvent);
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleBulkConfirm = async () => {
        setBulkConfirming(true);
        let succeeded = 0;
        for (const id of selectedIds) {
            try {
                await api.post(`/events/registrations/${id}/update_status/`, { status: 'confirmed' });
                succeeded++;
            } catch {
                // continue with remaining
            }
        }
        toast.success(`${succeeded} registration${succeeded !== 1 ? 's' : ''} confirmed`);
        setSelectedIds([]);
        setBulkConfirmOpen(false);
        setBulkConfirming(false);
        if (selectedEvent) fetchRegistrations(selectedEvent);
    };


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
            data.append('title', formData.title);
            data.append('event_type', formData.event_type);
            data.append('short_description', formData.short_description);
            // description is required by the backend — fall back to short_description if blank
            data.append('description', formData.description || formData.short_description);
            data.append('venue', formData.venue);
            data.append('city', formData.city);
            data.append('start_datetime', new Date(formData.start_datetime).toISOString());
            data.append('end_datetime', new Date(formData.end_datetime).toISOString());
            data.append('max_attendees', String(formData.max_attendees));
            data.append('price', String(formData.price));
            data.append('is_free', formData.price === 0 ? 'true' : 'false');
            data.append('status', 'published');
            data.append('registration_status', 'open');
            if (formData.image) data.append('cover_image', formData.image);

            await api.post('/events/events/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Event created successfully');
            setIsModalOpen(false);
            setFormData({
                title: '',
                event_type: 'other',
                short_description: '',
                description: '',
                venue: '',
                city: '',
                start_datetime: '',
                end_datetime: '',
                price: 0,
                is_free: false,
                max_attendees: 100,
                image: null
            });
            fetchEvents();
        } catch (error: any) {
            const detail = error?.response?.data;
            console.error('Failed to create event:', detail || error);
            const msg = detail ? JSON.stringify(detail) : 'Failed to create event';
            toast.error(msg.length < 150 ? msg : 'Failed to create event. Check console for details.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate Stats
    const upcomingCount = events.filter(e => new Date(e.start_datetime) > new Date()).length;
    const totalRegistrations = events.reduce((sum, e) => sum + (e.registration_count || 0), 0);
    const capacityRate = events.length > 0 ? Math.round((totalRegistrations / (events.reduce((sum, e) => sum + (e.max_attendees || 100), 0))) * 100) : 0;

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
                                        <div className="font-medium text-gray-900 dark:text-white">{new Date(item.start_datetime).toLocaleDateString()}</div>
                                        <div className="text-xs">{new Date(item.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{item.venue}</td>
                                    <td className="p-4 w-48">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">{item.registration_count}/{item.max_attendees || 100}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full"
                                                style={{ width: `${Math.min(((item.registration_count || 0) / (item.max_attendees || 100)) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${new Date(item.start_datetime) > new Date() ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {new Date(item.start_datetime) > new Date() ? 'Upcoming' : 'Past'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => fetchRegistrations(item)}
                                            className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                                        >
                                            <Users size={13} /> Manage
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Registrations Drawer */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={e => e.target === e.currentTarget && setSelectedEvent(null)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-3xl h-full flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Event Registrations</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{selectedEvent.title}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {registrations.length} registrant{registrations.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedIds.length > 0 && (
                                    <button
                                        onClick={() => setBulkConfirmOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
                                    >
                                        <CheckCircle size={14} /> Bulk Confirm ({selectedIds.length})
                                    </button>
                                )}
                                <button onClick={() => fetchRegistrations(selectedEvent)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                    title="Refresh"
                                >
                                    <RefreshCw size={16} className={`text-gray-500 ${regLoading ? 'animate-spin' : ''}`} />
                                </button>
                                <button onClick={() => setSelectedEvent(null)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search by name, email, or ticket ID..."
                                    className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                                    value={regSearch}
                                    onChange={e => setRegSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Stats bar */}
                        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 flex gap-4 text-xs shrink-0">
                            {Object.entries(REG_STATUS_CONFIG).map(([key, cfg]) => {
                                const count = registrations.filter(r => r.status === key).length;
                                if (!count) return null;
                                return (
                                    <span key={key} className={`px-2 py-1 rounded-full font-bold ${cfg.color}`}>
                                        {cfg.label}: {count}
                                    </span>
                                );
                            })}
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-y-auto">
                            {regLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
                                </div>
                            ) : registrations.length === 0 ? (
                                <div className="text-center py-20 text-gray-500">
                                    <Users size={36} className="mx-auto mb-3 opacity-30" />
                                    <p>No registrations yet for this event.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                                        <tr>
                                            <th className="p-3 w-8">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    checked={selectedIds.length > 0 && registrations.filter(r => r.status === 'pending').every(r => selectedIds.includes(r.id))}
                                                    onChange={e => {
                                                        const pendingIds = registrations.filter(r => r.status === 'pending').map(r => r.id);
                                                        setSelectedIds(e.target.checked ? pendingIds : []);
                                                    }}
                                                    title="Select all pending"
                                                />
                                            </th>
                                            <th className="p-3 text-xs font-bold text-gray-500 uppercase">Attendee</th>
                                            <th className="p-3 text-xs font-bold text-gray-500 uppercase">Contact</th>
                                            <th className="p-3 text-xs font-bold text-gray-500 uppercase">Province</th>
                                            <th className="p-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                                            <th className="p-3 text-xs font-bold text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {registrations
                                            .filter(r => {
                                                const q = regSearch.toLowerCase();
                                                return !q || r.attendee_name.toLowerCase().includes(q) ||
                                                    r.attendee_email.toLowerCase().includes(q) ||
                                                    r.registration_id.toLowerCase().includes(q);
                                            })
                                            .map(reg => {
                                                const sc = REG_STATUS_CONFIG[reg.status] || REG_STATUS_CONFIG.pending;
                                                return (
                                                    <tr key={reg.id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/20 ${selectedIds.includes(reg.id) ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
                                                        <td className="p-3">
                                                            {reg.status === 'pending' && (
                                                                <input
                                                                    type="checkbox"
                                                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                                    checked={selectedIds.includes(reg.id)}
                                                                    onChange={e => setSelectedIds(prev =>
                                                                        e.target.checked ? [...prev, reg.id] : prev.filter(id => id !== reg.id)
                                                                    )}
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="font-semibold text-gray-900 dark:text-white">{reg.attendee_name}</div>
                                                            <div className="text-xs text-gray-400 font-mono">{reg.registration_id}</div>
                                                        </td>
                                                        <td className="p-3 text-gray-600 dark:text-gray-400">
                                                            <div>{reg.attendee_email}</div>
                                                            <div className="text-xs">{reg.attendee_phone}</div>
                                                        </td>
                                                        <td className="p-3 text-gray-600 dark:text-gray-400 text-xs">
                                                            <div>{reg.attendee_province?.replace(/_/g, ' ')}</div>
                                                            <div className="text-gray-400">{reg.attendee_parish}</div>
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${sc.color}`}>
                                                                {sc.label}
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-1">
                                                                {reg.status === 'pending' && (
                                                                    <button
                                                                        onClick={() => updateRegStatus(reg.id, 'confirmed')}
                                                                        title="Confirm"
                                                                        className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 transition-colors"
                                                                    >
                                                                        <CheckCircle size={15} />
                                                                    </button>
                                                                )}
                                                                {reg.status !== 'cancelled' && reg.status !== 'checked_in' && (
                                                                    <button
                                                                        onClick={() => updateRegStatus(reg.id, 'cancelled')}
                                                                        title="Cancel"
                                                                        className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors"
                                                                    >
                                                                        <XCircle size={15} />
                                                                    </button>
                                                                )}
                                                                {reg.status === 'confirmed' && !reg.checked_in_at && (
                                                                    <button
                                                                        onClick={() => updateRegStatus(reg.id, 'checked_in')}
                                                                        title="Mark as checked-in"
                                                                        className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 hover:bg-purple-100 transition-colors"
                                                                    >
                                                                        <ChevronRight size={15} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        }
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Confirm Modal */}
            {bulkConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                <CheckCircle size={22} className="text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bulk Confirm</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Confirm <span className="font-bold text-gray-900 dark:text-white">{selectedIds.length}</span> registration{selectedIds.length !== 1 ? 's' : ''}? This will mark them all as <span className="font-semibold text-green-600">Confirmed</span>.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setBulkConfirmOpen(false)}
                                disabled={bulkConfirming}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkConfirm}
                                disabled={bulkConfirming}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {bulkConfirming
                                    ? <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Confirming...</>
                                    : <><CheckCircle size={16} /> Confirm All</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Event Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
                    <div className="flex min-h-full items-start justify-center p-4 py-8">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create New Event</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
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
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type</label>
                                        <select
                                            name="event_type"
                                            className="form-input"
                                            value={formData.event_type}
                                            onChange={handleInputChange}
                                        >
                                            <option value="campout">Camp Out</option>
                                            <option value="conference">Conference</option>
                                            <option value="hangout">Hangout</option>
                                            <option value="retreat">Retreat</option>
                                            <option value="workshop">Workshop</option>
                                            <option value="service">Service</option>
                                            <option value="outreach">Outreach</option>
                                            <option value="concert">Concert</option>
                                            <option value="webinar">Webinar</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date &amp; Time</label>
                                        <input 
                                            type="datetime-local" 
                                            name="start_datetime" 
                                            required
                                            className="form-input" 
                                            value={formData.start_datetime}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date & Time</label>
                                        <input 
                                            type="datetime-local" 
                                            name="end_datetime" 
                                            required
                                            className="form-input" 
                                            value={formData.end_datetime}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Venue / Location</label>
                                        <input 
                                            type="text" 
                                            name="venue" 
                                            required
                                            className="form-input" 
                                            value={formData.venue}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                                        <input 
                                            type="text" 
                                            name="city"
                                            className="form-input" 
                                            value={formData.city}
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
                                            name="max_attendees" 
                                            className="form-input" 
                                            value={formData.max_attendees}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short Description</label>
                                        <textarea 
                                            name="short_description" 
                                            rows={2} 
                                            required
                                            className="form-input" 
                                            value={formData.short_description}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Details</label>
                                        <textarea 
                                            name="description" 
                                            rows={4} 
                                            className="form-input" 
                                            value={formData.description}
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
                </div>
            )}
        </div>
    );
};

export default AdminEvents;
