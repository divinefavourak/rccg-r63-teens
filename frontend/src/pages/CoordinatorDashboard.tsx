import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api/axios';
import { useAuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
    Users, Search, RefreshCw, Download, CheckCircle,
    XCircle, ChevronRight, LogOut, Calendar, MapPin,
    Clock, ChevronLeft, FileText, BarChart3
} from 'lucide-react';

// Matches backend Province choices
const PROVINCE_LABELS: Record<string, string> = {
    lagos_province_9:   'Lagos Province 9',
    lagos_province_28:  'Lagos Province 28',
    lagos_province_69:  'Lagos Province 69',
    lagos_province_84:  'Lagos Province 84',
    lagos_province_86:  'Lagos Province 86',
    lagos_province_104: 'Lagos Province 104',
    regional_hq:        'Regional Headquarter',
};

interface Registration {
    id: string;
    registration_id: string;
    event: string;
    event_title: string;
    attendee_name: string;
    attendee_email: string;
    attendee_phone: string;
    attendee_age: number;
    attendee_gender: string;
    attendee_province: string;
    attendee_parish: string;
    status: string;
    payment_status: string;
    checked_in_at: string | null;
    created_at: string;
}

interface ProvinceEvent {
    id: string;
    title: string;
    start_datetime: string;
    venue: string;
    registration_count: number;
    max_attendees: number;
    registration_status: string;
}

