
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BookOpen, Headphones, Calendar, Flame, Trophy, CheckCircle,
    FileText, Play, Search
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import NumberFlow from '@number-flow/react';
import ConfettiExplosion from 'react-confetti-explosion';
import api from '../../api/axios';
import { useAuthContext } from '../../context/AuthContext';

interface StreakData {
    streak_days: number;
    total_read: number;
    longest_streak: number;
    read_ids: string[];
}

const useStreak = () => {
    const [streak, setStreak] = useState<StreakData | null>(null);
    const [todayRead, setTodayRead] = useState(false);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        Promise.all([
            api.get('/content/devotionals/my_reads/'),
            api.get(`/content/devotionals/?date=${today}`),
        ]).then(([{ data: reads }, { data: devotionals }]) => {
            const readIds: string[] = reads.read_ids ?? [];
            setStreak({
                streak_days:    reads.streak_days    ?? 0,
                total_read:     reads.total_read     ?? 0,
                longest_streak: reads.longest_streak ?? 0,
                read_ids:       readIds,
            });
            const items = Array.isArray(devotionals) ? devotionals : devotionals.results ?? [];
            if (items.length > 0) setTodayRead(readIds.includes(items[0].id));
        }).catch(() => {});
    }, []);

    return { streak, todayRead };
};

/* ── Shared week-strip builder ──────────────────────────────────────────────── */
const buildWeek = () => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - today.getDay() + i);
        return {
            label:   d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 3),
            num:     d.getDate(),
            isToday: d.toDateString() === today.toDateString(),
        };
    });
};

