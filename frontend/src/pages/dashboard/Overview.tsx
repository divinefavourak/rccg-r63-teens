
import { motion } from 'framer-motion';
import { BookOpen, Headphones, Calendar } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Overview = () => {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-red-900 to-red-800 dark:from-yellow-900/40 dark:to-red-900/40 rounded-3xl p-8 text-white relative overflow-hidden"
            >
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2 font-['Impact'] tracking-wide">Welcome back, Teen!</h1>
                    <p className="text-red-100 max-w-xl">
                        "Let no one despise your youth, but be an example to the believers in word, in conduct, in love, in spirit, in faith, in purity." — 1 Timothy 4:12
                    </p>
                    <button className="mt-6 bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold py-2 px-6 rounded-full transition-colors shadow-lg">
                        View Today's Devotional
                    </button>
                </div>

                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-20 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl"></div>
            </motion.div>

            {/* Quick Stats / Highlights */}
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
                <motion.div variants={item} className="bg-white dark:bg-[#1a0505] p-6 rounded-2xl border border-gray-100 dark:border-yellow-500/10 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                        <BookOpen size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Daily Devotional</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start your day with the Word.</p>
                    <NavLink to="/dashboard/devotionals" className="text-blue-600 dark:text-blue-400 text-sm font-medium mt-4 inline-block hover:underline">Read Now &rarr;</NavLink>
                </motion.div>

                <motion.div variants={item} className="bg-white dark:bg-[#1a0505] p-6 rounded-2xl border border-gray-100 dark:border-yellow-500/10 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                        <Headphones size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Latest Podcast</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Listen to faith-building talks.</p>
                    <NavLink to="/dashboard/podcasts" className="text-purple-600 dark:text-purple-400 text-sm font-medium mt-4 inline-block hover:underline">Listen Now &rarr;</NavLink>
                </motion.div>

                <motion.div variants={item} className="bg-white dark:bg-[#1a0505] p-6 rounded-2xl border border-gray-100 dark:border-yellow-500/10 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 mb-4">
                        <Calendar size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Upcoming Events</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Join us for our next gathering.</p>
                    <NavLink to="/dashboard/events" className="text-orange-600 dark:text-orange-400 text-sm font-medium mt-4 inline-block hover:underline">View Events &rarr;</NavLink>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default Overview;
