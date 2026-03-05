
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Devotional } from '../../services/contentService';
import { contentService } from '../../services/contentService';

// Returns "Today", "Yesterday", or locale date string
const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const Devotionals = () => {
    const [devotionals, setDevotionals] = useState<Devotional[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDevotionals = async () => {
            try {
                const data = await contentService.getDevotionals();
                setDevotionals(data);
            } catch (err) {
                setError('Failed to load devotionals. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchDevotionals();
    }, []);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-40 bg-gray-200 dark:bg-[#1a0505]/60 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">{error}</div>;
    }

    if (devotionals.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                No devotionals available yet. Check back soon!
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white font-['Impact'] tracking-wide mb-2">Daily Devotionals</h1>
                <p className="text-gray-600 dark:text-gray-400">Feed your spirit with the unadulterated Word of God.</p>
            </header>

            <div className="grid gap-6">
                {devotionals.map((devotional) => (
                    <motion.article
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={devotional.id}
                        className="flex flex-col md:flex-row bg-white dark:bg-[#1a0505] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-yellow-500/10 hover:shadow-md transition-all group"
                    >
                        {devotional.cover_image && (
                            <div className="md:w-1/3 h-48 md:h-auto overflow-hidden">
                                <img
                                    src={devotional.cover_image}
                                    alt={devotional.title || 'Devotional'}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>
                        )}
                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-yellow-500/80 mb-3 font-medium uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {formatDate(devotional.date)}
                                </span>
                            </div>

                            {/* Title with fallback */}
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-red-700 dark:group-hover:text-yellow-500 transition-colors">
                                {devotional.title || 'Daily Devotional'}
                            </h2>

                            {devotional.memory_verse_content && (
                                <p className="text-gray-600 dark:text-gray-400 line-clamp-2 mb-6 flex-1 italic text-sm">
                                    "{devotional.memory_verse_content}" — {devotional.memory_verse_passage}
                                </p>
                            )}

                            {/* Clickable link to the detail page */}
                            <Link
                                to={`/devotionals/${devotional.id}`}
                                className="self-start flex items-center gap-2 text-red-700 dark:text-yellow-500 font-bold hover:gap-3 transition-all text-sm"
                            >
                                Read Full Devotional <ArrowRight size={16} />
                            </Link>
                        </div>
                    </motion.article>
                ))}
            </div>
        </div>
    );
};

export default Devotionals;
