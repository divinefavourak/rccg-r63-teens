import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { type Event } from '../types';
import toast from 'react-hot-toast';
import {
    Calendar, MapPin, Clock, Ticket, ChevronLeft,
    Users, X, User, Phone, Mail, Hash, AlertTriangle,
    Info, Link, BookOpen, Globe
} from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';

// Correct province values matching the Django backend Province choices
const PROVINCES = [
    { value: 'lagos_province_9',   label: 'Lagos Province 9' },
    { value: 'lagos_province_28',  label: 'Lagos Province 28' },
    { value: 'lagos_province_69',  label: 'Lagos Province 69' },
    { value: 'lagos_province_84',  label: 'Lagos Province 84' },
    { value: 'lagos_province_86',  label: 'Lagos Province 86' },
    { value: 'lagos_province_104', label: 'Lagos Province 104' },
    { value: 'regional_hq',        label: 'Regional Headquarter' },
];

interface RegForm {
    attendee_name: string;
    attendee_email: string;
    attendee_phone: string;
    attendee_age: string;
    attendee_gender: string;
    attendee_province: string;
    attendee_parish: string;
    guardian_name: string;
    guardian_phone: string;
    guardian_email: string;
    guardian_relationship: string;
    guardian_consent: boolean;
    // Emergency contact
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relationship: string;
    // Medical
    medical_conditions: string;
    allergies: string;
    dietary_restrictions: string;
    special_needs: string;
}

const defaultForm: RegForm = {
    attendee_name: '',
    attendee_email: '',
    attendee_phone: '',
    attendee_age: '',
    attendee_gender: '',
    attendee_province: '',
    attendee_parish: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_relationship: '',
    guardian_consent: false,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    medical_conditions: '',
    allergies: '',
    dietary_restrictions: '',
    special_needs: '',
};

const EventDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthContext();

    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [form, setForm] = useState<RegForm>(defaultForm);

    useEffect(() => {
        fetchEvent();
    }, [id]);

    const fetchEvent = async () => {
        try {
            const { data } = await api.get(`/events/events/${id}/`);
            setEvent(data);
        } catch {
            toast.error('Event not found');
            navigate('/events');
        } finally {
            setLoading(false);
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setForm(prev => ({ ...prev, [name]: val }));
    };

    const openModal = () => {
        if (!user) {
            toast('Please log in to register for this event', { icon: '🔒' });
            navigate('/login');
            return;
        }
        // Pre-fill from logged-in user profile so they don't re-enter details
        setForm(prev => ({
            ...prev,
            attendee_name: (user.first_name && user.last_name)
                ? `${user.first_name} ${user.last_name}`
                : prev.attendee_name,
            attendee_email: user.email || prev.attendee_email,
            attendee_phone: (user as any).phone || prev.attendee_phone,
            attendee_province: (user as any).province || prev.attendee_province,
            attendee_parish: (user as any).parish || prev.attendee_parish,
        }));
        setIsModalOpen(true);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.guardian_consent) {
            toast.error('Guardian consent is required');
            return;
        }
        setRegistering(true);
        try {
            await api.post(`/events/events/${id}/register/`, {
                ...form,
                attendee_age: Number(form.attendee_age),
            });
            toast.success('Registration successful! You will receive a confirmation shortly.');
            setIsModalOpen(false);
            setRegistered(true);
            setForm(defaultForm);
        } catch (error: any) {
            const detail = error?.response?.data;
            const msg = detail
                ? (typeof detail === 'string' ? detail : JSON.stringify(detail))
                : 'Registration failed. You may already be registered.';
            toast.error(msg.length < 200 ? msg : 'Registration failed. Check console for details.');
            console.error('Registration error:', detail);
        } finally {
            setRegistering(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }
    if (!event) return null;

    const now = new Date();
    const isUpcoming = new Date(event.start_datetime) > now;
    const regOpen = event.registration_status === 'open';
    const canRegister = isUpcoming && regOpen && !registered;

    const formatDate = (dt: string) =>
        new Date(dt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const formatTime = (dt: string) =>
        new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Navbar />

            {/* Hero */}
            <div className="relative h-[55vh] min-h-[400px]">
                {event.cover_image ? (
                    <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-900 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />

                {/* Back button */}
                <div className="absolute top-24 left-0 w-full container mx-auto px-4">
                    <button
                        onClick={() => navigate('/events')}
                        className="text-white/80 hover:text-white flex items-center gap-2 bg-black/20 px-3 py-2 rounded-lg backdrop-blur-sm w-fit transition-colors"
                    >
                        <ChevronLeft size={16} /> Back to Events
                    </button>
                </div>

                {/* Event title bar */}
                <div className="absolute bottom-0 left-0 w-full pb-12 pt-8 px-4">
                    <div className="container mx-auto">
                        <span className={`inline-block mb-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                            canRegister ? 'bg-green-500 text-white' : 'bg-red-500/80 text-white'
                        }`}>
                            {registered ? 'Registered ✓' : canRegister ? 'Registration Open' : 'Registration Closed'}
                        </span>
                        <h1 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight max-w-4xl">
                            {event.title}
                        </h1>
                        <div className="flex flex-wrap gap-5 text-white/90">
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-yellow-400" />
                                <span>{formatDate(event.start_datetime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-yellow-400" />
                                <span>{formatTime(event.start_datetime)}</span>
                            </div>
                            {event.venue && (
                                <div className="flex items-center gap-2">
                                    <MapPin size={16} className="text-yellow-400" />
                                    <span>{event.venue}{event.city ? `, ${event.city}` : ''}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-12">
                <div className="grid md:grid-cols-3 gap-8">

                    {/* Main */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 border border-gray-100 dark:border-gray-700">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">About this Event</h2>
                            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                                {event.description ? (
                                    <p className="whitespace-pre-line">{event.description}</p>
                                ) : event.short_description ? (
                                    <p>{event.short_description}</p>
                                ) : (
                                    <p className="text-gray-500 italic">No description provided.</p>
                                )}
                            </div>
                        </div>

                        {/* Details grid */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Event Details</h2>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {event.event_type && (
                                    <div>
                                        <p className="text-gray-500 mb-1">Type</p>
                                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{event.event_type.replace(/_/g, ' ')}</p>
                                    </div>
                                )}
                                {event.end_datetime && (
                                    <div>
                                        <p className="text-gray-500 mb-1">Ends</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">{formatDate(event.end_datetime)}</p>
                                    </div>
                                )}
                                {event.max_attendees && (
                                    <div>
                                        <p className="text-gray-500 mb-1">Capacity</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">{event.max_attendees} attendees</p>
                                    </div>
                                )}
                                {event.spots_remaining !== undefined && (
                                    <div>
                                        <p className="text-gray-500 mb-1">Spots Remaining</p>
                                        <p className={`font-semibold ${event.spots_remaining < 10 ? 'text-red-500' : 'text-green-500'}`}>
                                            {event.spots_remaining}
                                        </p>
                                    </div>
                                )}
                                {event.city && (
                                    <div>
                                        <p className="text-gray-500 mb-1">City</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">{event.city}{event.state ? `, ${event.state}` : ''}</p>
                                    </div>
                                )}
                                {(event.is_virtual || event.is_hybrid) && (
                                    <div>
                                        <p className="text-gray-500 mb-1">Format</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {event.is_hybrid ? 'Hybrid (In-person + Virtual)' : 'Virtual'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Virtual link */}
                            {event.virtual_link && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Globe size={14} className="text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                            {event.virtual_platform || 'Virtual Link'}
                                        </span>
                                    </div>
                                    <a href={event.virtual_link} target="_blank" rel="noopener noreferrer"
                                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all flex items-center gap-1">
                                        <Link size={12} /> {event.virtual_link}
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* What to Bring */}
                        {event.what_to_bring && event.what_to_bring.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <BookOpen size={18} className="text-primary-500" /> What to Bring
                                </h2>
                                <ul className="space-y-1">
                                    {event.what_to_bring.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="text-primary-500 mt-0.5">•</span> {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Schedule */}
                        {event.schedule && event.schedule.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <Clock size={18} className="text-primary-500" /> Schedule
                                </h2>
                                <div className="space-y-2">
                                    {event.schedule.map((raw, i) => {
                                        const item = raw as { time?: string; title?: string; description?: string };
                                        return (
                                            <div key={i} className="flex gap-3 text-sm">
                                                {item.time && (
                                                    <span className="text-primary-500 font-semibold whitespace-nowrap w-16 shrink-0">{item.time}</span>
                                                )}
                                                <div>
                                                    {item.title && <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>}
                                                    {item.description && <p className="text-gray-500">{item.description}</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* FAQs */}
                        {event.faqs && event.faqs.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Info size={18} className="text-primary-500" /> Frequently Asked Questions
                                </h2>
                                <div className="space-y-4">
                                    {event.faqs.map((raw, i) => {
                                        const faq = raw as { question?: string; answer?: string };
                                        return (
                                            <div key={i}>
                                                {faq.question && <p className="font-semibold text-gray-900 dark:text-white text-sm">{faq.question}</p>}
                                                {faq.answer && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{faq.answer}</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Organizer */}
                        {event.organizer_name && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Organizer</h2>
                                <p className="font-semibold text-gray-900 dark:text-white">{event.organizer_name}</p>
                                <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                                    {event.organizer_email && (
                                        <p className="flex items-center gap-2">
                                            <Mail size={14} />
                                            <a href={`mailto:${event.organizer_email}`} className="hover:text-primary-500 transition-colors">
                                                {event.organizer_email}
                                            </a>
                                        </p>
                                    )}
                                    {event.organizer_phone && (
                                        <p className="flex items-center gap-2">
                                            <Phone size={14} /> {event.organizer_phone}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 sticky top-24 space-y-6">
                            {/* Price */}
                            <div className="flex justify-between items-center pb-5 border-b border-gray-100 dark:border-gray-700">
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Admission</span>
                                <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                                    {event.is_free || event.price === 0 ? 'FREE' : `₦${Number(event.price).toLocaleString()}`}
                                </span>
                            </div>

                            {/* Capacity bar */}
                            {event.max_attendees && event.registration_count !== undefined && (
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                            <Users size={14} /> Registered
                                        </span>
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            {event.registration_count}/{event.max_attendees}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-primary-500 h-2 rounded-full transition-all"
                                            style={{ width: `${Math.min((event.registration_count / event.max_attendees!) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* CTA */}
                            {registered ? (
                                <div className="w-full py-4 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 font-bold text-center border border-green-200 dark:border-green-800">
                                    ✓ You are registered!
                                </div>
                            ) : (
                                <button
                                    onClick={openModal}
                                    disabled={!canRegister}
                                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${
                                        !canRegister
                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white hover:shadow-primary-500/30 hover:-translate-y-0.5'
                                    }`}
                                >
                                    <Ticket size={20} />
                                    {canRegister ? 'Register Now' : 'Registration Closed'}
                                </button>
                            )}

                            {canRegister && (
                                <p className="text-xs text-center text-gray-400">
                                    {event.spots_remaining !== undefined
                                        ? `${event.spots_remaining} spots left`
                                        : 'Limited spots available'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Registration Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto backdrop-blur-sm">
                    <div className="flex min-h-full items-start justify-center p-4 py-10">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Register for Event</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">{event.title}</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleRegister} className="p-6 space-y-5">
                                {/* Attendee Info */}
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <User size={16} className="text-primary-500" /> Attendee Information
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                                            <input name="attendee_name" required value={form.attendee_name} onChange={handleInput}
                                                className="form-input" placeholder="e.g. Chidi Okafor" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                                            <input name="attendee_email" type="email" required value={form.attendee_email} onChange={handleInput}
                                                className="form-input" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                                            <input name="attendee_phone" required value={form.attendee_phone} onChange={handleInput}
                                                className="form-input" placeholder="080xxxxxxxx" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age *</label>
                                            <input name="attendee_age" type="number" min="1" max="25" required value={form.attendee_age} onChange={handleInput}
                                                className="form-input" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                                            <select name="attendee_gender" value={form.attendee_gender} onChange={handleInput} className="form-input">
                                                <option value="">Select...</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Province *</label>
                                            <select name="attendee_province" required value={form.attendee_province} onChange={handleInput} className="form-input">
                                                <option value="">Select province...</option>
                                                {PROVINCES.map(p => (
                                                    <option key={p.value} value={p.value}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={form.attendee_province ? '' : 'opacity-50 pointer-events-none'}>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parish *</label>
                                            <input name="attendee_parish" required value={form.attendee_parish} onChange={handleInput}
                                                className="form-input" placeholder="e.g. RCCG Victory Parish" />
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-gray-100 dark:border-gray-700" />

                                {/* Guardian Info */}
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Hash size={16} className="text-primary-500" /> Guardian Information
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guardian Name *</label>
                                            <input name="guardian_name" required value={form.guardian_name} onChange={handleInput}
                                                className="form-input" placeholder="Parent / Guardian full name" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                <Phone size={13} className="inline mr-1" />Guardian Phone *
                                            </label>
                                            <input name="guardian_phone" required value={form.guardian_phone} onChange={handleInput}
                                                className="form-input" placeholder="080xxxxxxxx" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                <Mail size={13} className="inline mr-1" />Guardian Email *
                                            </label>
                                            <input name="guardian_email" type="email" required value={form.guardian_email} onChange={handleInput}
                                                className="form-input" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Relationship to Attendee *</label>
                                            <select name="guardian_relationship" required value={form.guardian_relationship} onChange={handleInput} className="form-input">
                                                <option value="">Select...</option>
                                                <option value="parent">Parent</option>
                                                <option value="guardian">Guardian</option>
                                                <option value="sibling">Sibling</option>
                                                <option value="uncle">Uncle</option>
                                                <option value="aunt">Aunt</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-gray-100 dark:border-gray-700" />

                                {/* Emergency Contact */}
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <AlertTriangle size={16} className="text-orange-500" /> Emergency Contact
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
                                            <input name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleInput}
                                                className="form-input" placeholder="Full name of emergency contact" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Phone</label>
                                            <input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handleInput}
                                                className="form-input" placeholder="080xxxxxxxx" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Relationship</label>
                                            <input name="emergency_contact_relationship" value={form.emergency_contact_relationship} onChange={handleInput}
                                                className="form-input" placeholder="e.g. Parent, Sibling" />
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-gray-100 dark:border-gray-700" />

                                {/* Medical Info */}
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                                        <Info size={16} className="text-blue-500" /> Health Information
                                        <span className="text-xs font-normal text-gray-400">(optional — for event organisers only)</span>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medical Conditions</label>
                                            <input name="medical_conditions" value={form.medical_conditions} onChange={handleInput}
                                                className="form-input" placeholder="e.g. Asthma, Diabetes" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allergies</label>
                                            <input name="allergies" value={form.allergies} onChange={handleInput}
                                                className="form-input" placeholder="e.g. Peanuts, Penicillin" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dietary Restrictions</label>
                                            <input name="dietary_restrictions" value={form.dietary_restrictions} onChange={handleInput}
                                                className="form-input" placeholder="e.g. Vegetarian, Halal" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Special Needs</label>
                                            <input name="special_needs" value={form.special_needs} onChange={handleInput}
                                                className="form-input" placeholder="e.g. Wheelchair access" />
                                        </div>
                                    </div>
                                </div>

                                {/* Consent */}
                                <label className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="guardian_consent"
                                        checked={form.guardian_consent}
                                        onChange={handleInput}
                                        className="mt-1"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        I, the guardian, consent to this registration and confirm that the information provided is accurate. I permit the attendee to participate in this event.
                                    </span>
                                </label>

                                {/* Submit */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={registering || !form.guardian_consent}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold flex items-center justify-center gap-2 hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {registering
                                            ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                            : <Ticket size={18} />
                                        }
                                        {registering ? 'Submitting...' : 'Complete Registration'}
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

export default EventDetail;
