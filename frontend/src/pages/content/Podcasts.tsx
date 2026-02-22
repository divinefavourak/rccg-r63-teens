
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, Share2 } from 'lucide-react';
import { Podcast, mockContentService } from '../../services/mockContentService';

const Podcasts = () => {
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPodcasts = async () => {
            try {
                const data = await mockContentService.getPodcasts();
                setPodcasts(data);
            } catch (error) {
                console.error('Failed to fetch podcasts', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPodcasts();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading audio content...</div>;

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white font-['Impact'] tracking-wide mb-2">Faith Tribe Podcast</h1>
                <p className="text-gray-600 dark:text-gray-400">Faith comes by hearing (Romans 10:17).</p>
            </header>

            <div className="grid gap-4">
                {podcasts.map((podcast, index) => (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        key={podcast.id}
                        className="bg-white dark:bg-[#1a0505] p-4 rounded-2xl border border-gray-100 dark:border-yellow-500/10 shadow-sm hover:shadow-md transition-all flex items-center gap-4 sm:gap-6 group"
                    >
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden">
                            <img src={podcast.thumbnail} alt={podcast.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black">
                                    <Play size={14} fill="currentColor" className="ml-0.5" />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                <span>{podcast.publishedAt}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><Clock size={12} /> {podcast.duration}</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate mb-1">{podcast.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{podcast.description}</p>
                        </div>

                        <button className="p-3 rounded-full bg-red-50 dark:bg-yellow-500/10 text-red-600 dark:text-yellow-500 hover:bg-red-100 dark:hover:bg-yellow-500/20 transition-colors flex-shrink-0">
                            <Play size={20} fill="currentColor" />
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default Podcasts;