// ── Toddler Overview (1–5) ── another_ui simplified ─────────────────────────
const ToddlerOverview = () => {
    const { user } = useAuthContext();
    const name = user?.first_name || user?.username || 'Friend';
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const weekDays = buildWeek();

    return (
        <div className="space-y-5 max-w-lg mx-auto">
            {/* Greeting row */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-2xl shadow-md">
                        👶
                    </div>
                    <div>
                        <p className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                            Hello {name}! 🌈
                        </p>
                        <p className="text-sm text-gray-400">Today {dateStr}.</p>
                    </div>
                </div>
            </motion.div>

            {/* Story time card */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <NavLink to="/dashboard/devotionals"
                    className="block bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white relative overflow-hidden min-h-[140px]">
                    <div className="relative z-10">
                        <p className="text-emerald-100 text-xs font-semibold mb-1">Daily challenge</p>
                        <h2 className="text-2xl font-black mb-2 leading-tight">Story Time! 📖</h2>
                        <p className="text-emerald-100 text-sm mb-4">Listen to today's Bible story</p>
                        <span className="inline-flex items-center gap-1.5 bg-amber-400 text-emerald-900 font-black px-5 py-2 rounded-full text-sm shadow">
                            <Play size={13} fill="currentColor" /> Start Story
                        </span>
                    </div>
                    <div className="absolute right-5 top-4 text-7xl opacity-15">🌟</div>
                    <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
                </NavLink>
            </motion.div>

            {/* Week strip */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between gap-1">
                    {weekDays.map(({ label, num, isToday }) => (
                        <div key={num} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all
                                ${isToday ? 'bg-emerald-500 text-white shadow' : 'text-gray-400'}`}>
                                {num}
                            </div>
                            {isToday && <div className="w-1 h-1 bg-emerald-500 rounded-full" />}
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Big 2-col cards */}
            <div className="grid grid-cols-2 gap-4">
                {[
                    { emoji: '📖', label: 'Stories',  to: '/dashboard/devotionals', bg: 'bg-emerald-100', text: 'text-emerald-700' },
                    { emoji: '📅', label: 'Events',   to: '/dashboard/events',      bg: 'bg-amber-100',   text: 'text-amber-700' },
                ].map(({ emoji, label, to, bg, text }) => (
                    <motion.div key={to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <NavLink to={to}
                            className={`${bg} rounded-3xl p-6 flex flex-col items-center gap-3 hover:shadow-md transition-shadow`}>
                            <span className="text-5xl">{emoji}</span>
                            <span className={`font-black text-base ${text}`}>{label}</span>
                        </NavLink>
                    </motion.div>
                ))}
            </div>

            {/* Parent tip */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-2xl leading-none">👨‍👩‍👧</span>
                <p className="text-sm text-amber-800">
                    <span className="font-bold">For parents:</span> Sit together and tap "Start Story" to read with your child.
                </p>
            </motion.div>
        </div>
    );
};

// ── Children Overview (6–8) ── rccg_child_ui ────────────────────────────────
const ChildOverview = () => {
    const { user } = useAuthContext();
    const name = user?.first_name || user?.username || 'Friend';
    const { streak, todayRead } = useStreak();

    const xp     = streak?.total_read     ?? 0;
    const coins  = (streak?.streak_days ?? 0) * 10;
    const level  = Math.floor(xp / 10) + 1;

    const BADGES = [
        { emoji: '📚', label: 'First Story',   earned: xp >= 1 },
        { emoji: '⭐', label: '7-Day Streak',  earned: (streak?.streak_days ?? 0) >= 7 },
        { emoji: '🏆', label: '10 Stories',    earned: xp >= 10 },
        { emoji: '💎', label: '30-Day Streak', earned: (streak?.streak_days ?? 0) >= 30 },
    ];

    return (
        <div className="space-y-4 max-w-sm mx-auto">
            {/* Profile card — rccg_child_ui style */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    {/* Avatar + level badge */}
                    <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center text-3xl shadow-md">
                            📖
                        </div>
                        <div className="absolute -top-2 -left-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-white shadow">
                            {level}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-black text-lg text-gray-900 dark:text-white capitalize">{name}</h2>
                        <div className="mt-2 space-y-1.5">
                            {/* EXP bar */}
                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wide">
                                    <span>exp</span><span>{xp * 50}</span>
                                </div>
                                <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-2">
                                    <div className="bg-purple-500 h-2 rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min((xp % 10) * 10 || (xp > 0 ? 100 : 0), 100)}%` }} />
                                </div>
                            </div>
                            {/* Coins bar */}
                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wide">
                                    <span>coins</span><span>{coins}</span>
                                </div>
                                <div className="w-full bg-amber-100 dark:bg-amber-900/30 rounded-full h-2">
                                    <div className="bg-amber-400 h-2 rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min((coins / 300) * 100, 100)}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Welcome / today CTA */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <NavLink to="/dashboard/devotionals"
                    className={`block rounded-3xl p-5 text-white relative overflow-hidden
                        ${todayRead
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : 'bg-gradient-to-br from-purple-600 via-purple-700 to-violet-700'}`}>
                    <div className="relative z-10">
                        <p className="text-xs font-semibold opacity-75 mb-1">
                            {todayRead ? '🎉 Great job today!' : '👋 Welcome back!'}
                        </p>
                        <h3 className="text-lg font-black leading-snug">
                            {todayRead
                                ? "You did it! Come back tomorrow 🌟"
                                : `Hi ${name}! Let's read today's story`}
                        </h3>
                        <div className="mt-3">
                            <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/30">
                                {todayRead ? '✓ Already read' : <><Play size={11} fill="currentColor" /> Start Story</>}
                            </span>
                        </div>
                    </div>
                    <div className="absolute right-4 top-4 text-5xl opacity-20">🕊️</div>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
                </NavLink>
            </motion.div>

            {/* MY BADGES */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wider">My Badges</h3>
                    <span className="text-xs text-purple-500 font-semibold">{BADGES.filter(b => b.earned).length}/{BADGES.length} earned</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {BADGES.map(({ emoji, label, earned }) => (
                        <div key={label} className="flex flex-col items-center gap-1">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all
                                ${earned ? 'bg-purple-100 dark:bg-purple-900/30 shadow-sm' : 'bg-gray-100 dark:bg-gray-700 opacity-40 grayscale'}`}>
                                {earned ? emoji : '?'}
                            </div>
                            <span className="text-[9px] text-gray-400 text-center leading-tight font-medium">{label}</span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* CERTIFICATES */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wider">Certificates</h3>
                    <span className="text-xs text-gray-400">0 out of 3</span>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-2xl p-4 text-white">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center text-2xl shadow flex-shrink-0">
                            🏅
                        </div>
                        <div>
                            <p className="font-black">Lingo Star</p>
                            <p className="text-xs text-purple-200">{xp} / 50 story books</p>
                        </div>
                    </div>
                    <div className="bg-purple-800/50 rounded-full h-2.5">
                        <div className="bg-amber-400 h-2.5 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min((xp / 50) * 100, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-purple-300 mt-1">
                        <span>{xp}/50</span><span>{Math.round((xp / 50) * 100)}%</span>
                    </div>
                </div>
            </motion.div>

            {/* Daily reward */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-3xl">🎁</span>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-amber-900 text-sm">Daily Reward!</p>
                    <p className="text-xs text-amber-800">Read today's story to earn coins</p>
                </div>
                <NavLink to="/dashboard/devotionals"
                    className="bg-white text-amber-600 font-black text-xs px-3 py-1.5 rounded-full flex-shrink-0 hover:bg-amber-50 transition-colors">
                    Claim →
                </NavLink>
            </motion.div>
        </div>
    );
};

// ── Pre-Teen Overview (9–12) ── another_ui ───────────────────────────────────
const PreteenOverview = () => {
    const { user } = useAuthContext();
    const name = user?.first_name || user?.username || 'Friend';
    const { streak, todayRead } = useStreak();
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const weekDays = buildWeek();

    const PLAN = [
        {
            intensity: 'Essential', title: 'Daily Devotional',
            date: dateStr, time: '07:00 – 08:00', room: 'Word of God',
            to: '/dashboard/devotionals',
            bg: 'bg-amber-400', done: todayRead,
        },
        {
            intensity: 'Optional', title: 'Weekly Manual',
            date: dateStr, time: 'Any time', room: 'Growth',
            to: '/dashboard/manuals',
            bg: 'bg-blue-400', done: false,
        },
    ];

    return (
        <div className="space-y-5 max-w-2xl">
            {/* Greeting row */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-sm shadow flex-shrink-0">
                        {name[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="font-black text-gray-900 dark:text-white">Hello {name}</p>
                        <p className="text-xs text-gray-400">Today {dateStr}.</p>
                    </div>
                </div>
                <button className="w-9 h-9 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm">
                    <Search size={15} className="text-gray-500" />
                </button>
            </motion.div>

            {/* Daily challenge — purple card (another_ui) */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <NavLink to="/dashboard/devotionals"
                    className="block bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl p-5 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-purple-200 text-xs font-semibold mb-1">Daily challenge</p>
                        <h2 className="text-xl font-black leading-tight mb-1">
                            {todayRead ? 'Challenge done! 🎉' : "Start today's reading"}
                        </h2>
                        <p className="text-purple-200 text-sm mb-3">Do your devotional before 10:00 AM</p>
                        <div className="flex items-center gap-1.5">
                            {['🙏', '📖', '✨', '🔥'].map((e, i) => (
                                <span key={i} className="w-7 h-7 bg-white/25 rounded-full flex items-center justify-center text-xs border-2 border-white/40">
                                    {e}
                                </span>
                            ))}
                            <span className="text-xs text-purple-300 ml-1">+{streak?.total_read ?? 0} readers</span>
                        </div>
                    </div>
                    <div className="absolute right-5 top-3 text-6xl opacity-15">🕊️</div>
                    <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
                </NavLink>
            </motion.div>

            {/* Week strip — another_ui pill style */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between gap-1">
                    {weekDays.map(({ label, num, isToday }) => (
                        <div key={num} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-[10px] text-gray-400">{label}</span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                ${isToday
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                                    : 'text-gray-400'}`}>
                                {num}
                            </div>
                            {isToday && <div className="w-1 h-1 bg-gray-900 dark:bg-white rounded-full" />}
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Your plan — 2-col colored cards (another_ui) */}
            <div>
                <p className="font-black text-gray-900 dark:text-white text-base mb-3">Your plan</p>
                <div className="grid grid-cols-2 gap-3">
                    {PLAN.map(({ intensity, title, date, time, room, to, bg, done }, i) => (
                        <motion.div key={to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                            <NavLink to={to}
                                className={`${bg} rounded-3xl p-4 block min-h-[160px] relative overflow-hidden hover:brightness-105 transition-all`}>
                                <span className="inline-block bg-white/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-2">
                                    {intensity}
                                </span>
                                <h3 className="text-white font-black text-lg leading-tight mb-2">{title}</h3>
                                <p className="text-white/75 text-xs">{date}</p>
                                <p className="text-white/75 text-xs">{time}</p>
                                <p className="text-white/75 text-xs">{room}</p>
                                {done && (
                                    <div className="absolute top-3 right-3 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                                        <CheckCircle size={14} className="text-emerald-500" />
                                    </div>
                                )}
                            </NavLink>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Stats row — ui_1 style */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { value: streak?.streak_days ?? 0,    label: 'Day Streak',  icon: '🔥', bg: 'bg-orange-50 border-orange-100' },
                    { value: streak?.total_read ?? 0,     label: 'Total Read',  icon: '📖', bg: 'bg-purple-50 border-purple-100' },
                    { value: streak?.longest_streak ?? 0, label: 'Best Streak', icon: '🏆', bg: 'bg-amber-50 border-amber-100' },
                ].map(({ value, label, icon, bg }) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                        className={`${bg} border rounded-2xl p-3 text-center`}>
                        <p className="text-xl mb-0.5">{icon}</p>
                        <p className="text-2xl font-black text-gray-800 dark:text-white leading-none">{value}</p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Events teaser */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <NavLink to="/dashboard/events"
                    className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-2xl p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                            <Calendar size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800 dark:text-white text-sm">Upcoming Events</p>
                            <p className="text-xs text-gray-400">See what's coming up</p>
                        </div>
                    </div>
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">View →</span>
                </NavLink>
            </motion.div>
        </div>
    );
};

// ── Teen / Superteen Overview (13+) ── ui_3 + another_ui ────────────────────
const TeenOverview = () => {
    const { user } = useAuthContext();
    const name = user?.first_name || user?.username || 'Friend';
    const { streak, todayRead } = useStreak();
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const hour = today.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const weekDays = buildWeek();

    /* 2×4 domain grid — ui_3 concept, adapted to faith categories */
    const DOMAINS = [
        { emoji: '🙏', label: 'Prayer',      to: '/dashboard/devotionals', bg: 'bg-blue-50',    dark: 'dark:bg-blue-900/20' },
        { emoji: '📖', label: 'Word',        to: '/dashboard/devotionals', bg: 'bg-amber-50',   dark: 'dark:bg-amber-900/20' },
        { emoji: '🎧', label: 'Podcasts',    to: '/dashboard/podcasts',    bg: 'bg-pink-50',    dark: 'dark:bg-pink-900/20' },
        { emoji: '❤️‍🩹', label: 'Healing',    to: '/dashboard/devotionals', bg: 'bg-rose-50',    dark: 'dark:bg-rose-900/20' },
        { emoji: '📚', label: 'Manuals',     to: '/dashboard/manuals',     bg: 'bg-violet-50',  dark: 'dark:bg-violet-900/20' },
        { emoji: '🎯', label: 'Purpose',     to: '/dashboard/manuals',     bg: 'bg-orange-50',  dark: 'dark:bg-orange-900/20' },
        { emoji: '🧠', label: 'Mindset',     to: '/dashboard/podcasts',    bg: 'bg-indigo-50',  dark: 'dark:bg-indigo-900/20' },
        { emoji: '📅', label: 'Events',      to: '/dashboard/events',      bg: 'bg-emerald-50', dark: 'dark:bg-emerald-900/20' },
    ];

    /* Daily dose cards — another_ui style */
    const DOSES = [
        {
            slot: 'Morning', title: 'Daily Devotional', cta: todayRead ? '✓ Done' : '▶ Play Dose',
            to: '/dashboard/devotionals', bg: 'bg-amber-400', text: 'text-amber-900',
        },
        {
            slot: 'Study', title: 'Weekly Manual', cta: '▶ Play Dose',
            to: '/dashboard/manuals', bg: 'bg-blue-400', text: 'text-blue-900',
        },
    ];

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Greeting row — another_ui */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-md ring-2 ring-indigo-200 dark:ring-indigo-800">
                        {name[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="text-base font-black text-gray-900 dark:text-white leading-tight">
                            {greeting}, {name} ✌️
                        </p>
                        <p className="text-xs text-gray-400">Today {dateStr}.</p>
                    </div>
                </div>
                <button className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center shadow-sm">
                    <Search size={15} className="text-gray-500" />
                </button>
            </motion.div>

            {/* Daily challenge — another_ui purple card */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <NavLink to="/dashboard/devotionals"
                    className="block bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-5 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-indigo-200 text-xs font-semibold mb-1">Daily challenge</p>
                        <h2 className="text-xl font-black leading-tight mb-1">
                            {todayRead ? 'Challenge done! 🎉' : 'Start your purpose journey'}
                        </h2>
                        <p className="text-indigo-200 text-sm mb-3">Do your devotional before 10:00 AM</p>
                        <div className="flex items-center gap-1.5">
                            {['🕊️', '📖', '🙏', '✨'].map((e, i) => (
                                <span key={i} className="w-7 h-7 bg-white/25 rounded-full flex items-center justify-center text-xs border-2 border-white/40">
                                    {e}
                                </span>
                            ))}
                            <span className="text-xs text-indigo-300 ml-1">+{streak?.total_read ?? 0}</span>
                        </div>
                        {todayRead && (
                            <div className="absolute top-4 right-4 z-20">
                                <ConfettiExplosion force={0.35} duration={2000} particleCount={30} width={260} zIndex={50} />
                            </div>
                        )}
                    </div>
                    <div className="absolute right-5 top-3 text-7xl opacity-15">🕊️</div>
                    <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
                </NavLink>
            </motion.div>

            {/* Week strip — another_ui dark-pill style */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between gap-1">
                    {weekDays.map(({ label, num, isToday }) => (
                        <div key={num} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                                ${isToday
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                                    : 'text-gray-400'}`}>
                                {num}
                            </div>
                            {isToday && <div className="w-1 h-1 bg-gray-900 dark:bg-white rounded-full" />}
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Stats row — ui_1 style */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { icon: '🔥', value: streak?.streak_days ?? 0,    label: 'Current Streak', bg: 'bg-orange-50 border-orange-100',  color: 'text-orange-500' },
                    { icon: '✅', value: streak?.total_read ?? 0,     label: 'Goals Achieved', bg: 'bg-indigo-50 border-indigo-100',  color: 'text-indigo-600' },
                    { icon: '📈', value: `${Math.min(Math.round(((streak?.total_read ?? 0) / 50) * 100), 100)}%`, label: 'Total Progress', bg: 'bg-amber-50 border-amber-100', color: 'text-amber-600' },
                ].map(({ icon, value, label, bg, color }) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className={`${bg} border rounded-2xl p-3 text-center`}>
                        <p className="text-2xl mb-0.5">{icon}</p>
                        <p className={`text-xl font-black leading-none ${color}`}>{value}</p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5 leading-tight">{label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Domains — ui_3 2×4 grid */}
            <div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Your Domains</p>
                <div className="grid grid-cols-4 gap-2.5">
                    {DOMAINS.map(({ emoji, label, to, bg, dark }, i) => (
                        <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.025 }}>
                            <NavLink to={to}
                                className={`${bg} ${dark} rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:shadow-md transition-all hover:scale-[1.03] active:scale-[0.97]`}>
                                <span className="text-2xl leading-none">{emoji}</span>
                                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 text-center leading-tight">{label}</span>
                            </NavLink>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Daily customised doses — another_ui plan cards */}
            <div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Your Daily Doses</p>
                <div className="grid grid-cols-2 gap-3">
                    {DOSES.map(({ slot, title, cta, to, bg, text }, i) => (
                        <motion.div key={to + slot} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.05 }}>
                            <NavLink to={to}
                                className={`${bg} rounded-3xl p-4 block min-h-[130px] relative overflow-hidden hover:brightness-105 transition-all`}>
                                <p className={`text-[10px] font-bold ${text} opacity-70 uppercase tracking-wider mb-1`}>{slot}</p>
                                <h3 className={`font-black text-base ${text} leading-tight`}>{title}</h3>
                                <div className={`mt-4 flex items-center gap-1.5 ${text}`}>
                                    <Play size={13} fill="currentColor" className="opacity-80" />
                                    <span className="text-xs font-bold">{cta}</span>
                                </div>
                                <div className="absolute -bottom-5 -right-5 w-16 h-16 bg-white/20 rounded-full" />
                            </NavLink>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Streak stats bar — animated NumberFlow */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-5">
                <div className="flex items-center justify-around">
                    {[
                        { icon: Flame,    value: streak?.streak_days    ?? 0, label: 'Day Streak',  color: 'text-amber-500' },
                        { icon: BookOpen, value: streak?.total_read      ?? 0, label: 'Total Read',  color: 'text-indigo-600 dark:text-indigo-400' },
                        { icon: Trophy,   value: streak?.longest_streak  ?? 0, label: 'Best Streak', color: 'text-emerald-600 dark:text-emerald-400' },
                    ].map(({ icon: Icon, value, label, color }, i, arr) => (
                        <div key={label} className="flex items-center gap-5">
                            <div className="text-center">
                                <div className={`flex items-center justify-center gap-1 ${color}`}>
                                    <Icon size={18} />
                                    <NumberFlow value={value} className="text-3xl font-black" />
                                </div>
                                <p className={`text-[11px] font-bold uppercase tracking-wider mt-1 ${color}`}>{label}</p>
                            </div>
                            {i < arr.length - 1 && <div className="w-px h-10 bg-amber-200 dark:bg-amber-700/40" />}
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

// ── Teacher Overview ─────────────────────────────────────────────────────────
const TeacherOverview = () => {
    const { user } = useAuthContext();
    const name = user?.first_name || user?.username || 'Teacher';
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-emerald-200 text-sm font-semibold mb-1">{dateStr}</p>
                    <h1 className="text-2xl font-black mb-2">Welcome, {name}</h1>
                    <p className="text-emerald-100 text-sm max-w-md mb-5">Access your teaching materials and class resources.</p>
                    <NavLink to="/dashboard/manuals"
                        className="inline-flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 font-bold py-2.5 px-6 rounded-full text-sm transition-colors shadow-lg">
                        <FileText size={16} /> This Week's Manual →
                    </NavLink>
                </div>
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { icon: FileText,   title: 'Teaching Manuals', desc: 'Weekly lessons & teacher notes', to: '/dashboard/manuals',     iconBg: 'bg-emerald-500', cta: 'Open Manuals →' },
                    { icon: BookOpen,   title: 'Devotionals',      desc: 'Daily Bible reading for class',  to: '/dashboard/devotionals', iconBg: 'bg-indigo-500',  cta: 'Read Now →' },
                    { icon: Calendar,   title: 'Events',           desc: 'Upcoming events & activities',  to: '/dashboard/events',      iconBg: 'bg-amber-500',   cta: 'View Events →' },
                ].map(({ icon: Icon, title, desc, to, iconBg, cta }, i) => (
                    <motion.div key={to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                        <NavLink to={to}
                            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 flex flex-col h-full hover:shadow-md transition-shadow">
                            <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center mb-4`}>
                                <Icon size={20} className="text-white" />
                            </div>
                            <h3 className="font-bold text-gray-800 dark:text-white">{title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex-1">{desc}</p>
                            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold mt-4">{cta}</span>
                        </NavLink>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ── Router ───────────────────────────────────────────────────────────────────
const Overview = () => {
    const { user, ageGroup } = useAuthContext();

    if (user?.role === 'teacher') return <TeacherOverview />;
    if (ageGroup === 'toddler')  return <ToddlerOverview />;
    if (ageGroup === 'children') return <ChildOverview />;
    if (ageGroup === 'pre_teen') return <PreteenOverview />;
    return <TeenOverview />;
};

export default Overview;
