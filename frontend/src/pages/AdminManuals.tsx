import { useState, useEffect } from 'react';
import {
    Plus, Search, Edit2, Trash2, X, Upload,
    FileText, Download, ChevronDown, ChevronUp,
    CloudDownload, Loader
} from 'lucide-react';
import api from '../api/axios';
import type { Manual } from '../types';
import toast from 'react-hot-toast';
import { toISODate } from '../utils/dates';

const AGE_GROUP_LABELS: Record<string, string> = {
    all: 'All Ages',
    children: 'Children (6-8)',
    pre_teen: 'Pre-Teen (9-12)',
    teen: 'Teens (13-19)',
    superteen: 'Superteen (19+)',
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
    lesson_objectives: '',      // newline-separated
    lesson_content: '',
    key_takeaways: '',          // newline-separated
    discussion_questions: '',   // newline-separated
    opening_prayer_points: '',  // newline-separated
    activity_suggestions: '',   // newline-separated
    additional_resources: '',   // newline-separated
    practical_application: '',
    closing_prayer: '',
    pdf_url: '',
    pdf_file: null as File | null,
    cover_image: null as File | null,
    status: 'published',
    has_teacher_edition: false,
    teacher_notes: '',
    discussion_guide: '',
};

type FormState = typeof EMPTY_FORM;

