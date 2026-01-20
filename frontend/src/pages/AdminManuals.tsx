import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    FileText,
    Download
} from 'lucide-react';
import api from '../api/axios';
import type { Manual } from '../types';
import toast from 'react-hot-toast';

const AdminManuals = () => {
    const [manuals, setManuals] = useState<Manual[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSeries, setActiveSeries] = useState('All Series');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchManuals();
    }, []);

    const fetchManuals = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/content/manuals/');
            setManuals(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch manuals", error);
            toast.error("Failed to load manuals");
        } finally {
            setLoading(false);
        }
    };

    const filteredManuals = manuals.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Manuals Management</h2>
                    <p className="text-gray-500 dark:text-gray-400">Manage weekly study manuals and resources</p>
                </div>
                <button className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
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
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:border-green-500"
                        value={activeSeries}
                        onChange={(e) => setActiveSeries(e.target.value)}
                    >
                        <option>All Series</option>
                        <option>Foundations of Faith</option>
                        <option>Modern Faith</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Series</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading manuals...</td></tr>
                            ) : filteredManuals.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-gray-500">No manuals found.</td></tr>
                            ) : filteredManuals.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                                        <div className="font-medium text-gray-900 dark:text-white">{item.title}</div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{item.is_series ? 'Series' : 'Standalone'}</td>
                                    <td className="p-4">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            Published
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                            <a
                                                href={item.file_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            >
                                                <Download size={16} />
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminManuals;
