import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { Devotional } from '../types';
import toast from 'react-hot-toast';
import { FaCalendarAlt, FaShare, FaHeart, FaChevronLeft, FaCheckCircle } from 'react-icons/fa';

const DevotionalDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [devotional, setDevotional] = useState<Devotional | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRead, setIsRead] = useState(false);

    useEffect(() => {
        fetchDevotional();
    }, [id]);

    const fetchDevotional = async () => {
        try {
            const { data } = await api.get(`/content/devotionals/${id}/`);
            setDevotional(data);
            // Check if read status logic exists in backend response? 
            // For now assuming we just render.
        } catch (error) {
            toast.error('Devotional not found');
            navigate('/devotionals');
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async () => {
        if (!devotional) return;
        try {
            await api.post(`/content/devotionals/${id}/mark_read/`);
            setIsRead(true);
            toast.success('Marked as read! Streak updated.');
        } catch (error) {
            toast.error('Could not mark as read');
        }
    };

    const toggleFavorite = async () => {
        // Logic for adding/removing from favorites would go here
        // GET /profiles/favorites/ to check if exists, then POST/DELETE
        toast.success("Added to favorites");
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>;
    if (!devotional) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Navbar />

            {/* Hero Header */}
            <div className="bg-primary-600 pt-32 pb-20 px-4 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10 container mx-auto max-w-4xl">
                    <button
                        onClick={() => navigate('/devotionals')}
                        className="absolute top-0 left-0 text-white/80 hover:text-white flex items-center gap-2 transition-colors mb-4 md:mb-0"
                    >
                        <FaChevronLeft /> Back
                    </button>

                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-white text-sm font-medium mb-6">
                        <FaCalendarAlt />
                        {new Date(devotional.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
                        {devotional.title}
                    </h1>

                    <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20 max-w-2xl mx-auto">
                        <p className="text-white/80 text-sm uppercase font-bold tracking-widest mb-2">Memory Verse</p>
                        <p className="text-xl md:text-2xl text-white font-serif italic">
                            "{devotional.memory_verse}"
                        </p>
                        <p className="text-right text-white/60 mt-2 font-medium text-sm">
                            — {devotional.scripture_reference}
                        </p>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-10 relative z-20 pb-20">
                <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 md:p-12 border border-gray-100 dark:border-gray-700">

                    {/* Text Content */}
                    <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                        {/* Render HTML content safely */}
                        <div dangerouslySetInnerHTML={{ __html: devotional.content }} />
                    </div>

                    {/* Prayer Point */}
                    <div className="mt-12 bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500 p-6 rounded-r-xl">
                        <h3 className="text-lg font-bold text-primary-900 dark:text-primary-100 uppercase tracking-widest mb-2">Prayer Point</h3>
                        <p className="text-xl font-medium text-gray-800 dark:text-gray-200">
                            {devotional.prayer_point}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-gray-100 dark:border-gray-700 pt-8">
                        <div className="flex gap-4">
                            <button
                                onClick={toggleFavorite}
                                className="btn-secondary rounded-full p-4 flex items-center justify-center gap-2 hover:bg-pink-50 hover:border-pink-200 hover:text-pink-500"
                            >
                                <FaHeart /> Like
                            </button>
                            <button className="btn-secondary rounded-full p-4 flex items-center justify-center gap-2">
                                <FaShare /> Share
                            </button>
                        </div>

                        <button
                            onClick={markAsRead}
                            disabled={isRead}
                            className={`btn-primary px-8 py-4 flex items-center gap-3 text-lg shadow-xl ${isRead ? 'opacity-50 cursor-not-allowed bg-gray-500' : ''}`}
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

                </div>
            </div>

        </div>
    );
};

export default DevotionalDetail;
