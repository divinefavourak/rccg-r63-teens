import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { type Manual } from '../types';
import { FaBook, FaDownload, FaEye } from 'react-icons/fa';
import Seo from '../components/Seo';

const AGE_LABELS: Record<string, string> = {
    all: 'All Ages',
    children: 'Children (6–8)',
    pre_teen: 'Pre-Teen (9–12)',
    teen: 'Teen (13–19)',
    superteen: 'Superteen (19+)',
};

const ManualList = () => {
    const [manuals, setManuals] = useState<Manual[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchManuals();
    }, []);

    const fetchManuals = async () => {
        try {
            const { data } = await api.get('/content/manuals/');
            setManuals(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch manuals");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Seo title="Study Manuals" description="Weekly Bible study manuals for RCCG Region 63 Teens, organised by series and week." path="/manuals" />
            <Navbar />
            <div className="container mx-auto px-4 py-24">

                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase mb-4">
                        TEACHING MANUALS(Upload for categories)
                    </h1>
                    <div className="w-24 h-1 bg-yellow-500 mx-auto rounded-full"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                        Resources for teachers and students.
                    </p>
                </div>

                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-200 animate-pulse rounded-2xl"></div>)}
                    </div>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {manuals.map((manual) => (
                            <div key={manual.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="h-48 bg-gray-200 dark:bg-gray-700 relative">
                                    {/* Placeholder or actual cover */}
                                    {manual.cover_image ? (
                                        <img src={manual.cover_image} alt={manual.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <FaBook size={48} />
                                        </div>
                                    )}
                                </div>
                                <div className="p-6">
                                    <div className="flex items-center gap-2 mb-1">
                                        {manual.target_age_group && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                {AGE_LABELS[manual.target_age_group] || manual.target_age_group}
                                            </span>
                                        )}
                                        {manual.week_number > 0 && (
                                            <span className="text-xs text-gray-400">Week {manual.week_number}</span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{manual.title}</h3>
                                    {manual.theme && (
                                        <p className="text-gray-500 text-sm mb-1 line-clamp-1">{manual.theme}</p>
                                    )}
                                    {manual.week_start_date && (
                                        <p className="text-xs text-gray-400 mb-4">
                                            {new Date(manual.week_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    )}

                                    {(manual.pdf_file || manual.pdf_url) ? (
                                        <div className="flex gap-4">
                                            <a
                                                href={manual.pdf_file || manual.pdf_url || ''}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-sm"
                                            >
                                                <FaEye /> View
                                            </a>
                                            <a
                                                href={manual.pdf_file || manual.pdf_url || ''}
                                                download
                                                className="btn-secondary px-4 flex items-center justify-center"
                                            >
                                                <FaDownload />
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-center text-gray-400 py-2">No PDF available</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualList;
