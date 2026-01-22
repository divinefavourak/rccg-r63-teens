import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    ThumbsUp,
    X,
    Upload,
    Eye,
    CloudDownload
} from 'lucide-react';
import api from '../api/axios';
import type { Devotional } from '../types';

import toast from 'react-hot-toast';

const AdminDevotionals = () => {
    const [devotionals, setDevotionals] = useState<Devotional[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState('All Status');
    const [searchQuery, setSearchQuery] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        scripture_reference: '', // Legacy/Fallback
        scripture_text: '', // Legacy/Fallback
        memory_verse_passage: '',
        memory_verse_content: '',
        bible_text_passage: '',
        bible_text_content: '',
        content: '',
        key_point: '',
        prayer: '',
        status: 'draft',
        cover_image: null as File | null
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewDevotional, setViewDevotional] = useState<Devotional | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, cover_image: e.target.files![0] }));
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            date: '',
            scripture_reference: '',
            scripture_text: '',
            memory_verse_passage: '',
            memory_verse_content: '',
            bible_text_passage: '',
            bible_text_content: '',
            content: '',
            key_point: '',
            prayer: '',
            status: 'draft',
            cover_image: null
        });
        setEditingId(null);
        setIsModalOpen(false);
    };

    const handleEdit = (devotional: Devotional) => {
        setFormData({
            title: devotional.title,
            date: devotional.date,
            scripture_reference: devotional.scripture_reference,
            scripture_text: devotional.scripture_text,
            memory_verse_passage: devotional.memory_verse_passage || '',
            memory_verse_content: devotional.memory_verse_content || '',
            bible_text_passage: devotional.bible_text_passage || '',
            bible_text_content: devotional.bible_text_content || '',
            content: devotional.content,
            key_point: devotional.key_point,
            prayer: devotional.prayer || '',
            status: devotional.status || 'draft',
            cover_image: null
        });
        setEditingId(devotional.id);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this devotional?')) return;

        try {
            await api.delete(`/content/devotionals/${id}/`);
            toast.success('Devotional deleted successfully');
            fetchDevotionals();
        } catch (error) {
            console.error("Failed to delete devotional", error);
            toast.error("Failed to delete devotional");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                const value = formData[key as keyof typeof formData];
                if (value !== null && value !== '') {
                    data.append(key, value as string | Blob);
                }
            });

            if (editingId) {
                await api.patch(`/content/devotionals/${editingId}/`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Devotional updated successfully');
            } else {
                await api.post('/content/devotionals/', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Devotional created successfully');
            }

            resetForm();
            fetchDevotionals();
        } catch (error) {
            console.error("Failed to save devotional", error);
            toast.error("Failed to save devotional");
        }
    };

    const handleAutoFetch = async () => {
        if (!window.confirm('This will automatically fetch devotionals for the next 7 days from the web. Continue?')) return;

        try {
            const loadingToast = toast.loading('Fetching devotionals...');
            const { data } = await api.post('/content/devotionals/fetch_from_web/', { days: 7 });
            toast.dismiss(loadingToast);

            if (data.success) {
                toast.success(`Successfully fetched ${data.fetched_count} devotionals!`);
                if (data.errors && data.errors.length > 0) {
                    toast('Some dates were skipped (already exist or not found)', { icon: '⚠️' });
                }
                fetchDevotionals();
            }
        } catch (error) {
            console.error("Failed to fetch devotionals", error);
            toast.dismiss();
            toast.error("Failed to auto-fetch devotionals");
        }
    };

    useEffect(() => {
        fetchDevotionals();
    }, []);

    const fetchDevotionals = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/content/devotionals/');
            setDevotionals(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch devotionals", error);
            toast.error("Failed to load devotionals");
        } finally {
            setLoading(false);
        }
    };

    const getStatus = (date: string) => {
        const devDate = new Date(date);
        const today = new Date();
        // Reset time to compare dates only
        today.setHours(0, 0, 0, 0);
        devDate.setHours(0, 0, 0, 0);

        if (devDate > today) return 'Scheduled';
        return 'Published';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Published': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Draft': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const filteredDevotionals = devotionals.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.scripture_reference.toLowerCase().includes(searchQuery.toLowerCase())
    );



    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Devotionals Management</h2>
                    <p className="text-gray-500 dark:text-gray-400">Create and manage daily devotionals for teens</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleAutoFetch}
                        className="btn-secondary py-2.5 px-4 flex items-center gap-2"
                        title="Auto-fetch from OpenHeavens"
                    >
                        <CloudDownload size={20} /> <span className="hidden md:inline">Auto-Import</span>
                    </button>
                    <button
                        onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                    >
                        <Plus size={20} /> Add Devotional
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search devotionals..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:border-green-500"
                        value={activeStatus}
                        onChange={(e) => setActiveStatus(e.target.value)}
                    >
                        <option>All Status</option>
                        <option>Published</option>
                        <option>Scheduled</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Scripture</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Engagement</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">Loading devotionals...</td>
                                </tr>
                            ) : filteredDevotionals.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">No devotionals found.</td>
                                </tr>
                            ) : filteredDevotionals.map((item) => {
                                const status = getStatus(item.date);
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {new Date(item.date).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-gray-900 dark:text-white">{item.title}</td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{item.scripture_reference}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(status)}`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <ThumbsUp size={14} /> {item.likes_count}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setViewDevotional(item)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="View"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingId ? 'Edit Devotional' : 'Create New Devotional'}
                            </h3>
                            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                    <input
                                        type="date"
                                        name="date"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.date}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                    <input
                                        type="text"
                                        name="title"
                                        required
                                        placeholder="Enter devotional title"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Memory Verse Reference</label>
                                        <input
                                            type="text"
                                            name="memory_verse_passage"
                                            placeholder="e.g., John 3:16"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                            value={formData.memory_verse_passage}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bible Reading Reference</label>
                                        <input
                                            type="text"
                                            name="bible_text_passage"
                                            placeholder="e.g., Psalm 23:1-6"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                            value={formData.bible_text_passage}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Memory Verse Text</label>
                                    <textarea
                                        name="memory_verse_content"
                                        rows={2}
                                        placeholder="The actual text of the memory verse..."
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.memory_verse_content}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bible Reading Text</label>
                                    <textarea
                                        name="bible_text_content"
                                        rows={3}
                                        placeholder="The text of the bible reading (optional, can be long)..."
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.bible_text_content}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Main Content</label>
                                    <textarea
                                        name="content"
                                        required
                                        rows={6}
                                        placeholder="Write the devotional content..."
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.content}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Point</label>
                                    <input
                                        type="text"
                                        name="key_point"
                                        required
                                        placeholder="Main takeaway message"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.key_point}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prayer</label>
                                    <textarea
                                        name="prayer"
                                        rows={2}
                                        placeholder="Prayer for the day"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.prayer}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cover Image</label>
                                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-green-500 transition-colors cursor-pointer relative bg-gray-50 dark:bg-gray-800/50">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                                            <Upload className="w-8 h-8 mb-2" />
                                            <span className="font-medium">Click to upload or drag and drop</span>
                                            <span className="text-xs">PNG, JPG up to 5MB</span>
                                            {formData.cover_image && (
                                                <div className="mt-2 text-green-600 font-medium text-sm bg-green-50 px-3 py-1 rounded-full">
                                                    Selected: {formData.cover_image.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                    <select
                                        name="status"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                        <option value="scheduled">Scheduled</option>
                                    </select>
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 z-10">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-2.5 px-4 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                                    >
                                        {editingId ? 'Update Devotional' : 'Save Devotional'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {viewDevotional && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{viewDevotional.title}</h3>
                                <p className="text-sm text-gray-500 mt-1">{new Date(viewDevotional.date).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setViewDevotional(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {viewDevotional.cover_image && (
                                <img
                                    src={viewDevotional.cover_image}
                                    alt={viewDevotional.title}
                                    className="w-full h-48 object-cover rounded-lg"
                                />
                            )}

                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border-l-4 border-green-500">
                                <h4 className="font-bold text-gray-900 dark:text-white mb-2">Scripture: {viewDevotional.scripture_reference}</h4>
                                <p className="text-gray-700 dark:text-gray-300 italic">"{viewDevotional.scripture_text}"</p>
                            </div>

                            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {viewDevotional.content}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                    <h5 className="font-bold text-blue-900 dark:text-blue-300 mb-1">Key Point</h5>
                                    <p className="text-blue-800 dark:text-blue-200 text-sm">{viewDevotional.key_point}</p>
                                </div>

                                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                    <h5 className="font-bold text-purple-900 dark:text-purple-300 mb-1">Prayer</h5>
                                    <p className="text-purple-800 dark:text-purple-200 text-sm">{viewDevotional.prayer}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setViewDevotional(null)}
                                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDevotionals;
