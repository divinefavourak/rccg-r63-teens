
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

const Podcasts = () => {
    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white font-['Impact'] tracking-wide mb-2">Faith Tribe Podcast</h1>
                <p className="text-gray-600 dark:text-gray-400">Faith comes by hearing (Romans 10:17).</p>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 text-center"
            >
                <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-yellow-500/10 flex items-center justify-center mb-6">
                    <Mic size={36} className="text-red-600 dark:text-yellow-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Coming Soon</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                    The Faith Tribe Podcast is on its way. Stay tuned for spirit-filled audio content!
                </p>
            </motion.div>
        </div>
    );
};

export default Podcasts;
