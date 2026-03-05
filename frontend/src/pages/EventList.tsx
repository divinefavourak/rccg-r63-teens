import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { type Event } from '../types';
import { Calendar, MapPin, Users, ArrowRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const EventList = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const { data } = await api.get('/events/events/');
            setEvents(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error('Failed to fetch events');
        } finally {
            setLoading(false);
        }
    };

    const now = new Date();
    const filtered = events.filter(e => {
        const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.venue || '').toLowerCase().includes(searchQuery.toLowerCase());
        const isUpcoming = new Date(e.start_datetime) >= now;
        if (filter === 'upcoming') return matchesSearch && isUpcoming;
        if (filter === 'past') return matchesSearch && !isUpcoming;
        return matchesSearch;
    });

    const formatDate = (dt: string) =>
        new Date(dt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const formatTime = (dt: string) =>
        new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="container mx-auto px-4 py-24">

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase mb-4">
                        UPCOMING EVENTS
                    </h1>
                    <div className="w-24 h-1 bg-yellow-500 mx-auto rounded-full mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">
                        Join us for life-changing programs and gatherings.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search events..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                        {(['upcoming', 'all', 'past'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                                    filter === f
                                        ? 'bg-primary-600 text-white shadow'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-72 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-2xl" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-24 text-gray-500 dark:text-gray-400">
                        <Calendar size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">No events found.</p>
                    </div>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {filtered.map(event => {
                            const isUpcoming = new Date(event.start_datetime) >= now;
                            return (
                                <div
                                    key={event.id}
                                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col group hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                >
                                    {/* Image / Date Card */}
                                    <div className="h-48 bg-gradient-to-br from-primary-900 to-primary-700 relative overflow-hidden">
                                        {event.cover_image ? (
                                            <img
                                                src={event.cover_image}
                                                alt={event.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-white/60">
                                                <span className="text-5xl font-black text-white">
                                                    {new Date(event.start_datetime).getDate()}
                                                </span>
                                                <span className="uppercase tracking-widest text-sm">
                                                    {new Date(event.start_datetime).toLocaleString('default', { month: 'short' })}
                                                </span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                        <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold uppercase shadow ${
                                            isUpcoming ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                                        }`}>
                                            {isUpcoming ? 'Upcoming' : 'Past'}
                                        </span>
                                        {event.is_free === false && event.price > 0 && (
                                            <span className="absolute top-4 left-4 bg-yellow-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-full shadow">
                                                ₦{Number(event.price).toLocaleString()}
                                            </span>
                                        )}
                                        {(event.is_free || event.price === 0) && (
                                            <span className="absolute top-4 left-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                                                FREE
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-6 flex-1 flex flex-col">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 leading-tight">
                                            {event.title}
                                        </h3>
                                        {event.short_description && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                                {event.short_description}
                                            </p>
                                        )}
                                        <div className="space-y-2 mb-5 mt-auto">
                                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <Calendar size={15} className="text-primary-500 shrink-0" />
                                                <span>{formatDate(event.start_datetime)} · {formatTime(event.start_datetime)}</span>
                                            </div>
                                            {event.venue && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                    <MapPin size={15} className="text-primary-500 shrink-0" />
                                                    <span>{event.venue}{event.city ? `, ${event.city}` : ''}</span>
                                                </div>
                                            )}
                                            {event.max_attendees && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                    <Users size={15} className="text-primary-500 shrink-0" />
                                                    <span>{event.spots_remaining ?? event.max_attendees} spots remaining</span>
                                                </div>
                                            )}
                                        </div>

                                        <Link
                                            to={`/events/${event.id}`}
                                            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold"
                                        >
                                            View Details <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventList;
