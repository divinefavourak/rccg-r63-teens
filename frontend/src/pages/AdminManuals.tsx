import { useState, useEffect } from 'react';
import {
    Plus, Search, Edit2, Trash2, X, Upload,
    FileText, Download, ChevronDown, ChevronUp
} from 'lucide-react';
import api from '../api/axios';
import type { Manual } from '../types';
import toast from 'react-hot-toast';

const AGE_GROUP_LABELS: Record<string, string> = {
    all: 'All Ages',
    pre_teen: 'Pre-Teens (8-12)',
    teen: 'Teens (13-15)',
    young_adult: 'Young Adults (16-19)',
};

const EMPTY_FORM = {
    title: '',
    week_number: '',
    week_start_date: '',
    week_end_date: '',
    target_age_group: 'teen',
    theme: '',
    memory_verse: '',
    memory_verse_text: '',
    lesson_objectives: '',   // newline-separated
    lesson_content: '',
    key_takeaways: '',       // newline-separated
    discussion_questions: '', // newline-separated
    practical_application: '',
    closing_prayer: '',
    pdf_url: '',
    pdf_file: null as File | null,
    cover_image: null as File | null,
    status: 'published',
};

type FormState = typeof EMPTY_FORM;

/** Compute week_end_date (Saturday) from a Sunday week_start_date string */
function weekEnd(startStr: string): string {
    if (!startStr) return '';
    const d = new Date(startStr);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
}

/** Split newline-separated text into a clean string array */
function toList(text: string): string[] {
    return text.split('\n').map(l => l.trim()).filter(Boolean);
}

