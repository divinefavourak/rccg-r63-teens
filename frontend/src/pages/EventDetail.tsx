import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { type Event } from '../types';
import toast from 'react-hot-toast';
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaTicketAlt, FaChevronLeft } from 'react-icons/fa';

const EventDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);

    useEffect(() => {
        fetchEvent();
    }, [id]);

    const fetchEvent = async () => {
        try {
            const { data } = await api.get(`/events/${id}/`);
            setEvent(data);
        } catch (error) {
            toast.error('Event not found');
            navigate('/events');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        setRegistering(true);
        try {
            await api.post(`/content/events/${id}/register/`);
            toast.success("Successfully registered! Check your email for details.");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Registration failed. You may already be registered.");
        } finally {
            setRegistering(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>;
    if (!event) return null;

    const isPast = new Date(event.start_date) < new Date();
    const isOpen = !isPast && (event.available_seats === undefined || event.available_seats > 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Navbar />

            <div className="relative h-[50vh] min-h-[400px]">
                {event.image ? (
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-900 to-black"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent"></div>

                <div className="absolute top-0 left-0 p-6 pt-32 w-full container mx-auto px-4">
                    <button
                        onClick={() => navigate('/events')}
                        className="text-white/80 hover:text-white flex items-center gap-2 mb-8 bg-black/20 p-2 rounded-lg backdrop-blur-sm w-fit"
                    >
                        <FaChevronLeft /> Back to Events
                    </button>
                </div>

                <div className="absolute bottom-0 left-0 w-full p-8 pb-16">
                    <div className="container mx-auto px-4">
                        <span className={`inline-block mb-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {isOpen ? 'Registration Open' : 'Closed'}
                        </span>
                        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight max-w-4xl">
                            {event.title}
                        </h1>
                        <div className="flex flex-wrap gap-6 text-white/90 font-medium">
                            <div className="flex items-center gap-2">
                                <FaCalendarAlt className="text-yellow-400" />
                                {new Date(event.start_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="flex items-center gap-2">
                                <FaClock className="text-yellow-400" />
                                {new Date(event.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex items-center gap-2">
                                <FaMapMarkerAlt className="text-yellow-400" />
                                {event.location}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-12 -mt-8 relative z-10">
                <div className="grid md:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="md:col-span-2 space-y-8">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 border border-gray-100 dark:border-gray-700">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">About this Event</h2>
                            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                                <div dangerouslySetInnerHTML={{ __html: event.description }} />
                                {event.details && <div className="mt-4" dangerouslySetInnerHTML={{ __html: event.details }} />}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 sticky top-24">
                            <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Ticket Price</span>
                                <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                                    {event.price > 0 ? `₦${event.price.toLocaleString()}` : 'FREE'}
                                </span>
                            </div>

                            <button
                                onClick={handleRegister}
                                disabled={!isOpen || registering}
                                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${!isOpen
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : registering
                                        ? 'bg-primary-700 text-white cursor-wait'
                                        : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white hover:shadow-primary-500/30 hover:-translate-y-1'
                                    }`}
                            >
                                <FaTicketAlt />
                                {registering ? 'Processing...' : isOpen ? 'Register Now' : 'Registration Closed'}
                            </button>

                            {isOpen && (
                                <p className="text-xs text-center text-gray-500 mt-4">
                                    {event.available_seats ? `${event.available_seats} spots remaining` : 'Limited spots available'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default EventDetail;
