import { useState, useEffect, type ReactNode } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Calendar, MapPin, Clock, Ticket, CheckCircle, XCircle, AlertCircle, RefreshCw, Search, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface Registration {
    id: string;
    registration_id: string;
    event: string;
    event_title: string;
    attendee_name: string;
    attendee_email: string;
    attendee_phone: string;
    attendee_province: string;
    attendee_parish: string;
    attendee_category?: string;
    status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted' | 'checked_in' | 'no_show';
    payment_status: string;
    checked_in_at: string | null;
    created_at: string;
    event_detail?: {
        title: string;
        start_datetime: string;
        end_datetime: string;
        venue: string;
        city: string;
        cover_image: string;
        is_free: boolean;
        price: number;
    };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: ReactNode }> = {
    pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <AlertCircle size={14} /> },
    confirmed:  { label: 'Confirmed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: <CheckCircle size={14} /> },
    cancelled:  { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: <XCircle size={14} /> },
    waitlisted: { label: 'Waitlisted',color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: <Clock size={14} /> },
    checked_in: { label: 'Attended',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: <CheckCircle size={14} /> },
    no_show:    { label: 'No Show',   color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',          icon: <XCircle size={14} /> },
};

const DashboardEvents = () => {
    const navigate = useNavigate();
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'past'>('all');

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const fetchRegistrations = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/events/registrations/mine/');
            const list = Array.isArray(data) ? data : data.results || [];
            setRegistrations(list);
        } catch (error) {
            toast.error('Failed to load your registrations');
        } finally {
            setLoading(false);
        }
    };

    const now = new Date();

    const filtered = registrations.filter(reg => {
        const eventTitle = (reg.event_title || reg.event_detail?.title || '').toLowerCase();
        const matchesSearch =
            eventTitle.includes(searchQuery.toLowerCase()) ||
            (reg.registration_id || '').toLowerCase().includes(searchQuery.toLowerCase());

        const startDt = reg.event_detail?.start_datetime;
        if (activeFilter === 'upcoming') {
            return matchesSearch && startDt ? new Date(startDt) > now : matchesSearch;
        }
        if (activeFilter === 'past') {
            return matchesSearch && startDt ? new Date(startDt) <= now : matchesSearch;
        }
        return matchesSearch;
    });

    const formatDate = (dt: string) =>
        new Date(dt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const formatTime = (dt: string) =>
        new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Event Tickets</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        {registrations.length} registration{registrations.length !== 1 ? 's' : ''} total
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchRegistrations}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={`text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <Link
                        to="/events"
                        className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
                    >
                        <Ticket size={16} /> Browse Events
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by event name or ticket ID..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 dark:text-white text-sm"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                    {(['all', 'upcoming', 'past'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                                activeFilter === f
                                    ? 'bg-primary-600 text-white shadow'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-44 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <Ticket size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No tickets found</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        {registrations.length === 0
                            ? "You haven't registered for any events yet."
                            : "No registrations match your search."}
                    </p>
                    <Link to="/events" className="btn-primary px-6 py-3 inline-flex items-center gap-2">
                        <Calendar size={18} /> Browse Events
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {filtered.map(reg => {
                        const status = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
                        const ed = reg.event_detail;
                        const isUpcoming = ed?.start_datetime ? new Date(ed.start_datetime) > now : false;

                        return (
                            <div key={reg.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Cover strip */}
                                <div className={`h-2 ${isUpcoming ? 'bg-gradient-to-r from-primary-500 to-primary-700' : 'bg-gray-200 dark:bg-gray-600'}`} />

                                <div className="p-5">
                                    {/* Title row */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{reg.event_title}</h3>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${status.color}`}>
                                            {status.icon} {status.label}
                                        </span>
                                    </div>

                                    {/* Event info */}
                                    {ed && (
                                        <div className="space-y-1.5 mb-4 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={13} className="text-primary-500 shrink-0" />
                                                <span>{formatDate(ed.start_datetime)} · {formatTime(ed.start_datetime)}</span>
                                            </div>
                                            {ed.venue && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={13} className="text-primary-500 shrink-0" />
                                                    <span>{ed.venue}{ed.city ? `, ${ed.city}` : ''}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Ticket ID + actions */}
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">Ticket ID</p>
                                            <p className="font-mono text-sm font-bold text-gray-700 dark:text-gray-300">{reg.registration_id}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {reg.checked_in_at && (
                                                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                                                    <CheckCircle size={12} /> Attended
                                                </span>
                                            )}
                                            <Link
                                                to={`/events/${reg.event}`}
                                                className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline-offset-2 hover:underline"
                                            >
                                                Event →
                                            </Link>
                                            <button
                                                onClick={() => navigate('/ticket-preview', { state: { registration: reg } })}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition-colors"
                                                title="View & download your pass"
                                            >
                                                <Download size={12} /> Pass
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DashboardEvents;
