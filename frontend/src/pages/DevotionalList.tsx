import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DevotionalCard from '../components/DevotionalCard';
import { type Devotional } from '../types';
import api from '../api/axios';
import { FaCalendarAlt, FaSearch } from 'react-icons/fa';
import Seo from '../components/Seo';
import { itemListLd } from '../../seo/schema.mjs';

/**
 * The archive of Teenage Open Heavens.
 *
 * The page is written for two readers. A teenager decides in one line whether
 * today's reading is worth four minutes; a search engine needs a page that
 * says plainly what this content is, who writes it and how often it changes.
 * Both are served by the header and by the section under the list, which is
 * where the page explains itself in prose rather than in cards.
 *
 * The list asks for 60 rows instead of the default 20. Every row is a link to a
 * devotional, and the only other path to an old reading is the sitemap; sixty
 * recent ones is what a crawler will follow to reach the archive.
 */
const DevotionalList = () => {
    const [devotionals, setDevotionals] = useState<Devotional[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchDevotionals();
    }, [selectedDate]); // Refetch when date changes

    const fetchDevotionals = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ status: 'published', page_size: '60', ordering: '-date' });
            if (selectedDate) params.set('date', selectedDate);

            const { data } = await api.get(`/content/devotionals/?${params.toString()}`);
            // Paginated endpoints return { results }, hard-sliced actions an array.
            setDevotionals(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch devotionals", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDevotionals = devotionals.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Seo
                path="/devotionals"
                jsonLd={
                    devotionals.length
                        ? itemListLd({
                            url: '/devotionals',
                            name: 'Teenage Open Heavens — daily devotionals',
                            itemType: 'Article',
                            items: devotionals.slice(0, 20).map((item) => ({
                                url: `/devotionals/${item.id}`,
                                name: item.title,
                                datePublished: item.date,
                                image: item.cover_image,
                            })),
                        })
                        : undefined
                }
            />
            <Navbar />
            <div className="container mx-auto px-4 py-24">

                {/* Header */}
                <div className="text-center mb-12">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400 mb-3">
                        RCCG Region 63 Junior Church
                    </p>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white uppercase mb-4">
                        Teenage Open Heavens
                    </h1>
                    <div className="w-24 h-1 bg-primary-500 mx-auto rounded-full"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        The daily devotional for teenagers: a short reading, a memory verse to keep, a key point and a
                        prayer point. A new one is published every morning, and the archive stays open.
                    </p>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-64">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <label htmlFor="devotional-search" className="sr-only">Search devotionals by title or topic</label>
                        <input
                            id="devotional-search"
                            type="search"
                            placeholder="Search topics..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <FaCalendarAlt className="text-gray-400" aria-hidden />
                        <label htmlFor="devotional-date" className="sr-only">Pick a date</label>
                        <input
                            id="devotional-date"
                            type="date"
                            className="px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white dark:[color-scheme:dark]"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                        {selectedDate && (
                            <button
                                onClick={() => setSelectedDate('')}
                                className="text-sm text-red-500 hover:text-red-700"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
                        ))}
                    </div>
                ) : (
                    <>
                        {filteredDevotionals.length > 0 ? (
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {filteredDevotionals.map((devotional) => (
                                    <DevotionalCard key={devotional.id} devotional={devotional} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-gray-500">
                                <p className="text-xl">No devotionals found.</p>
                                <button
                                    onClick={() => { setSelectedDate(''); setSearchQuery(''); }}
                                    className="mt-4 text-primary-500 hover:underline"
                                >
                                    Clear filters
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/*
                    The prose section. It exists because a grid of cards says what
                    the devotionals are called and nothing about what they are,
                    who writes them, or how often they arrive — which is the part
                    a reader deciding whether to come back, and a search engine,
                    both need.
                */}
                <section aria-labelledby="about-the-devotional" className="mt-20 max-w-3xl mx-auto">
                    <h2 id="about-the-devotional" className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                        What is Teenage Open Heavens?
                    </h2>
                    <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
                        <p>
                            Teenage Open Heavens is the daily devotional of the Redeemed Christian Church of God,
                            written for teenagers rather than for adults. Each day&rsquo;s reading opens with a
                            passage of Scripture and a memory verse, carries a short message, and ends with a key
                            point and a prayer point you can pray in your own words.
                        </p>
                        <p>
                            Every reading here is published free, without an account, and it stays available
                            afterwards — so a missed morning is not a lost one. If you would rather read on your
                            phone with the verse, the Bible text and a reminder in one place, the{' '}
                            <Link to="/#install" className="text-primary-600 dark:text-primary-400 underline">
                                Faith Tribe app
                            </Link>{' '}
                            carries today&rsquo;s devotional, the whole Bible and your reading streak.
                        </p>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-10 mb-3">
                        Keep going after today&rsquo;s reading
                    </h2>
                    <ul className="grid gap-3 sm:grid-cols-2">
                        <li>
                            <Link to="/manuals" className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary-400 transition-colors">
                                <span className="font-semibold text-gray-900 dark:text-white">This week&rsquo;s study manual</span>
                                <span className="block text-sm text-gray-500 dark:text-gray-400">
                                    The teaching manual for your class, week by week.
                                </span>
                            </Link>
                        </li>
                        <li>
                            <Link to="/media" className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary-400 transition-colors">
                                <span className="font-semibold text-gray-900 dark:text-white">Podcasts and worship</span>
                                <span className="block text-sm text-gray-500 dark:text-gray-400">
                                    Messages and ministration to listen to on the way.
                                </span>
                            </Link>
                        </li>
                        <li>
                            <Link to="/events" className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary-400 transition-colors">
                                <span className="font-semibold text-gray-900 dark:text-white">Camps and events</span>
                                <span className="block text-sm text-gray-500 dark:text-gray-400">
                                    What is coming up in Region 63, and how to register.
                                </span>
                            </Link>
                        </li>
                        <li>
                            <Link to="/help" className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary-400 transition-colors">
                                <span className="font-semibold text-gray-900 dark:text-white">Questions</span>
                                <span className="block text-sm text-gray-500 dark:text-gray-400">
                                    Accounts, notifications and how to get the app.
                                </span>
                            </Link>
                        </li>
                    </ul>
                </section>

            </div>
        </div>
    );
};

export default DevotionalList;
