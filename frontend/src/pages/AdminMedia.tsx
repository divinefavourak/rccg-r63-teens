import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Play,
    Video,
    Music,
    Edit2,
    Trash2,
    X,
    Upload
} from 'lucide-react';
import api from '../api/axios';
import type { MediaEpisode } from '../types';
import toast from 'react-hot-toast';

const AdminMedia = () => {
    const [media, setMedia] = useState<MediaEpisode[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeType, setActiveType] = useState('All Types');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        media_type: 'audio',
        file: null as File | null,
        thumbnail: null as File | null,
        duration: '',
        published_at: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchMedia();
    }, [activeType]);

    const fetchMedia = async () => {
        try {
            setLoading(true);
            let url = '/content/media/';
            if (activeType !== 'All Types') {
                // url += `?type=${activeType.toLowerCase()}`;
            }
            const { data } = await api.get(url);
            setMedia(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch media", error);
            toast.error("Failed to load media");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'file' | 'thumbnail') => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, [field]: e.target.files![0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.file) {
            toast.error("Please select a media file to upload");
            return;
        }

        try {
            setIsSubmitting(true);
            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            data.append('media_type', formData.media_type);
            data.append('published_at', formData.published_at);
            if (formData.duration) data.append('duration', formData.duration);
            
            // Append files
            if (formData.file) data.append('file', formData.file); // Adjust field name 'file' based on your backend serializer (e.g. 'file_url' or 'media_file')
            if (formData.thumbnail) data.append('thumbnail', formData.thumbnail);

            await api.post('/content/media/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Media uploaded successfully');
            setIsModalOpen(false);
            
            // Reset form
            setFormData({
                title: '',
                description: '',
                media_type: 'audio',
                file: null,
                thumbnail: null,
                duration: '',
                published_at: new Date().toISOString().split('T')[0]
            });
            
            fetchMedia();
        } catch (error) {
            console.error("Failed to upload media", error);
            toast.error("Failed to upload media");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await api.delete(`/content/media/${id}/`);
            toast.success("Media deleted");
            fetchMedia();
        } catch (error) {
            toast.error("Failed to delete media");
        }
    };

    const filteredMedia = media.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = activeType === 'All Types' ||
            (activeType === 'Audio' && item.media_type === 'audio') ||
            (activeType === 'Video' && item.media_type === 'video');
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Media Management</h2>
                    <p className="text-gray-500 dark:text-gray-400">Manage podcasts, videos, and sermons</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                >
                    <Plus size={20} /> Upload Media
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search media..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:border-green-500"
                        value={activeType}
                        onChange={(e) => setActiveType(e.target.value)}
                    >
                        <option>All Types</option>
                        <option>Audio</option>
                        <option>Video</option>
                    </select>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-10 text-gray-500">Loading media...</div>
                ) : filteredMedia.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-gray-500">No media found.</div>
                ) : filteredMedia.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group">
                        <div className="aspect-video bg-gray-100 dark:bg-gray-900 relative flex items-center justify-center">
                            {item.thumbnail_url ? (
                                <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                            ) : item.media_type === 'video' ? (
                                <Video size={48} className="text-gray-300 dark:text-gray-700" />
                            ) : (
                                <Music size={48} className="text-gray-300 dark:text-gray-700" />
                            )}
                            <span className={`absolute top-4 left-4 px-2.5 py-1 rounded-lg text-xs font-bold ${item.media_type === 'video' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                                {item.media_type === 'video' ? 'Video' : 'Podcast'}
                            </span>
                            <span className="absolute bottom-4 right-4 px-2 py-1 rounded bg-black/50 text-white text-xs font-medium backdrop-blur-sm">
                                {item.duration || '00:00'}
                            </span>
                        </div>

                        <div className="p-4">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-1 line-clamp-1">{item.title}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{new Date(item.published_at).toLocaleDateString()}</p>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                                    <Play size={12} /> {0} plays
                                </div>
                                <div className="flex gap-1">
                                    <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Upload Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg my-8">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Upload Media</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                    <input 
                                        type="text" 
                                        name="title"
                                        required
                                        className="form-input" 
                                        value={formData.title}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                                    <select 
                                        name="media_type" 
                                        className="form-input"
                                        value={formData.media_type}
                                        onChange={handleInputChange}
                                    >
                                        <option value="audio">Audio (Podcast)</option>
                                        <option value="video">Video</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                    <textarea 
                                        name="description" 
                                        rows={3} 
                                        className="form-input"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Media File</label>
                                    <input 
                                        type="file" 
                                        accept={formData.media_type === 'audio' ? 'audio/*' : 'video/*'}
                                        required
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                        onChange={(e) => handleFileChange(e, 'file')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thumbnail (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                                        onChange={(e) => handleFileChange(e, 'thumbnail')}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                                        <input 
                                            type="text" 
                                            name="duration"
                                            placeholder="e.g. 15:30"
                                            className="form-input" 
                                            value={formData.duration}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                        <input 
                                            type="date" 
                                            name="published_at"
                                            className="form-input" 
                                            value={formData.published_at}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting}
                                        className="w-full btn-primary py-3 flex justify-center items-center gap-2"
                                    >
                                        {isSubmitting ? <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span> : <Upload size={20} />}
                                        {isSubmitting ? 'Uploading...' : 'Upload Media'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMedia;