const STATUS_COLOR: Record<string, string> = {
    pending:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    cancelled:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    checked_in: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    waitlisted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const PAGE_SIZE = 20;

const CoordinatorDashboard = () => {
    const { user, logout } = useAuthContext();
    const navigate = useNavigate();

    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [events, setEvents] = useState<ProvinceEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedEvent, setSelectedEvent] = useState('all');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [activeTab, setActiveTab] = useState<'registrations' | 'events'>('registrations');
    const [updating, setUpdating] = useState<string | null>(null);

    const province = (user as any)?.province || '';
    const provinceLabel = PROVINCE_LABELS[province] || province?.replace(/_/g, ' ') || 'My Province';

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch registrations for coordinator's province (backend auto-filters by province)
            const params = new URLSearchParams({
                page: String(page),
                page_size: String(PAGE_SIZE),
            });
            if (search)       params.set('search', search);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (selectedEvent !== 'all') params.set('event', selectedEvent);

            const [regRes, evtRes] = await Promise.all([
                api.get(`/events/registrations/?${params}`),
                api.get('/events/events/?status=published'),
            ]);

            const regData = regRes.data;
            setRegistrations(Array.isArray(regData) ? regData : regData.results || []);
            setTotal(regData.count || 0);

            const evtData = evtRes.data;
            setEvents(Array.isArray(evtData) ? evtData : evtData.results || []);
        } catch (err: any) {
            if (err?.response?.status === 403) {
                toast.error('Access denied. Coordinator privileges required.');
                navigate('/login');
            } else {
                toast.error('Failed to load data');
            }
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter, selectedEvent, navigate]);

    useEffect(() => {
        const t = setTimeout(fetchData, search ? 400 : 0);
        return () => clearTimeout(t);
    }, [fetchData]);

    const updateStatus = async (regId: string, newStatus: string) => {
        setUpdating(regId);
        try {
            await api.post(`/events/registrations/${regId}/update_status/`, { status: newStatus });
            toast.success(`Status updated to ${newStatus}`);
            fetchData();
        } catch {
            toast.error('Failed to update status');
        } finally {
            setUpdating(null);
        }
    };

    const exportCSV = () => {
        if (!registrations.length) return toast.error('No records to export');
        const headers = ['Ticket ID', 'Name', 'Email', 'Phone', 'Age', 'Gender', 'Parish', 'Status', 'Payment', 'Registered'];
        const rows = registrations.map(r => [
            r.registration_id, `"${r.attendee_name}"`, r.attendee_email,
            r.attendee_phone, r.attendee_age, r.attendee_gender,
            `"${r.attendee_parish}"`, r.status, r.payment_status,
            new Date(r.created_at).toLocaleDateString()
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${province}_registrations.csv`; a.click();
        toast.success('CSV exported!');
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const stats = {
        total: total,
        confirmed: registrations.filter(r => r.status === 'confirmed').length,
        pending: registrations.filter(r => r.status === 'pending').length,
        checked_in: registrations.filter(r => r.status === 'checked_in').length,
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Navbar />

            <div className="container mx-auto px-4 pt-28 pb-16">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <p className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1">
                            Coordinator Portal
                        </p>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">{provinceLabel}</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Manage registrations and events for your province
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => navigate('/coordinator/single-register')}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <FileText size={15} /> Single Register
                        </button>
                        <button
                            onClick={() => navigate('/coordinator/bulk-register')}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
                        >
                            <Users size={15} /> Bulk Register
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={16} className={`text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <Download size={15} /> Export CSV
                        </button>
                        <button
                            onClick={() => { logout?.(); navigate('/coordinator-login'); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <LogOut size={15} /> Logout
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Registrations', value: total, color: 'text-gray-900 dark:text-white', bg: 'bg-white dark:bg-gray-800', icon: <Users size={20} className="text-gray-400" /> },
                        { label: 'Confirmed',  value: stats.confirmed,  color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20',  icon: <CheckCircle size={20} className="text-green-500" /> },
                        { label: 'Pending',    value: stats.pending,    color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: <Clock size={20} className="text-yellow-500" /> },
                        { label: 'Attended',   value: stats.checked_in, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: <ChevronRight size={20} className="text-purple-500" /> },
                    ].map(s => (
                        <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex items-center justify-between shadow-sm`}>
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                            </div>
                            {s.icon}
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 w-fit">
                    {(['registrations', 'events'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                                activeTab === tab
                                    ? 'bg-primary-600 text-white shadow'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            {tab === 'registrations' ? <span className="flex items-center gap-2"><FileText size={14} /> Registrations</span>
                                                     : <span className="flex items-center gap-2"><BarChart3 size={14} /> Events</span>}
                        </button>
                    ))}
                </div>

                {activeTab === 'registrations' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                        {/* Filters */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                                <input
                                    type="text"
                                    placeholder="Search by name, email, ticket ID..."
                                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                                className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="checked_in">Attended</option>
                                <option value="waitlisted">Waitlisted</option>
                            </select>
                            <select
                                value={selectedEvent}
                                onChange={e => { setSelectedEvent(e.target.value); setPage(1); }}
                                className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white"
                            >
                                <option value="all">All Events</option>
                                {events.map(ev => (
                                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                                ))}
                            </select>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                    <tr>
                                        {['Attendee', 'Event', 'Contact', 'Parish', 'Status', 'Actions'].map(h => (
                                            <th key={h} className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {loading ? (
                                        <tr><td colSpan={6} className="py-16 text-center">
                                            <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
                                        </td></tr>
                                    ) : registrations.length === 0 ? (
                                        <tr><td colSpan={6} className="py-16 text-center text-gray-500">
                                            <Users size={36} className="mx-auto mb-3 opacity-30" />
                                            <p>No registrations found for your province.</p>
                                        </td></tr>
                                    ) : registrations.map(reg => {
                                        const sc = STATUS_COLOR[reg.status] || STATUS_COLOR.pending;
                                        const isUpdating = updating === reg.id;
                                        return (
                                            <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                                <td className="p-3">
                                                    <div className="font-semibold text-gray-900 dark:text-white">{reg.attendee_name}</div>
                                                    <div className="text-xs font-mono text-gray-400">{reg.registration_id}</div>
                                                    <div className="text-xs text-gray-400">{reg.attendee_age} yrs · <span className="capitalize">{reg.attendee_gender}</span></div>
                                                </td>
                                                <td className="p-3 text-xs text-gray-600 dark:text-gray-400 max-w-[140px] truncate">
                                                    {reg.event_title}
                                                </td>
                                                <td className="p-3 text-xs text-gray-600 dark:text-gray-400">
                                                    <div>{reg.attendee_email}</div>
                                                    <div>{reg.attendee_phone}</div>
                                                </td>
                                                <td className="p-3 text-xs text-gray-600 dark:text-gray-400 max-w-[130px] truncate">
                                                    {reg.attendee_parish}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sc}`}>
                                                        {reg.status === 'checked_in' ? 'Attended' : reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1">
                                                        {reg.status === 'pending' && (
                                                            <button
                                                                disabled={isUpdating}
                                                                onClick={() => updateStatus(reg.id, 'confirmed')}
                                                                title="Confirm"
                                                                className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-40"
                                                            >
                                                                <CheckCircle size={15} />
                                                            </button>
                                                        )}
                                                        {reg.status === 'confirmed' && !reg.checked_in_at && (
                                                            <button
                                                                disabled={isUpdating}
                                                                onClick={() => updateStatus(reg.id, 'checked_in')}
                                                                title="Mark as attended"
                                                                className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 hover:bg-purple-100 transition-colors disabled:opacity-40"
                                                            >
                                                                <ChevronRight size={15} />
                                                            </button>
                                                        )}
                                                        {!['cancelled', 'checked_in'].includes(reg.status) && (
                                                            <button
                                                                disabled={isUpdating}
                                                                onClick={() => updateStatus(reg.id, 'cancelled')}
                                                                title="Cancel"
                                                                className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40"
                                                            >
                                                                <XCircle size={15} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                                <span className="text-gray-500">
                                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <ChevronLeft size={15} />
                                    </button>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                                        {page} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <ChevronRight size={15} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Events Tab */
                    <div className="grid gap-4 md:grid-cols-2">
                        {loading ? (
                            [1,2,3,4].map(i => <div key={i} className="h-36 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />)
                        ) : events.length === 0 ? (
                            <div className="col-span-2 text-center py-16 text-gray-500">
                                <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                                <p>No upcoming events found.</p>
                            </div>
                        ) : events.map(ev => {
                            const pct = ev.max_attendees ? Math.min(((ev.registration_count || 0) / ev.max_attendees) * 100, 100) : 0;
                            return (
                                <div key={ev.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <h3 className="font-bold text-gray-900 dark:text-white">{ev.title}</h3>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold shrink-0 ${
                                            ev.registration_status === 'open' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {ev.registration_status}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={13} className="text-primary-500 shrink-0" />
                                            {new Date(ev.start_datetime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </div>
                                        {ev.venue && (
                                            <div className="flex items-center gap-2">
                                                <MapPin size={13} className="text-primary-500 shrink-0" />
                                                {ev.venue}
                                            </div>
                                        )}
                                    </div>
                                    {ev.max_attendees ? (
                                        <div>
                                            <div className="flex justify-between text-xs mb-1.5">
                                                <span className="text-gray-500">Province registrations</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                                    {ev.registration_count || 0}/{ev.max_attendees}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                                <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
};

export default CoordinatorDashboard;