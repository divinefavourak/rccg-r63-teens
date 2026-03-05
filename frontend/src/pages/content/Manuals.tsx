
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Book } from 'lucide-react';
import type { Manual } from '../../services/contentService';
import { contentService } from '../../services/contentService';


const AGE_GROUP_LABELS: Record<string, string> = {
    all: 'All Ages',
    pre_teen: 'Pre-Teens',
    teen: 'Teens',
    young_adult: 'Young Adults',
};

const Manuals = () => {
    const [manuals, setManuals] = useState<Manual[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchManuals = async () => {
            try {
                const data = await contentService.getManuals();
                setManuals(data);
            } catch (err) {
                setError('Failed to load manuals. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchManuals();
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const item = {
        hidden: { scale: 0.9, opacity: 0 },
        show: { scale: 1, opacity: 1 }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading resources...</div>;

    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    if (manuals.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                No manuals available yet. Check back soon!
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white font-['Impact'] tracking-wide mb-2">Manuals & Resources</h1>
                <p className="text-gray-600 dark:text-gray-400">Equip yourself with knowledge (Daniel 11:32b).</p>
            </header>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {manuals.map((manual) => (
                    <motion.div
                        variants={item}
                        key={manual.id}
                        className="group bg-white dark:bg-[#1a0505] rounded-2xl overflow-hidden border border-gray-100 dark:border-yellow-500/10 shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                        <div className="h-48 overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10 flex items-end p-6">
                                <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-red-600">
                                    {AGE_GROUP_LABELS[manual.target_age_group] ?? manual.target_age_group}
                                </span>
                            </div>
                            {manual.cover_image ? (
                                <img
                                    src={manual.cover_image}
                                    alt={manual.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                    <Book size={48} className="text-gray-400" />
                                </div>
                            )}
                        </div>
                        <div className="p-6">
                            <p className="text-xs text-gray-400 mb-1">
                                Week {manual.week_number} · {new Date(manual.week_start_date).toLocaleDateString()}
                            </p>
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-2 line-clamp-1">{manual.title}</h3>
                            {manual.theme && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2">{manual.theme}</p>
                            )}
                            <div className="flex gap-3">
                                <button className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-white py-2.5 rounded-xl font-medium transition-colors text-sm">
                                    <Book size={16} /> Read
                                </button>
                                {manual.has_pdf && (
                                    <button className="flex-1 flex items-center justify-center gap-2 bg-red-50 dark:bg-yellow-500/10 hover:bg-red-100 dark:hover:bg-yellow-500/20 text-red-700 dark:text-yellow-500 py-2.5 rounded-xl font-medium transition-colors text-sm">
                                        <Download size={16} /> PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

export default Manuals;
