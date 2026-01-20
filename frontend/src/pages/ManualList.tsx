import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { Manual } from '../types';
import { FaBook, FaDownload, FaEye } from 'react-icons/fa';

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
            <Navbar />
            <div className="container mx-auto px-4 py-24">

                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase mb-4">
                        TEACHING MANUALS
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
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{manual.title}</h3>
                                    <p className="text-gray-500 text-sm mb-6 line-clamp-2">{manual.description}</p>

                                    <div className="flex gap-4">
                                        <a
                                            href={manual.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-sm"
                                        >
                                            <FaEye /> View
                                        </a>
                                        <a
                                            href={manual.file_url}
                                            download
                                            className="btn-secondary px-4 flex items-center justify-center"
                                        >
                                            <FaDownload />
                                        </a>
                                    </div>
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
