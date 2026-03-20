'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, MoreVertical, Ban, CreditCard } from 'lucide-react';
import { api } from '../../../lib/api-client';

interface User {
  id: string;
  email: string;
  displayName: string;
  creditBalance: number;
  totalWinnings: number;
  totalTrades: number;
  createdAt: string;
  lastActiveDate: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers(search);
      if (res.success && res.data) setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(searchTerm || undefined), 400);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchUsers]);

  const handleAddCredits = async () => {
    if (!selectedUser) return;
    const amountStr = window.prompt(`Add/remove credits for ${selectedUser.displayName}:\n(Use negative number to remove credits)`);
    if (!amountStr) return;
    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount === 0) { alert('Invalid amount'); return; }
    setActionLoading(true);
    const res = await api.addCredits(selectedUser.id, amount);
    setActionLoading(false);
    if (res.success) {
      alert(`Credits updated! New balance: ${res.data?.creditBalance?.toLocaleString()}`);
      setSelectedUser(null);
      fetchUsers(searchTerm || undefined);
    } else {
      alert(res.error || 'Failed to update credits');
    }
  };

  const handleBanUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Ban ${selectedUser.displayName}? This will zero out their balance.`)) return;
    setActionLoading(true);
    const res = await api.banUser(selectedUser.id);
    setActionLoading(false);
    if (res.success) {
      alert(`${selectedUser.displayName} has been banned.`);
      setSelectedUser(null);
      fetchUsers(searchTerm || undefined);
    } else {
      alert(res.error || 'Failed to ban user');
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading users...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winnings</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trades</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user: User) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <CreditCard size={16} className="mr-1 text-green-500" />
                    {user.creditBalance.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${user.totalWinnings.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.totalTrades}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.createdAt}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastActiveDate ? new Date(user.lastActiveDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button 
                    onClick={() => setSelectedUser(user)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedUser.displayName}</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Email:</span>
                <span className="text-gray-900">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Balance:</span>
                <span className="text-gray-900 font-semibold">${selectedUser.creditBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Winnings:</span>
                <span className="text-green-600 font-semibold">${selectedUser.totalWinnings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Trades:</span>
                <span className="text-gray-900">{selectedUser.totalTrades}</span>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleAddCredits}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <CreditCard size={16} />
                Add Credits
              </button>
              <button
                onClick={handleBanUser}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-600 py-2 rounded-lg hover:bg-red-200 disabled:opacity-50"
              >
                <Ban size={16} />
                Ban User
              </button>
            </div>
            <button 
              onClick={() => setSelectedUser(null)}
              className="mt-3 w-full text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
