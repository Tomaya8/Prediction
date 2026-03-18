'use client';

import { useState, useEffect } from 'react';
import { Search, MoreVertical, Ban, Award, CreditCard } from 'lucide-react';

interface User {
  id: string;
  email: string;
  displayName: string;
  creditBalance: number;
  totalWinnings: number;
  totalTrades: number;
  createdAt: string;
  lastActiveAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    // Simulated data - replace with actual Firebase queries
    const fetchUsers = async () => {
      setUsers([
        { id: '1', email: 'john@example.com', displayName: 'John Doe', creditBalance: 5000, totalWinnings: 15000, totalTrades: 45, createdAt: '2024-01-15', lastActiveAt: '2024-03-18' },
        { id: '2', email: 'jane@example.com', displayName: 'Jane Smith', creditBalance: 8200, totalWinnings: 28000, totalTrades: 120, createdAt: '2024-01-20', lastActiveAt: '2024-03-17' },
        { id: '3', email: 'bob@example.com', displayName: 'Bob Wilson', creditBalance: 1200, totalWinnings: 5000, totalTrades: 25, createdAt: '2024-02-01', lastActiveAt: '2024-03-15' },
        { id: '4', email: 'alice@example.com', displayName: 'Alice Brown', creditBalance: 15000, totalWinnings: 45000, totalTrades: 200, createdAt: '2024-01-10', lastActiveAt: '2024-03-18' },
        { id: '5', email: 'charlie@example.com', displayName: 'Charlie Davis', creditBalance: 3500, totalWinnings: 12000, totalTrades: 60, createdAt: '2024-02-10', lastActiveAt: '2024-03-16' },
      ]);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            {filteredUsers.map((user) => (
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
                  {user.lastActiveAt}
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
              <button className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
                <CreditCard size={16} />
                Add Credits
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 bg-red-100 text-red-600 py-2 rounded-lg hover:bg-red-200">
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