const AdminManuals = () => {
    const [manuals, setManuals] = useState<Manual[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAge, setFilterAge] = useState('all');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<FormState>({ ...EMPTY_FORM });
    const [activeTab, setActiveTab] = useState<'basic' | 'content' | 'resources'>('basic');

    useEffect(() => { fetchManuals(); }, []);

    const fetchManuals = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/content/manuals/');
            setManuals(Array.isArray(data) ? data : data.results || []);
        } catch {
            toast.error('Failed to load manuals');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setFormData({ ...EMPTY_FORM });
        setActiveTab('basic');
        setIsModalOpen(true);
    };

    const openEdit = (manual: Manual) => {
        setEditingId(manual.id);
        setFormData({
            title: manual.title || '',
            week_number: String(manual.week_number || ''),
            week_start_date: manual.week_start_date || '',
            week_end_date: manual.week_end_date || '',
            target_age_group: manual.target_age_group || 'teen',
            theme: manual.theme || '',
            memory_verse: manual.memory_verse || '',
            memory_verse_text: manual.memory_verse_text || '',
            lesson_objectives: (manual.lesson_objectives || []).join('\n'),
            lesson_content: manual.lesson_content || '',
            key_takeaways: (manual.key_takeaways || []).join('\n'),
            discussion_questions: (manual.discussion_questions || []).join('\n'),
            practical_application: manual.practical_application || '',
            closing_prayer: manual.closing_prayer || '',
            pdf_url: manual.pdf_url || '',
            pdf_file: null,
            cover_image: null,
            status: manual.status || 'published',
        });
        setActiveTab('basic');
        setIsModalOpen(true);
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            // Auto-compute week_end_date when week_start_date changes
            if (name === 'week_start_date') {
                updated.week_end_date = weekEnd(value);
            }
            return updated;
        });
    };

    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        field: 'pdf_file' | 'cover_image'
    ) => {
        if (e.target.files?.[0]) {
            setFormData(prev => ({ ...prev, [field]: e.target.files![0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) { toast.error('Title is required'); return; }
        if (!formData.week_start_date) { toast.error('Week start date is required'); return; }

        try {
            setIsSubmitting(true);
            const fd = new FormData();

            fd.append('title', formData.title.trim());
            fd.append('week_number', formData.week_number || '0');
            fd.append('week_start_date', formData.week_start_date);
            fd.append('week_end_date', formData.week_end_date || weekEnd(formData.week_start_date));
            fd.append('target_age_group', formData.target_age_group);
            fd.append('theme', formData.theme);
            fd.append('memory_verse', formData.memory_verse);
            fd.append('memory_verse_text', formData.memory_verse_text);
            fd.append('lesson_content', formData.lesson_content);
            fd.append('practical_application', formData.practical_application);
            fd.append('closing_prayer', formData.closing_prayer);
            fd.append('pdf_url', formData.pdf_url);
            fd.append('status', formData.status);

            // JSON list fields
            fd.append('lesson_objectives', JSON.stringify(toList(formData.lesson_objectives)));
            fd.append('key_takeaways', JSON.stringify(toList(formData.key_takeaways)));
            fd.append('discussion_questions', JSON.stringify(toList(formData.discussion_questions)));

            if (formData.pdf_file) fd.append('pdf_file', formData.pdf_file);
            if (formData.cover_image) fd.append('cover_image', formData.cover_image);

            if (editingId) {
                await api.patch(`/content/manuals/${editingId}/`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                toast.success('Manual updated');
            } else {
                await api.post('/content/manuals/', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                toast.success('Manual created');
            }

            setIsModalOpen(false);
            fetchManuals();
        } catch (err: any) {
            const msg = err?.response?.data
                ? Object.values(err.response.data).flat().join(' ')
                : 'Failed to save manual';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this manual?')) return;
        try {
            await api.delete(`/content/manuals/${id}/`);
            toast.success('Manual deleted');
            fetchManuals();
        } catch {
            toast.error('Failed to delete manual');
        }
    };

    const filtered = manuals.filter(m => {
        const matchSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchAge = filterAge === 'all' || m.target_age_group === filterAge;
        return matchSearch && matchAge;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Manuals Management</h2>
                    <p className="text-gray-500 dark:text-gray-400">Manage weekly study manuals and resources</p>
                </div>
                <button
                    onClick={openCreate}
                    className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                >
                    <Plus size={20} /> Add Manual
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search manuals..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:border-green-500"
                    value={filterAge}
                    onChange={e => setFilterAge(e.target.value)}
                >
                    <option value="all">All Age Groups</option>
                    <option value="teen">Teens (13-15)</option>
                    <option value="young_adult">Young Adults (16-19)</option>
                    <option value="pre_teen">Pre-Teens (8-12)</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Age Group</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Week Of</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">PDF</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading manuals...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No manuals found.</td></tr>
                            ) : filtered.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                                <FileText size={16} className="text-green-600 dark:text-green-400" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</div>
                                                {item.theme && (
                                                    <div className="text-xs text-gray-400">{item.theme}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                        {AGE_GROUP_LABELS[item.target_age_group || ''] || item.target_age_group || '—'}
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                        {item.week_start_date
                                            ? new Date(item.week_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : '—'}
                                    </td>
                                    <td className="p-4">
                                        {item.has_pdf || item.pdf_file || item.pdf_url ? (
                                            <a
                                                href={item.pdf_file || item.pdf_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                            >
                                                <Download size={14} /> View PDF
                                            </a>
                                        ) : (
                                            <span className="text-xs text-gray-400">No PDF</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                            item.status === 'published'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>
                                            {item.status || 'published'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEdit(item)}
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl my-8">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingId ? 'Edit Manual' : 'Add Manual'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 dark:border-gray-700 px-6">
                            {(['basic', 'content', 'resources'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors capitalize ${
                                        activeTab === tab
                                            ? 'border-green-500 text-green-600 dark:text-green-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                >
                                    {tab === 'basic' ? 'Basic Info' : tab === 'content' ? 'Lesson Content' : 'Resources'}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">

                                {/* ── Tab: Basic Info ── */}
                                {activeTab === 'basic' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Topic / Title <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="title"
                                                required
                                                placeholder="e.g. Good Communication Skills"
                                                className="form-input"
                                                value={formData.title}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Week Start Date (Sunday) <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    name="week_start_date"
                                                    required
                                                    className="form-input"
                                                    value={formData.week_start_date}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Week End Date (Saturday)
                                                </label>
                                                <input
                                                    type="date"
                                                    name="week_end_date"
                                                    className="form-input"
                                                    value={formData.week_end_date}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Age Group
                                                </label>
                                                <select
                                                    name="target_age_group"
                                                    className="form-input"
                                                    value={formData.target_age_group}
                                                    onChange={handleChange}
                                                >
                                                    <option value="teen">Teens (13-15)</option>
                                                    <option value="young_adult">Young Adults (16-19)</option>
                                                    <option value="pre_teen">Pre-Teens (8-12)</option>
                                                    <option value="all">All Ages</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Lesson Number
                                                </label>
                                                <input
                                                    type="number"
                                                    name="week_number"
                                                    min="1"
                                                    placeholder="e.g. 47"
                                                    className="form-input"
                                                    value={formData.week_number}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Bible Text (passage reference)
                                            </label>
                                            <input
                                                type="text"
                                                name="theme"
                                                placeholder="e.g. James 1:2-4"
                                                className="form-input"
                                                value={formData.theme}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Memory Verse Reference
                                                </label>
                                                <input
                                                    type="text"
                                                    name="memory_verse"
                                                    placeholder="e.g. Philippians 4:6"
                                                    className="form-input"
                                                    value={formData.memory_verse}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Status
                                                </label>
                                                <select
                                                    name="status"
                                                    className="form-input"
                                                    value={formData.status}
                                                    onChange={handleChange}
                                                >
                                                    <option value="published">Published</option>
                                                    <option value="draft">Draft</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Memory Verse Text
                                            </label>
                                            <textarea
                                                name="memory_verse_text"
                                                rows={2}
                                                placeholder="Full text of the memory verse"
                                                className="form-input"
                                                value={formData.memory_verse_text}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* ── Tab: Lesson Content ── */}
                                {activeTab === 'content' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Lesson Objectives / Outlines
                                                <span className="text-xs text-gray-400 ml-2">(one per line)</span>
                                            </label>
                                            <textarea
                                                name="lesson_objectives"
                                                rows={3}
                                                placeholder={"A. Understanding the topic\nB. Applying biblical principles"}
                                                className="form-input font-mono text-sm"
                                                value={formData.lesson_objectives}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Lesson Content
                                            </label>
                                            <textarea
                                                name="lesson_content"
                                                rows={10}
                                                placeholder="Introduction, Section A, Section B, Summary, Conclusion..."
                                                className="form-input text-sm"
                                                value={formData.lesson_content}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Key Takeaways
                                                <span className="text-xs text-gray-400 ml-2">(one per line)</span>
                                            </label>
                                            <textarea
                                                name="key_takeaways"
                                                rows={3}
                                                placeholder={"Faith anchors us in difficult times\nGod is faithful in all circumstances"}
                                                className="form-input font-mono text-sm"
                                                value={formData.key_takeaways}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Discussion Questions
                                                <span className="text-xs text-gray-400 ml-2">(one per line)</span>
                                            </label>
                                            <textarea
                                                name="discussion_questions"
                                                rows={3}
                                                placeholder={"What pressures do you face daily?\nHow has your faith helped you overcome challenges?"}
                                                className="form-input font-mono text-sm"
                                                value={formData.discussion_questions}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Practical Application
                                            </label>
                                            <textarea
                                                name="practical_application"
                                                rows={3}
                                                className="form-input text-sm"
                                                value={formData.practical_application}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Closing Prayer
                                            </label>
                                            <textarea
                                                name="closing_prayer"
                                                rows={3}
                                                className="form-input text-sm"
                                                value={formData.closing_prayer}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* ── Tab: Resources ── */}
                                {activeTab === 'resources' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Upload PDF File
                                            </label>
                                            <input
                                                type="file"
                                                accept=".pdf,application/pdf"
                                                className="file-input"
                                                onChange={e => handleFileChange(e, 'pdf_file')}
                                            />
                                            {formData.pdf_file && (
                                                <p className="text-xs text-green-600 mt-1">
                                                    Selected: {formData.pdf_file.name}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                — or — PDF URL (external link)
                                            </label>
                                            <input
                                                type="url"
                                                name="pdf_url"
                                                placeholder="https://example.com/manual.pdf"
                                                className="form-input"
                                                value={formData.pdf_url}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Cover Image (optional)
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="file-input"
                                                onChange={e => handleFileChange(e, 'cover_image')}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center gap-3">
                                <div className="flex gap-2">
                                    {(['basic', 'content', 'resources'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => setActiveTab(tab)}
                                            className={`w-2 h-2 rounded-full transition-colors ${
                                                activeTab === tab ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="btn-primary px-6 py-2 flex items-center gap-2"
                                    >
                                        {isSubmitting
                                            ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                            : <Upload size={16} />}
                                        {isSubmitting ? 'Saving...' : editingId ? 'Update Manual' : 'Create Manual'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminManuals;
