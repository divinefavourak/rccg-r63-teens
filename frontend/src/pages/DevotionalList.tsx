import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import DevotionalCard from '../components/DevotionalCard';
import { type Devotional } from '../types';
import api from '../api/axios';
import { FaCalendarAlt, FaSearch } from 'react-icons/fa';

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
            let url = '/content/devotionals/';
            const params = new URLSearchParams();
            if (selectedDate) params.append('date', selectedDate);
            // Backend might support ?search=... or we client filter

            const { data } = await api.get(`${url}?${params.toString()}`);
            // Assuming data is paginated { results: [], count: ... } or just []
            setDevotionals(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch devotionals", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDevotionals = devotionals.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Navbar />
            <div className="container mx-auto px-4 py-24">

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white uppercase mb-4">
                        TEENAGE OPEN HEAVENS
                    </h1>
                    <div className="w-24 h-1 bg-primary-500 mx-auto rounded-full"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Daily spiritual nourishment for your growth.
                    </p>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-64">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search topics..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <FaCalendarAlt className="text-gray-400" />
                        <input
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

            </div>
        </div>
    );
};

export default DevotionalList;
