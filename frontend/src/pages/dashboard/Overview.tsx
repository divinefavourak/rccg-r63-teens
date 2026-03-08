
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Headphones, Calendar, Flame, Trophy, CheckCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import api from '../../api/axios';
import { useAuthContext } from '../../context/AuthContext';

interface StreakData {
    streak_days: number;
    total_read: number;
    longest_streak: number;
    read_ids: string[];
}

const Overview = () => {
    const { user } = useAuthContext();
    const [streak, setStreak] = useState<StreakData | null>(null);
    const [todayRead, setTodayRead] = useState(false);

    const displayName = user?.first_name || user?.username || 'Teen';

    useEffect(() => {
        api.get('/content/devotionals/my_reads/')
            .then(({ data }) => {
                setStreak({
                    streak_days: data.streak_days ?? 0,
                    total_read: data.total_read ?? 0,
                    longest_streak: data.longest_streak ?? 0,
                    read_ids: data.read_ids ?? [],
                });
            })
            .catch(() => {});

        // Check if today's devotional has been read
        const today = new Date().toISOString().split('T')[0];
        api.get(`/content/devotionals/?date=${today}`)
            .then(({ data }) => {
                const items = Array.isArray(data) ? data : data.results ?? [];
                if (items.length > 0) {
                    api.get('/content/devotionals/my_reads/')
                        .then(({ data: reads }) => {
                            setTodayRead((reads.read_ids ?? []).includes(items[0].id));
                        })
                        .catch(() => {});
                }
            })
            .catch(() => {});
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };
    const item = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };

    return (
        <div className="space-y-8">

            {/* Welcome Banner */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-red-900 to-red-800 dark:from-yellow-900/40 dark:to-red-900/40 rounded-3xl p-8 text-white relative overflow-hidden"
            >
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2 font-['Impact'] tracking-wide">
                        Welcome back, {displayName}!
                    </h1>
                    <p className="text-red-100 max-w-xl">
                        "Let no one despise your youth, but be an example to the believers in word,
                        in conduct, in love, in spirit, in faith, in purity." — 1 Timothy 4:12
                    </p>
                    <NavLink
                        to="/dashboard/devotionals"
                        className="mt-6 inline-block bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold py-2 px-6 rounded-full transition-colors shadow-lg"
                    >
                        View Today's Devotional
                    </NavLink>
                </div>
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-20 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl" />
            </motion.div>

            {/* Streak Section */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-6"
            >
                <div className="flex flex-col md:flex-row md:items-center gap-6">

                    {/* Streak stats */}
                    <div className="flex items-center gap-6 flex-1">
                        {/* Current streak */}
                        <div className="text-center min-w-[72px]">
                            <div className="flex items-center justify-center gap-1 text-amber-500">
                                <Flame size={28} className="shrink-0" />
                                <span className="text-4xl font-black">{streak?.streak_days ?? 0}</span>
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mt-1">
                                Day Streak
                            </p>
                        </div>

                        <div className="w-px h-12 bg-amber-200 dark:bg-amber-700/40 hidden sm:block" />

                        {/* Total read */}
                        <div className="text-center min-w-[72px]">
                            <div className="flex items-center justify-center gap-1 text-primary-600 dark:text-primary-400">
                                <BookOpen size={24} className="shrink-0" />
                                <span className="text-4xl font-black">{streak?.total_read ?? 0}</span>
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-400 mt-1">
                                Total Read
                            </p>
                        </div>

                        <div className="w-px h-12 bg-amber-200 dark:bg-amber-700/40 hidden sm:block" />

                        {/* Best streak */}
                        <div className="text-center min-w-[72px]">
                            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                                <Trophy size={24} className="shrink-0" />
                                <span className="text-4xl font-black">{streak?.longest_streak ?? 0}</span>
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mt-1">
                                Best Streak
                            </p>
                        </div>
                    </div>

                    {/* Today's status + CTA */}
                    <div className="flex flex-col gap-3 md:items-end">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                            todayRead
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        }`}>
                            {todayRead ? (
                                <><CheckCircle size={16} /> Today's devotional — Done!</>
                            ) : (
                                <><Flame size={16} /> Today's devotional — Not read yet</>
                            )}
                        </div>
                        {!todayRead && (
                            <NavLink
                                to="/dashboard/devotionals"
                                className="text-sm font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 underline underline-offset-2"
                            >
                                Read now to keep your streak →
                            </NavLink>
                        )}
                        {(streak?.streak_days ?? 0) > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                                {(streak?.streak_days ?? 0) === 1
                                    ? 'Great start! Come back tomorrow.'
                                    : `${streak?.streak_days} days strong — don't break the chain!`}
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Quick Stats Cards */}
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
                    <NavLink to="/dashboard/devotionals" className="text-blue-600 dark:text-blue-400 text-sm font-medium mt-4 inline-block hover:underline">Read Now →</NavLink>
                </motion.div>

                <motion.div variants={item} className="bg-white dark:bg-[#1a0505] p-6 rounded-2xl border border-gray-100 dark:border-yellow-500/10 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                        <Headphones size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Latest Podcast</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Listen to faith-building talks.</p>
                    <NavLink to="/dashboard/podcasts" className="text-purple-600 dark:text-purple-400 text-sm font-medium mt-4 inline-block hover:underline">Listen Now →</NavLink>
                </motion.div>

                <motion.div variants={item} className="bg-white dark:bg-[#1a0505] p-6 rounded-2xl border border-gray-100 dark:border-yellow-500/10 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 mb-4">
                        <Calendar size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Upcoming Events</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Join us for our next gathering.</p>
                    <NavLink to="/dashboard/events" className="text-orange-600 dark:text-orange-400 text-sm font-medium mt-4 inline-block hover:underline">View Events →</NavLink>
                </motion.div>
            </motion.div>

        </div>
    );
};

export default Overview;
