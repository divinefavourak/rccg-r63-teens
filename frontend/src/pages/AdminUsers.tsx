import { useState, useEffect } from 'react';
import {
    Search,
    Filter,
    MoreVertical,
    UserCircle
} from 'lucide-react';
import api from '../api/axios';
import type { User } from '../types';
import toast from 'react-hot-toast';

const AdminUsers = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRole] = useState('All Roles');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/auth/users/');
            setUsers(Array.isArray(data) ? data : data.results || []);
        } catch (error) {
            console.error("Failed to fetch users", error);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    // Calculate Stats
    const totalStats = {
        total: users.length,
        teens: users.filter(u => u.role === 'teen' || !u.role).length, // Assuming default or 'teen'
        coordinators: users.filter(u => u.role === 'coordinator').length,
        admins: users.filter(u => u.role === 'admin').length,
        active: users.length // Placeholder, api doesn't return status yet
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
        (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.username.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (activeRole === 'All Roles' || u.role === activeRole.toLowerCase())
    );

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
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
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
                        placeholder="Search users by name or email..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 outline-none dark:text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
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
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300 font-bold">
                                                <UserCircle size={24} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">{item.name || item.first_name || item.username}</div>
                                                <div className="text-xs text-gray-500">{item.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${getRoleBadge(item.role)}`}>
                                            {item.role || 'User'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            Active
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                        -
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg">
                                            <MoreVertical size={16} />
                                        </button>
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

export default AdminUsers;
