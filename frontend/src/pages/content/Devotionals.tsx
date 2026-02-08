
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, ArrowRight } from 'lucide-react';
import { Devotional, mockContentService } from '../../services/mockContentService';

const Devotionals = () => {
    const [devotionals, setDevotionals] = useState<Devotional[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDevotionals = async () => {
            try {
                const data = await mockContentService.getDevotionals();
                setDevotionals(data);
            } catch (error) {
                console.error('Failed to fetch devotionals', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDevotionals();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading spirit-filled content...</div>;
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
                        <div className="md:w-1/3 h-48 md:h-auto overflow-hidden">
                            <img
                                src={devotional.image}
                                alt={devotional.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-yellow-500/80 mb-3 font-medium uppercase tracking-wider">
                                <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(devotional.date).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1"><User size={14} /> {devotional.author}</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-red-700 dark:group-hover:text-yellow-500 transition-colors">
                                {devotional.title}
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 line-clamp-2 mb-6 flex-1">
                                {devotional.preview}
                            </p>
                            <button className="self-start flex items-center gap-2 text-red-700 dark:text-yellow-500 font-bold hover:gap-3 transition-all">
                                Read Full Devotional <ArrowRight size={16} />
                            </button>
                        </div>
                    </motion.article>
                ))}
            </div>
        </div>
    );
};

export default Devotionals;
