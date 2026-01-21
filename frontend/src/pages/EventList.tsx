import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { type Event } from '../types';
import { FaCalendarAlt, FaMapMarkerAlt, FaInfoCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const EventList = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const { data } = await api.get('/content/events/');
            setEvents(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch events");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="container mx-auto px-4 py-24">

                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase mb-4">
                        UPCOMING EVENTS
                    </h1>
                    <div className="w-24 h-1 bg-yellow-500 mx-auto rounded-full"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                        Join us for life-changing programs and gatherings.
                    </p>
                </div>

                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-200 animate-pulse rounded-2xl"></div>)}
                    </div>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {events.length > 0 ? events.map((event) => (
                            <div key={event.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full group hover:shadow-xl transition-shadow">
                                <div className="h-48 bg-primary-800 relative">
                                    {/* Img or Placeholder */}
                                    {event.image ? (
                                        <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-primary-200">
                                            <span className="text-4xl font-black">{new Date(event.start_date).getDate()}</span>
                                            <span className="uppercase tracking-widest text-sm">{new Date(event.start_date).toLocaleString('default', { month: 'short' })}</span>
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 bg-yellow-500 text-red-900 text-xs font-bold px-3 py-1 rounded-full uppercase shadow">
                                        {new Date(event.start_date) > new Date() ? 'Upcoming' : 'Past'}
                                    </div>
                                </div>

                                <div className="p-6 flex-1 flex flex-col">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">{event.title}</h3>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <FaCalendarAlt className="w-5 text-primary-500" />
                                            <span>{new Date(event.start_date).toDateString()} (Time: {new Date(event.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <FaMapMarkerAlt className="w-5 text-primary-500" />
                                            <span>{event.location}</span>
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <Link
                                            to={`/events/${event.id}`}
                                            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                                        >
                                            <FaInfoCircle /> View Details
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full text-center py-20 text-gray-500">
                                <p>No upcoming events scheduled.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventList;
