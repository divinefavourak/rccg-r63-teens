// frontend/src/pages/AdminDevotionals.tsx

import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Edit2, Trash2, ThumbsUp, X,
    Upload, Eye, CloudDownload
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
        author: 'Pastor E.A. Adeboye',
        // Scripture & Memory Verse
        memory_verse_passage: '',
        memory_verse_content: '',
        bible_text_passage: '',
        bible_text_content: '',
        bible_in_one_year: '',
        // Content
        content: '',
        key_point: '',
        prayer: '',
        hymn: '',
        // Meta
        status: 'draft',
        cover_image: null as File | null
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewDevotional, setViewDevotional] = useState<Devotional | null>(null);

    // Auto-import modal state
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importDays, setImportDays] = useState(7);
    const [importDate, setImportDate] = useState('');
    const [importForce, setImportForce] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

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
            author: 'Pastor E.A. Adeboye',
            memory_verse_passage: '',
            memory_verse_content: '',
            bible_text_passage: '',
            bible_text_content: '',
            bible_in_one_year: '',
            content: '',
            key_point: '',
            prayer: '',
            hymn: '',
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
            author: devotional.author || 'Pastor E.A. Adeboye',
            
            // Prefer new fields, fallback to legacy if needed
            memory_verse_passage: devotional.memory_verse_passage || devotional.anchor_scripture || '',
            memory_verse_content: devotional.memory_verse_content || devotional.scripture_text || '',
            bible_text_passage: devotional.bible_text_passage || devotional.scripture_reference || '',
            bible_text_content: devotional.bible_text_content || '',
            bible_in_one_year: devotional.bible_in_one_year || '',
            
            content: devotional.content,
            key_point: devotional.key_point || '',
            prayer: devotional.prayer || devotional.prayer_point || '',
            hymn: devotional.hymn || '',
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
        setIsImporting(true);
        try {
            const payload: Record<string, unknown> = { force: importForce };
            if (importDate) {
                payload.date = importDate;
            } else {
                payload.days = importDays;
            }

            const loadingToast = toast.loading('Importing devotionals from web...');
            const { data } = await api.post('/content/devotionals/fetch_from_web/', payload);
            toast.dismiss(loadingToast);

            if (data.success) {
                const msg = importDate
                    ? data.fetched_count > 0
                        ? `Imported devotional for ${importDate}`
                        : `Devotional for ${importDate} already exists or not yet published`
                    : `Imported ${data.fetched_count} devotional(s). Skipped: ${data.skipped_count}`;
                data.fetched_count > 0 ? toast.success(msg) : toast(msg, { icon: 'ℹ️' });
                setIsImportModalOpen(false);
                fetchDevotionals();
            }
        } catch (error: unknown) {
            toast.dismiss();
            const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(msg || 'Failed to auto-import devotionals');
        } finally {
            setIsImporting(false);
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
        (item.bible_text_passage && item.bible_text_passage.toLowerCase().includes(searchQuery.toLowerCase()))
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
                        onClick={() => setIsImportModalOpen(true)}
                        className="btn-secondary py-2.5 px-4 flex items-center gap-2"
                        title="Auto-import from OpenHeavens"
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
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reading</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Likes</th>
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
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                            {item.bible_text_passage || item.scripture_reference || '-'}
                                        </td>
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
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl my-8 flex flex-col max-h-[90vh]">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                        <input
                                            type="date"
                                            name="date"
                                            required
                                            className="form-input"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Author</label>
                                        <input
                                            type="text"
                                            name="author"
                                            className="form-input"
                                            value={formData.author}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme (Title)</label>
                                    <input
                                        type="text"
                                        name="title"
                                        required
                                        placeholder="e.g. FROM GOOD TO VERY GOOD"
                                        className="form-input font-bold"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-4 border border-gray-200 dark:border-gray-700">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Scripture Details</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Memory Verse Ref.</label>
                                            <input
                                                type="text"
                                                name="memory_verse_passage"
                                                placeholder="e.g. Genesis 26:13"
                                                className="form-input text-sm"
                                                value={formData.memory_verse_passage}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Reading Ref.</label>
                                            <input
                                                type="text"
                                                name="bible_text_passage"
                                                placeholder="e.g. 2 KINGS 4:8-17"
                                                className="form-input text-sm"
                                                value={formData.bible_text_passage}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Memory Verse Content</label>
                                        <textarea
                                            name="memory_verse_content"
                                            rows={2}
                                            className="form-input text-sm"
                                            value={formData.memory_verse_content}
                                            onChange={handleInputChange}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bible Reading Content (Full Text)</label>
                                        <textarea
                                            name="bible_text_content"
                                            rows={4}
                                            className="form-input text-sm font-serif"
                                            value={formData.bible_text_content}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bible In One Year</label>
                                        <input
                                            type="text"
                                            name="bible_in_one_year"
                                            placeholder="e.g. EXODUS 24-27"
                                            className="form-input text-sm"
                                            value={formData.bible_in_one_year}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Content</label>
                                    <textarea
                                        name="content"
                                        required
                                        rows={8}
                                        className="form-input"
                                        value={formData.content}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Point</label>
                                    <input
                                        type="text"
                                        name="key_point"
                                        className="form-input"
                                        value={formData.key_point}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prayer</label>
                                    <textarea
                                        name="prayer"
                                        rows={2}
                                        className="form-input"
                                        value={formData.prayer}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hymn (Full Lyrics)</label>
                                    <textarea
                                        name="hymn"
                                        rows={6}
                                        placeholder="Hymn lyrics..."
                                        className="form-input font-serif"
                                        value={formData.hymn}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                    <select
                                        name="status"
                                        className="form-input"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                    </select>
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 z-10">
                                    <button type="button" onClick={resetForm} className="flex-1 btn-secondary py-3">Cancel</button>
                                    <button type="submit" className="flex-1 btn-primary py-3">{editingId ? 'Update' : 'Save'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal logic remains largely same, just updated to show new fields if desired */}
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
                            {/* Preview Content */}
                            <div className="prose dark:prose-invert max-w-none">
                                <p><strong>Memorise:</strong> {viewDevotional.memory_verse_content}</p>
                                <p><strong>Read:</strong> {viewDevotional.bible_text_passage}</p>
                                <hr />
                                <div dangerouslySetInnerHTML={{ __html: viewDevotional.content }} />
                                {viewDevotional.key_point && <p className="bg-blue-50 p-2 rounded"><strong>Key Point:</strong> {viewDevotional.key_point}</p>}
                                {viewDevotional.hymn && <pre className="bg-gray-50 p-4 rounded text-sm font-sans whitespace-pre-wrap">{viewDevotional.hymn}</pre>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto-Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <CloudDownload size={22} className="text-green-600" />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Auto-Import Devotionals</h3>
                            </div>
                            <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Fetches Teen Open Heaven devotionals from <span className="font-medium text-gray-700 dark:text-gray-300">openheavens.com.ng</span> and saves them to the database.
                            </p>

                            {/* Specific date OR last N days */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Specific Date <span className="text-gray-400 font-normal">(leave blank to import last N days)</span>
                                </label>
                                <input
                                    type="date"
                                    value={importDate}
                                    onChange={e => setImportDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                />
                            </div>

                            {!importDate && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Days to backfill: <span className="text-green-600 font-bold">{importDays}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min={1} max={30}
                                        value={importDays}
                                        onChange={e => setImportDays(Number(e.target.value))}
                                        className="w-full accent-green-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>1 day</span><span>30 days</span>
                                    </div>
                                </div>
                            )}

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={importForce}
                                    onChange={e => setImportForce(e.target.checked)}
                                    className="w-4 h-4 accent-green-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    Force re-import <span className="text-gray-400">(overwrites existing records)</span>
                                </span>
                            </label>
                        </div>

                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                onClick={() => setIsImportModalOpen(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAutoFetch}
                                disabled={isImporting}
                                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {isImporting ? (
                                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing...</>
                                ) : (
                                    <><CloudDownload size={16} /> Start Import</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDevotionals;
