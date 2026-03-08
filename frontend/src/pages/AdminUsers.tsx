import { useState, useEffect, useRef } from 'react';
import {
    Search, MoreVertical, UserCircle,
    Edit2, Trash2, Mail, X, Loader, Shield
} from 'lucide-react';
import api from '../api/axios';
import type { User } from '../types';
import toast from 'react-hot-toast';

const PROVINCES = [
    { value: 'lagos', label: 'Lagos' },
    { value: 'abuja', label: 'Abuja' },
    { value: 'rivers', label: 'Rivers' },
    { value: 'kano', label: 'Kano' },
    { value: 'oyo', label: 'Oyo' },
    { value: 'delta', label: 'Delta' },
    { value: 'anambra', label: 'Anambra' },
    { value: 'enugu', label: 'Enugu' },
    { value: 'kaduna', label: 'Kaduna' },
    { value: 'ogun', label: 'Ogun' },
];

const EMPTY_FORM = {
    first_name: '', last_name: '', email: '',
    gender: '', role: 'teen', province: '',
    phone: '', is_active: true,
};

const AdminUsers = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRole] = useState('All Roles');
    const [searchQuery, setSearchQuery] = useState('');

    // Dropdown menu
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Edit modal
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Delete confirmation
    const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Email action
    const [emailingUserId, setEmailingUserId] = useState<string | null>(null);

    useEffect(() => { fetchUsers(); }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/auth/users/');
            setUsers(Array.isArray(data) ? data : data.results || []);
        } catch {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const openEdit = (user: User) => {
        setEditingUser(user);
        setEditForm({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            gender: (user as any).gender || '',
            role: user.role || 'teen',
            province: (user as any).province || '',
            phone: (user as any).phone || '',
            is_active: (user as any).is_active !== false,
        });
        setOpenMenuId(null);
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setSaving(true);
        try {
            await api.patch(`/auth/users/${editingUser.id}/`, editForm);
            toast.success('User updated');
            setEditingUser(null);
            fetchUsers();
        } catch (err: any) {
            const detail = err?.response?.data;
            const msg = detail ? JSON.stringify(detail) : 'Update failed';
            toast.error(msg.length < 120 ? msg : 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteUserId) return;
        setDeleting(true);
        try {
            await api.delete(`/auth/users/${deleteUserId}/`);
            toast.success('User deleted');
            setDeleteUserId(null);
            fetchUsers();
        } catch {
            toast.error('Failed to delete user');
        } finally {
            setDeleting(false);
        }
    };

    const handleSendWelcomeEmail = async (user: User) => {
        setEmailingUserId(user.id);
        setOpenMenuId(null);
        try {
            await api.post(`/auth/users/${user.id}/send_welcome_email/`);
            toast.success(`Welcome email sent to ${user.email}`);
        } catch {
            toast.error('Failed to send email');
        } finally {
            setEmailingUserId(null);
        }
    };

    // Stats
    const totalStats = {
        total: users.length,
        teens: users.filter(u => u.role === 'teen' || u.role === 'individual' || !u.role).length,
        coordinators: users.filter(u => u.role === 'coordinator').length,
        admins: users.filter(u => u.role === 'admin').length,
        active: users.filter(u => (u as any).is_active !== false).length,
    };

    const stats = [
        { title: 'Total Users', value: totalStats.total },
        { title: 'Teens', value: totalStats.teens },
        { title: 'Coordinators', value: totalStats.coordinators },
        { title: 'Admins', value: totalStats.admins },
        { title: 'Active', value: totalStats.active, color: 'text-green-600' },
    ];

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'coordinator': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const filteredUsers = users.filter(u =>
        (u.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.username.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (activeRole === 'All Roles' || u.role === activeRole.toLowerCase())
    );

    const inputCls = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none";

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Users Management</h2>
                    <p className="text-gray-500 dark:text-gray-400">Manage user accounts and permissions</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">{stat.title}</p>
                        <h3 className={`text-2xl font-bold text-gray-900 dark:text-white ${stat.color || ''}`}>{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search users by name, email or username..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:border-green-500"
                    value={activeRole}
                    onChange={(e) => setActiveRole(e.target.value)}
                >
                    <option>All Roles</option>
                    <option>Admin</option>
                    <option>Coordinator</option>
                    <option>Teen</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading users...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No users found.</td></tr>
                            ) : filteredUsers.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                                                <UserCircle size={24} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">
                                                    {[item.first_name, item.last_name].filter(Boolean).join(' ') || item.username}
                                                </div>
                                                <div className="text-xs text-gray-500">{item.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${getRoleBadge(item.role)}`}>
                                            {item.role || 'teen'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${(item as any).is_active !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {(item as any).is_active !== false ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                        {(item as any).date_joined
                                            ? new Date((item as any).date_joined).toLocaleDateString()
                                            : '—'}
                                    </td>
                                    <td className="p-4 text-right relative">
                                        <div className="inline-block" ref={openMenuId === item.id ? menuRef : null}>
                                            <button
                                                onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                {emailingUserId === item.id
                                                    ? <Loader size={16} className="animate-spin" />
                                                    : <MoreVertical size={16} />}
                                            </button>

                                            {openMenuId === item.id && (
                                                <div className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                                                    <button
                                                        onClick={() => openEdit(item)}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        <Edit2 size={14} className="text-primary-500" /> Edit User
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendWelcomeEmail(item)}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        <Mail size={14} className="text-blue-500" /> Send Welcome Email
                                                    </button>
                                                    <div className="border-t border-gray-100 dark:border-gray-700" />
                                                    <button
                                                        onClick={() => { setDeleteUserId(item.id); setOpenMenuId(null); }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    >
                                                        <Trash2 size={14} /> Delete User
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Edit User Modal ── */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <Shield size={20} className="text-primary-500" />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit User</h3>
                            </div>
                            <button onClick={() => setEditingUser(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleEditSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">First Name</label>
                                    <input className={inputCls} value={editForm.first_name}
                                        onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Last Name</label>
                                    <input className={inputCls} value={editForm.last_name}
                                        onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Email</label>
                                <input type="email" className={inputCls} value={editForm.email}
                                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                                <input type="tel" className={inputCls} value={editForm.phone}
                                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Gender</label>
                                    <select className={inputCls} value={editForm.gender}
                                        onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                                        <option value="">Select Gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Role</label>
                                    <select className={inputCls} value={editForm.role}
                                        onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                                        <option value="teen">Teen</option>
                                        <option value="coordinator">Coordinator</option>
                                        <option value="admin">Admin</option>
                                        <option value="individual">Individual</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Province</label>
                                <select className={inputCls} value={editForm.province}
                                    onChange={e => setEditForm(f => ({ ...f, province: e.target.value }))}>
                                    <option value="">None</option>
                                    {PROVINCES.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    checked={editForm.is_active}
                                    onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Account is active
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditingUser(null)}
                                    className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? <Loader size={15} className="animate-spin" /> : null}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation ── */}
            {deleteUserId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} className="text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User?</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            This action cannot be undone. The user and all their data will be permanently removed.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteUserId(null)}
                                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDelete} disabled={deleting}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {deleting ? <Loader size={15} className="animate-spin" /> : null}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;