/** Compute week_end_date (Saturday) from a Sunday week_start_date string */
function weekEnd(startStr: string): string {
    if (!startStr) return '';
    const d = new Date(startStr);
    d.setDate(d.getDate() + 6);
    return toISODate(d);
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

    // Auto-import modal state
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importForm, setImportForm] = useState({
        title: '',
        week_start_date: '',
        target_age_group: 'teen',
        theme: '',
        memory_verse: '',
    });

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
            opening_prayer_points: (manual.opening_prayer_points || []).join('\n'),
            activity_suggestions: (manual.activity_suggestions || []).join('\n'),
            additional_resources: (manual.additional_resources || []).join('\n'),
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
            fd.append('opening_prayer_points', JSON.stringify(toList(formData.opening_prayer_points)));
            fd.append('activity_suggestions', JSON.stringify(toList(formData.activity_suggestions)));
            fd.append('additional_resources', JSON.stringify(toList(formData.additional_resources)));

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

    const handleAutoImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importForm.title.trim()) { toast.error('Topic/title is required'); return; }
        setIsImporting(true);
        const loadingToast = toast.loading('Generating manual with topic image…');
        try {
            const { data } = await api.post('/content/manuals/auto_import/', importForm);
            toast.dismiss(loadingToast);
            toast.success('Manual created — opening editor to fill in details');
            setIsImportOpen(false);
            setImportForm({ title: '', week_start_date: '', target_age_group: 'teen', theme: '', memory_verse: '' });
            // Open the edit modal pre-filled with the created manual
            openEdit(data);
            fetchManuals();
        } catch (err: any) {
            toast.dismiss(loadingToast);
            const msg = err?.response?.data?.error || 'Auto-import failed';
            toast.error(msg);
        } finally {
            setIsImporting(false);
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
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="btn-secondary py-2.5 px-4 flex items-center gap-2"
                        title="Auto-generate manual with topic image"
                    >
                        <CloudDownload size={20} /> <span className="hidden md:inline">Auto-Import</span>
                    </button>
                    <button
                        onClick={openCreate}
                        className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                    >
                        <Plus size={20} /> Add Manual
                    </button>
                </div>
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
                    <option value="children">Children (6-8)</option>
                    <option value="pre_teen">Pre-Teen (9-12)</option>
                    <option value="teen">Teens (13-19)</option>
                    <option value="superteen">Superteen (19+)</option>
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
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Views</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Downloads</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">PDF</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading ? (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading manuals...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No manuals found.</td></tr>
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
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                        {item.view_count ?? 0}
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                        {item.download_count ?? 0}
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
                                                    <option value="all">All Ages</option>
                                                    <option value="children">Children (6-8)</option>
                                                    <option value="pre_teen">Pre-Teen (9-12)</option>
                                                    <option value="teen">Teens (13-19)</option>
                                                    <option value="superteen">Superteen (19+)</option>
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

                                        {/* Teacher Edition */}
                                        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                                            <label className="flex items-center gap-2 cursor-pointer mb-3">
                                                <input
                                                    type="checkbox"
                                                    checked={(formData as any).has_teacher_edition || false}
                                                    onChange={e => setFormData(f => ({ ...f, has_teacher_edition: e.target.checked }))}
                                                    className="w-4 h-4 accent-emerald-600"
                                                />
                                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Has Teacher Edition</span>
                                            </label>
                                            {(formData as any).has_teacher_edition && (
                                                <div className="space-y-3 pl-6">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Teacher Notes</label>
                                                        <textarea
                                                            value={(formData as any).teacher_notes || ''}
                                                            onChange={e => setFormData(f => ({ ...f, teacher_notes: e.target.value }))}
                                                            rows={4}
                                                            placeholder="Lesson plan notes, teaching tips..."
                                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-white resize-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Discussion Guide</label>
                                                        <textarea
                                                            value={(formData as any).discussion_guide || ''}
                                                            onChange={e => setFormData(f => ({ ...f, discussion_guide: e.target.value }))}
                                                            rows={4}
                                                            placeholder="Discussion prompts, expected answers..."
                                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-white resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* ── Tab: Lesson Content ── */}
                                {activeTab === 'content' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Opening Prayer Points
                                                <span className="text-xs text-gray-400 ml-2">(one per line)</span>
                                            </label>
                                            <textarea
                                                name="opening_prayer_points"
                                                rows={3}
                                                placeholder={"Lord, open our hearts to receive your word\nGrant us understanding"}
                                                className="form-input font-mono text-sm"
                                                value={formData.opening_prayer_points}
                                                onChange={handleChange}
                                            />
                                        </div>

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
                                                Activity Suggestions
                                                <span className="text-xs text-gray-400 ml-2">(one per line)</span>
                                            </label>
                                            <textarea
                                                name="activity_suggestions"
                                                rows={3}
                                                placeholder={"Group role-play on the lesson theme\nBible verse memory challenge"}
                                                className="form-input font-mono text-sm"
                                                value={formData.activity_suggestions}
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
                                                Additional Resources
                                                <span className="text-xs text-gray-400 ml-2">(one per line — links or book references)</span>
                                            </label>
                                            <textarea
                                                name="additional_resources"
                                                rows={3}
                                                placeholder={"https://example.com/article\nBook: The Purpose Driven Life"}
                                                className="form-input font-mono text-sm"
                                                value={formData.additional_resources}
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

            {/* Auto-Import Modal */}
            {isImportOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <CloudDownload size={22} className="text-green-600" />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Auto-Import Manual</h3>
                            </div>
                            <button onClick={() => setIsImportOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Creates a manual stub and auto-fetches a <span className="font-medium text-gray-700 dark:text-gray-300">topic-relevant cover image</span>. The editor opens afterwards so you can fill in the lesson content.
                            </p>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Topic / Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Good Communication Skills"
                                    value={importForm.title}
                                    onChange={e => setImportForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                />
                                <p className="text-xs text-gray-400">Also used as keywords for the cover image search</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Week Start (Sunday)
                                    </label>
                                    <input
                                        type="date"
                                        value={importForm.week_start_date}
                                        onChange={e => setImportForm(f => ({ ...f, week_start_date: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Age Group</label>
                                    <select
                                        value={importForm.target_age_group}
                                        onChange={e => setImportForm(f => ({ ...f, target_age_group: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                    >
                                        <option value="all">All Ages</option>
                                        <option value="children">Children (6-8)</option>
                                        <option value="pre_teen">Pre-Teen (9-12)</option>
                                        <option value="teen">Teens (13-19)</option>
                                        <option value="superteen">Superteen (19+)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Bible Text / Theme <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. James 1:2-4"
                                    value={importForm.theme}
                                    onChange={e => setImportForm(f => ({ ...f, theme: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Memory Verse <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Philippians 4:6"
                                    value={importForm.memory_verse}
                                    onChange={e => setImportForm(f => ({ ...f, memory_verse: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                onClick={() => setIsImportOpen(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAutoImport as any}
                                disabled={isImporting || !importForm.title.trim()}
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

export default AdminManuals;
