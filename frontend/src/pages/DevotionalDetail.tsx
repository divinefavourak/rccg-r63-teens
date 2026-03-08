// frontend/src/pages/DevotionalDetail.tsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { type Devotional } from '../types';
import toast from 'react-hot-toast';
import { useAuthContext } from '../context/AuthContext';
import { 
    FaCalendarAlt, FaShare, FaHeart, FaChevronLeft, 
    FaCheckCircle, FaBookOpen, FaMusic, FaUserEdit 
} from 'react-icons/fa';

const DevotionalDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthContext();
    const [devotional, setDevotional] = useState<Devotional | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRead, setIsRead] = useState(false);
    const [streak, setStreak] = useState<{ streak_days: number; total_read: number } | null>(null);

    useEffect(() => {
        fetchDevotional();
        if (isAuthenticated) checkReadStatus();
    }, [id]);

    const checkReadStatus = async () => {
        try {
            const { data } = await api.get('/content/devotionals/my_reads/');
            if (data.read_ids?.includes(id)) setIsRead(true);
            setStreak({ streak_days: data.streak_days, total_read: data.total_read });
        } catch {
            // silently ignore — user may not be logged in
        }
    };

    const fetchDevotional = async () => {
        try {
            const { data } = await api.get(`/content/devotionals/${id}/`);
            setDevotional(data);
        } catch (error) {
            toast.error('Devotional not found');
            navigate('/devotionals');
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async () => {
        if (!devotional || isRead) return;
        try {
            const { data } = await api.post(`/content/devotionals/${id}/mark_read/`);
            setIsRead(true);
            setStreak({ streak_days: data.streak_days, total_read: data.total_read });
            if (data.streak_days > 1) {
                toast.success(`🔥 ${data.streak_days}-day streak! Keep it up!`);
            } else {
                toast.success('Marked as read! Great start — come back tomorrow to build your streak!');
            }
        } catch (error) {
            console.error(error);
            toast.error('Could not mark as read');
        }
    };

    const toggleFavorite = async () => {
        toast.success("Added to favorites");
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>;
    if (!devotional) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors pb-20">
            <Navbar />

            {/* Hero Header */}
            <div className="bg-primary-600 pt-32 pb-24 px-4 text-center relative overflow-hidden">
                {devotional.cover_image ? (
                    <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${devotional.cover_image})` }}></div>
                ) : (
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                )}
                
                <div className="relative z-10 container mx-auto max-w-4xl">
                    <button
                        onClick={() => navigate('/devotionals')}
                        className="absolute top-0 left-0 text-white/80 hover:text-white flex items-center gap-2 transition-colors mb-4 md:mb-0"
                    >
                        <FaChevronLeft /> Back
                    </button>

                    <div className="flex flex-wrap justify-center gap-3 mb-6">
                        <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-white text-sm font-medium">
                            <FaCalendarAlt />
                            {new Date(devotional.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        {devotional.author && (
                            <span className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-4 py-1 rounded-full text-white text-sm font-medium">
                                <FaUserEdit />
                                {devotional.author}
                            </span>
                        )}
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black text-white mb-8 leading-tight drop-shadow-lg">
                        {devotional.title}
                    </h1>

                    {/* Top Cards: Memory Verse & Bible Reading Ref */}
                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
                        {/* Memory Verse Box */}
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border-l-4 border-accent-400 border-white/20 shadow-lg">
                            <div className="flex items-center gap-2 text-accent-300 mb-3">
                                <span className="uppercase font-bold tracking-widest text-xs">Memorise</span>
                            </div>
                            <p className="text-lg text-white font-medium mb-3 leading-relaxed italic">
                                "{devotional.memory_verse_content || devotional.memory_verse || devotional.scripture_text}"
                            </p>
                            <p className="text-white/90 font-bold text-sm">
                                — {devotional.memory_verse_passage || devotional.scripture_reference || devotional.anchor_scripture}
                            </p>
                        </div>

                        {/* Bible Reading Box */}
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border-l-4 border-primary-300 border-white/20 shadow-lg">
                            <div className="flex items-center gap-2 text-primary-300 mb-3">
                                <span className="uppercase font-bold tracking-widest text-xs">Read</span>
                            </div>
                            <p className="text-xl text-white font-bold mb-2">
                                {devotional.bible_text_passage || "Scripture Reading"}
                            </p>
                            <div className="text-white/80 text-sm">
                                <span className="opacity-75">Bible In One Year: </span>
                                <span className="font-semibold text-white">{devotional.bible_in_one_year || "See Reading Plan"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-10 relative z-20">
                <div className="max-w-4xl mx-auto space-y-8">
                    
                    {/* Main Content Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 md:p-12 border border-gray-100 dark:border-gray-700">
                        
                        {/* Bible Text Content (If available) */}
                        {devotional.bible_text_content && (
                            <div className="mb-10 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4">
                                    <FaBookOpen className="text-primary-500" />
                                    <span className="text-sm font-bold uppercase tracking-wider">Scripture Text</span>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-serif">
                                    {devotional.bible_text_content}
                                </div>
                            </div>
                        )}

                        {/* Message Body */}
                        <div className="prose prose-lg dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
                            <h3 className="text-primary-600 dark:text-primary-400 font-bold uppercase text-sm tracking-widest mb-4">Message</h3>
                            <div dangerouslySetInnerHTML={{ __html: devotional.content }} />
                        </div>

                        {/* Key Point */}
                        {devotional.key_point && (
                            <div className="mt-10 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-6 rounded-r-xl">
                                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-widest mb-2">Key Point</h3>
                                <p className="text-lg font-medium text-blue-800 dark:text-blue-200 italic">
                                    "{devotional.key_point}"
                                </p>
                            </div>
                        )}

                        {/* Prayer */}
                        {(devotional.prayer || devotional.prayer_point) && (
                            <div className="mt-6 bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500 p-6 rounded-r-xl">
                                <h3 className="text-sm font-bold text-primary-900 dark:text-primary-100 uppercase tracking-widest mb-2">Prayer Point</h3>
                                <p className="text-lg font-medium text-primary-800 dark:text-primary-200">
                                    {devotional.prayer || devotional.prayer_point}
                                </p>
                            </div>
                        )}

                        {/* Hymn Section */}
                        {devotional.hymn && (
                            <div className="mt-10 pt-10 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                                        <FaMusic />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Hymn</h3>
                                </div>
                                <div className="bg-gray-50 dark:bg-black/20 p-6 rounded-2xl whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-serif leading-relaxed text-center">
                                    {devotional.hymn}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-12 border-t border-gray-100 dark:border-gray-700 pt-8">
                            {/* Streak Banner */}
                            {isAuthenticated && streak && (streak.streak_days > 0 || streak.total_read > 0) && (
                                <div className="mb-6 flex items-center gap-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl px-6 py-4">
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-amber-500">🔥 {streak.streak_days}</div>
                                        <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mt-0.5">Day Streak</div>
                                    </div>
                                    <div className="w-px h-10 bg-amber-200 dark:bg-amber-700/40" />
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-primary-600 dark:text-primary-400">{streak.total_read}</div>
                                        <div className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase tracking-wider mt-0.5">Total Read</div>
                                    </div>
                                    <div className="flex-1 ml-2">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {streak.streak_days === 0
                                                ? 'Start your streak — read today\'s devotional!'
                                                : streak.streak_days === 1
                                                ? 'You\'re on a 1-day streak! Come back tomorrow!'
                                                : `Amazing! ${streak.streak_days} days in a row. Don't break the chain!`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {isAuthenticated ? (
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={toggleFavorite}
                                            className="btn-secondary rounded-full px-6 py-3 flex items-center justify-center gap-2 hover:bg-pink-50 hover:border-pink-200 hover:text-pink-500 transition-all"
                                        >
                                            <FaHeart /> Like
                                        </button>
                                        <button className="btn-secondary rounded-full px-6 py-3 flex items-center justify-center gap-2 transition-all">
                                            <FaShare /> Share
                                        </button>
                                    </div>

                                    <button
                                        onClick={markAsRead}
                                        disabled={isRead}
                                        className={`btn-primary px-8 py-3 flex items-center gap-3 text-lg shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 ${isRead ? 'opacity-50 cursor-not-allowed bg-gray-500 hover:transform-none hover:shadow-none' : ''}`}
                                    >
                                        {isRead ? (
                                            <>
                                                <FaCheckCircle /> Read
                                            </>
                                        ) : (
                                            "Mark as Read"
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        Sign in to track your reading, like devotionals, and build your streak.
                                    </p>
                                    <div className="flex gap-3">
                                        <Link
                                            to="/login"
                                            className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl"
                                        >
                                            Sign In
                                        </Link>
                                        <Link
                                            to="/register"
                                            className="btn-secondary px-6 py-2.5 text-sm font-bold rounded-xl"
                                        >
                                            Create Account
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default DevotionalDetail;
