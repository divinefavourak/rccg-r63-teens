import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { type MediaEpisode } from '../types';
import { FaMusic, FaClock } from 'react-icons/fa';

const MediaList = () => {
    const [media, setMedia] = useState<MediaEpisode[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'audio' | 'video'>('all');

    useEffect(() => {
        fetchMedia();
    }, [filter]);

    const fetchMedia = async () => {
        setLoading(true);
        try {
            let url = '/media/';
            if (filter !== 'all') {
                url += `?type=${filter}`;
            }
            const { data } = await api.get(url);
            setMedia(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch media");
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
                        MEDIA LIBRARY
                    </h1>
                    <div className="w-24 h-1 bg-primary-500 mx-auto rounded-full"></div>

                    <div className="mt-8 inline-flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        {(['all', 'audio', 'video'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilter(type)}
                                className={`px-6 py-2 rounded-lg text-sm font-bold uppercase transition-all ${filter === type
                                    ? 'bg-primary-500 text-white shadow-md'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-200 animate-pulse rounded-2xl"></div>)}
                    </div>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {media.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden group">
                                <div className="aspect-video bg-gray-900 relative group">
                                    {item.media_type === 'video' ? (
                                        <video controls className="w-full h-full object-cover">
                                            <source src={item.file_url} type="video/mp4" />
                                            Your browser does not support video.
                                        </video>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 to-primary-900">
                                            <FaMusic className="text-white/20 text-6xl" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <audio controls className="w-10/12">
                                                    <source src={item.file_url} />
                                                </audio>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${item.media_type === 'video' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                                            {item.media_type}
                                        </span>
                                        <div className="flex items-center text-gray-400 text-xs">
                                            <FaClock className="mr-1" /> {item.duration}
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{item.title}</h3>
                                    <p className="text-gray-500 text-sm line-clamp-2">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediaList;
